import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

const COMPANY = {
  name: 'Grupo Gipfel',
  address: 'Calle 96 #68F-24, Bogotá',
  phone: '601 811 9749',
  mobile: '311 503 5734',
  email: 'info@grupogipfel.com',
  web: 'www.grupogipfel.com',
  logoUrl: 'https://www.grupogipfel.com/imagenes/logo-gipfel.png',
  logoDarkUrl: 'https://www.grupogipfel.com/imagenes/logo-gipfel2.png',
};

const SERVICE_TYPES: Record<string, string> = {
  EN_SITIO: 'En Sitio',
  REMOTO: 'Remoto',
  TELEFONICO: 'Telefónico',
};

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async findAll(q: any) {
    const where: any = {};
    if (q.clientId) where.clientId = q.clientId;
    if (q.technicianId) where.technicianId = q.technicianId;
    return this.prisma.serviceReport.findMany({
      where,
      include: {
        client: { select: { id: true, businessName: true } },
        technician: { select: { id: true, name: true } },
        assets: { include: { asset: { include: { assetType: true } } } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.serviceReport.findUnique({
      where: { id },
      include: {
        client: true,
        technician: { select: { id: true, name: true } },
        assets: { include: { asset: { include: { assetType: true } } } },
      },
    });
  }

  async create(dto: any) {
    const count = await this.prisma.serviceReport.count();
    const reportNumber = `RPT-${String(count + 1).padStart(5, '0')}`;
    const { assetIds, observations, conclusion, signatureUrl, receivedBy, ...data } = dto;
    const rpt = await this.prisma.serviceReport.create({
      data: {
        reportNumber,
        clientId: data.clientId,
        technicianId: data.technicianId || undefined,
        date: new Date(data.date),
        serviceType: data.serviceType,
        description: data.description,
        workDone: observations || undefined,
        recommendations: conclusion || undefined,
        clientSignature: signatureUrl || undefined,
        receivedBy: receivedBy || undefined,
        assets: assetIds?.length
          ? { create: assetIds.map((a: any) => ({ assetId: typeof a === 'string' ? a : a.id })) }
          : undefined,
      },
      include: { client: true, technician: { select: { id: true, name: true } } },
    });

    // Auto-create maintenance records for each asset
    if (assetIds?.length) {
      for (const a of assetIds) {
        const assetId = typeof a === 'string' ? a : a.id;
        const workDetail = typeof a === 'object' ? a.workDetail : undefined;
        try {
          await this.prisma.maintenanceRecord.create({
            data: {
              assetId,
              technicianId: data.technicianId || undefined,
              type: 'CORRECTIVO',
              description: data.description || 'Servicio técnico',
              findings: workDetail || observations || undefined,
            },
          });
        } catch {}
      }
    }

    return rpt;
  }

  async saveSignature(id: string, signature: string) {
    return this.prisma.serviceReport.update({ where: { id }, data: { clientSignature: signature } });
  }

  private async fetchImageBuffer(url: string): Promise<Buffer | null> {
    try {
      const https = require('https');
      const http = require('http');
      const lib = url.startsWith('https') ? https : http;
      return await new Promise<Buffer>((resolve, reject) => {
        const req = lib.get(url, { timeout: 5000 }, (res: any) => {
          if (res.statusCode !== 200) { reject(new Error('Not found')); return; }
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      });
    } catch { return null; }
  }

  async getPDF(id: string) {
    const rpt = await this.findOne(id);
    if (!rpt) throw new Error('Report not found');

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const blue = '#0A4F8C';
    const lightBlue = '#00AEEF';
    const white = '#FFFFFF';
    const lightGray = '#F5F5F5';
    const darkGray = '#333333';
    const pageW = 595.28;
    const margin = 40;
    const cw = pageW - margin * 2;
    const client = (rpt as any).client;
    const technician = (rpt as any).technician;
    const assets = (rpt as any).assets || [];

    // ── HEADER ──────────────────────────────────────────
    doc.rect(0, 0, pageW, 105).fill(white);
    doc.rect(0, 0, pageW, 105).stroke('#DDDDDD');

    // Logo
    const logoBuffer = await this.fetchImageBuffer(COMPANY.logoUrl);
    if (logoBuffer) {
      try { doc.image(logoBuffer, margin, 15, { height: 70, fit: [180, 70] }); } catch {}
    }

    // Company info
    doc.fillColor(blue).fontSize(8).font('Helvetica-Bold')
      .text(COMPANY.name, pageW - 200, 18, { width: 165, align: 'right' });
    doc.font('Helvetica').fontSize(7.5)
      .text(COMPANY.address, pageW - 200, 30, { width: 165, align: 'right' })
      .text(`Tel: ${COMPANY.phone} | Cel: ${COMPANY.mobile}`, pageW - 200, 42, { width: 165, align: 'right' })
      .text(COMPANY.email, pageW - 200, 54, { width: 165, align: 'right' })
      .text(COMPANY.web, pageW - 200, 66, { width: 165, align: 'right' });

    // Title bar
    doc.rect(0, 105, pageW, 28).fill(lightBlue);
    doc.fillColor(white).fontSize(12).font('Helvetica-Bold')
      .text('REPORTE DE SERVICIO TÉCNICO', margin, 114, { width: cw, align: 'center' });

    let y = 143;

    // ── INFO BOXES ───────────────────────────────────────
    const drawBox = (x: number, bY: number, w: number, h: number, label: string, value: string, bg: string) => {
      doc.rect(x, bY, w, h).fill(bg).stroke('#CCCCCC');
      doc.fillColor(blue).fontSize(6.5).font('Helvetica-Bold')
        .text(label, x + 5, bY + 4, { width: w - 10 });
      doc.fillColor(darkGray).fontSize(8.5).font('Helvetica')
        .text(value, x + 5, bY + 14, { width: w - 10 });
    };

    const col = cw / 3;
    const boxH = 28;

    // Row 1
    const row1 = [
      ['N° REPORTE', rpt.reportNumber],
      ['FECHA', new Date(rpt.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })],
      ['TIPO DE SERVICIO', SERVICE_TYPES[rpt.serviceType] || rpt.serviceType],
    ];
    row1.forEach(([l, v], i) => drawBox(margin + i * col, y, col - 3, boxH, l, v, i % 2 === 0 ? lightGray : white));
    y += boxH + 3;

    // Row 2
    const row2 = [
      ['CLIENTE', client?.businessName || '–'],
      ['TÉCNICO', technician?.name || '–'],
      ['RECIBE', (rpt as any).receivedBy || client?.contactName || '–'],
    ];
    row2.forEach(([l, v], i) => drawBox(margin + i * col, y, col - 3, boxH, l, v, i % 2 === 0 ? white : lightGray));
    y += boxH + 8;

    // ── SECTION HELPERS ──────────────────────────────────
    const section = (title: string) => {
      doc.rect(margin, y, cw, 18).fill(blue);
      doc.fillColor(white).fontSize(8).font('Helvetica-Bold')
        .text(title, margin + 6, y + 5, { width: cw - 12 });
      y += 22;
    };

    const textBlock = (text: string) => {
      const h = Math.max(doc.heightOfString(text, { width: cw - 16 }) + 10, 22);
      doc.rect(margin, y, cw, h).fill(lightGray).stroke('#DDDDDD');
      doc.fillColor(darkGray).fontSize(8.5).font('Helvetica')
        .text(text, margin + 8, y + 5, { width: cw - 16 });
      y += h + 5;
    };

    // ── CONTENT ──────────────────────────────────────────
    section('DESCRIPCIÓN DEL SERVICIO');
    textBlock(rpt.description || '–');

    if (rpt.workDone) {
      section('TRABAJO REALIZADO');
      textBlock(rpt.workDone);
    }

    if (rpt.recommendations) {
      section('RECOMENDACIONES');
      textBlock(rpt.recommendations);
    }

    // Assets table
    if (assets.length > 0) {
      section('EQUIPOS INTERVENIDOS');
      const cols = [cw * 0.35, cw * 0.2, cw * 0.22, cw * 0.23];
      const heads = ['Equipo', 'Tipo', 'Marca/Modelo', 'Serial'];
      doc.rect(margin, y, cw, 16).fill(lightBlue);
      let tx = margin;
      heads.forEach((h, i) => {
        doc.fillColor(white).fontSize(7.5).font('Helvetica-Bold').text(h, tx + 4, y + 4, { width: cols[i] - 8 });
        tx += cols[i];
      });
      y += 16;
      assets.forEach((ra: any, ri: number) => {
        const a = ra.asset;
        const rh = 16;
        doc.rect(margin, y, cw, rh).fill(ri % 2 === 0 ? white : lightGray).stroke('#DDDDDD');
        tx = margin;
        [a?.name || '–', a?.assetType?.name || '–', `${a?.brand || ''} ${a?.model || ''}`.trim() || '–', a?.serialNumber || '–'].forEach((v, i) => {
          doc.fillColor(darkGray).fontSize(7.5).font('Helvetica').text(v, tx + 4, y + 4, { width: cols[i] - 8 });
          tx += cols[i];
        });
        y += rh;
      });
      y += 5;
    }

    // ── SIGNATURES ───────────────────────────────────────
    const sigH = 100; // total height needed for signatures
    if (y + sigH + 40 > 820) {
      doc.addPage();
      y = 40;
    }

    y += 8;
    section('FIRMAS');

    const sigW = cw / 2 - 8;
    const sigBoxH = 65;

    // Client
    doc.rect(margin, y, sigW, sigBoxH).stroke('#CCCCCC');
    if (rpt.clientSignature) {
      try {
        const sigBuf = Buffer.from(rpt.clientSignature.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        doc.image(sigBuf, margin + 4, y + 4, { fit: [sigW - 8, sigBoxH - 8] });
      } catch {}
    }
    doc.rect(margin, y + sigBoxH, sigW, 22).fill(lightGray).stroke('#CCCCCC');
    doc.fillColor(blue).fontSize(7).font('Helvetica-Bold').text('FIRMA CLIENTE', margin + 4, y + sigBoxH + 4, { width: sigW - 8 });
    doc.fillColor(darkGray).fontSize(8).font('Helvetica').text((rpt as any).receivedBy || client?.contactName || client?.businessName || '–', margin + 4, y + sigBoxH + 13, { width: sigW - 8 });

    // Technician
    const tx2 = margin + sigW + 16;
    doc.rect(tx2, y, sigW, sigBoxH).stroke('#CCCCCC');
    doc.rect(tx2, y + sigBoxH, sigW, 22).fill(lightGray).stroke('#CCCCCC');
    doc.fillColor(blue).fontSize(7).font('Helvetica-Bold').text('FIRMA TÉCNICO', tx2 + 4, y + sigBoxH + 4, { width: sigW - 8 });
    doc.fillColor(darkGray).fontSize(8).font('Helvetica').text(technician?.name || '–', tx2 + 4, y + sigBoxH + 13, { width: sigW - 8 });

    y += sigBoxH + 22 + 12;

    // ── FOOTER ───────────────────────────────────────────
    doc.moveTo(margin, y).lineTo(pageW - margin, y).stroke('#CCCCCC');
    doc.fillColor(darkGray).fontSize(6.5).font('Helvetica')
      .text(`${COMPANY.name} | ${COMPANY.address} | Tel: ${COMPANY.phone} | Cel: ${COMPANY.mobile} | ${COMPANY.email} | ${COMPANY.web}`, margin, y + 5, { width: cw, align: 'center' })
      .text(`Documento generado el ${new Date().toLocaleDateString('es-CO')}`, margin, y + 15, { width: cw, align: 'center' });

    doc.end();
    return new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  }

  async sendEmail(id: string, toEmail?: string, cc?: string) {
    const rpt = await this.findOne(id);
    if (!rpt) throw new Error('Report not found');
    const client = (rpt as any).client;
    const technician = (rpt as any).technician;
    const assets = (rpt as any).assets || [];
    const recipient = toEmail || client?.email;
    if (!recipient) throw new Error('No hay correo destinatario');

    const assetsHtml = assets.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;margin-top:8px">
        <tr style="background:#00AEEF;color:white">
          <th style="padding:6px;text-align:left">Equipo</th>
          <th style="padding:6px;text-align:left">Tipo</th>
          <th style="padding:6px;text-align:left">Serial</th>
        </tr>
        ${assets.map((ra: any, i: number) => `
          <tr style="background:${i % 2 === 0 ? '#f9f9f9' : 'white'}">
            <td style="padding:6px;border-bottom:1px solid #eee">${ra.asset?.name || '–'}</td>
            <td style="padding:6px;border-bottom:1px solid #eee">${ra.asset?.assetType?.name || '–'}</td>
            <td style="padding:6px;border-bottom:1px solid #eee">${ra.asset?.serialNumber || '–'}</td>
          </tr>`).join('')}
      </table>` : '<p style="color:#888">Sin equipos registrados</p>';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f4f4f4">
  <div style="max-width:600px;margin:20px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
    <div style="background:#ffffff;padding:24px;text-align:center;border-bottom:3px solid #00AEEF">
      <img src="${COMPANY.logoDarkUrl}" style="height:70px;margin-bottom:12px" onerror="this.style.display='none'">
      <h1 style="color:#0A4F8C;margin:0;font-size:18px;font-weight:bold">Reporte de Servicio Técnico</h1>
    </div>
    <div style="background:#00AEEF;padding:10px 24px;text-align:center">
      <span style="color:white;font-weight:bold;font-size:16px">${rpt.reportNumber}</span>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="padding:8px;background:#f5f5f5;width:50%"><strong style="color:#0A4F8C">Fecha:</strong><br>${new Date(rpt.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
          <td style="padding:8px;background:white;width:50%"><strong style="color:#0A4F8C">Tipo de Servicio:</strong><br>${SERVICE_TYPES[rpt.serviceType] || rpt.serviceType}</td>
        </tr>
        <tr>
          <td style="padding:8px;background:white"><strong style="color:#0A4F8C">Cliente:</strong><br>${client?.businessName || '–'}</td>
          <td style="padding:8px;background:#f5f5f5"><strong style="color:#0A4F8C">Técnico:</strong><br>${technician?.name || '–'}</td>
        </tr>
        <tr>
          <td style="padding:8px;background:#f5f5f5" colspan="2"><strong style="color:#0A4F8C">Persona que recibe:</strong> ${(rpt as any).receivedBy || client?.contactName || '–'}</td>
        </tr>
      </table>
      <div style="background:#f5f5f5;border-left:4px solid #0A4F8C;padding:12px;margin-bottom:16px;border-radius:0 4px 4px 0">
        <strong style="color:#0A4F8C">Descripción del Servicio:</strong>
        <p style="margin:8px 0 0;color:#333">${rpt.description}</p>
      </div>
      ${rpt.workDone ? `<div style="background:#f5f5f5;border-left:4px solid #00AEEF;padding:12px;margin-bottom:16px;border-radius:0 4px 4px 0">
        <strong style="color:#0A4F8C">Trabajo Realizado:</strong>
        <p style="margin:8px 0 0;color:#333">${rpt.workDone}</p>
      </div>` : ''}
      ${rpt.recommendations ? `<div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px;margin-bottom:16px;border-radius:0 4px 4px 0">
        <strong style="color:#856404">Recomendaciones:</strong>
        <p style="margin:8px 0 0;color:#333">${rpt.recommendations}</p>
      </div>` : ''}
      <strong style="color:#0A4F8C">Equipos Intervenidos:</strong>
      ${assetsHtml}
    </div>
    <div style="background:#0A4F8C;padding:16px;text-align:center">
      <p style="color:#00AEEF;margin:0;font-size:12px">${COMPANY.name}</p>
      <p style="color:white;margin:4px 0;font-size:11px">${COMPANY.address} | ${COMPANY.phone} | ${COMPANY.mobile}</p>
      <p style="color:white;margin:0;font-size:11px">${COMPANY.email} | ${COMPANY.web}</p>
    </div>
  </div>
</body></html>`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Gipfel IT <soporte@grupogipfel.com>',
        to: recipient,
        cc: cc || undefined,
        subject: `Reporte de Servicio ${rpt.reportNumber} - ${client?.businessName || ''}`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Error enviando correo: ${err}`);
    }

    await this.prisma.serviceReport.update({ where: { id }, data: { emailSent: true } });
    return { sent: true, to: recipient };
  }
}
