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
    return rpt;
  }

  async saveSignature(id: string, signature: string) {
    return this.prisma.serviceReport.update({ where: { id }, data: { clientSignature: signature } });
  }

  private async fetchImageBuffer(url: string): Promise<Buffer | null> {
    try {
      const https = require('https');
      const http = require('http');
      const client = url.startsWith('https') ? https : http;
      return await new Promise<Buffer>((resolve, reject) => {
        const req = client.get(url, { timeout: 5000 }, (res: any) => {
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
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const blue = '#0A4F8C';
    const lightBlue = '#00AEEF';
    const white = '#FFFFFF';
    const lightGray = '#F5F5F5';
    const darkGray = '#333333';
    const pageWidth = 595.28;
    const margin = 50;
    const cw = pageWidth - margin * 2;
    const client = (rpt as any).client;
    const technician = (rpt as any).technician;
    const assets = (rpt as any).assets || [];

    // HEADER
    doc.rect(0, 0, pageWidth, 110).fill(white).stroke('#EEEEEE');

    // Logo
    const logoBuffer = await this.fetchImageBuffer(COMPANY.logoUrl);
    if (logoBuffer) {
      try { doc.image(logoBuffer, margin, 18, { height: 65, fit: [170, 65] }); } catch {}
    }

    // Company info right side
    doc.fillColor(blue).fontSize(8).font('Helvetica')
      .text(COMPANY.address, pageWidth - 210, 22, { width: 165, align: 'right' })
      .text(`Tel: ${COMPANY.phone}`, pageWidth - 210, 36, { width: 165, align: 'right' })
      .text(`Cel: ${COMPANY.mobile}`, pageWidth - 210, 48, { width: 165, align: 'right' })
      .text(COMPANY.email, pageWidth - 210, 60, { width: 165, align: 'right' })
      .text(COMPANY.web, pageWidth - 210, 72, { width: 165, align: 'right' });

    // Title bar
    doc.rect(0, 110, pageWidth, 32).fill(lightBlue);
    doc.fillColor(white).fontSize(13).font('Helvetica-Bold')
      .text('REPORTE DE SERVICIO TÉCNICO', margin, 120, { width: cw, align: 'center' });

    let y = 158;

    // Report info boxes
    const boxH = 28;
    const col = cw / 3;

    // Row 1: N° Reporte | Fecha | Tipo de servicio
    const infos = [
      ['N° Reporte', rpt.reportNumber],
      ['Fecha', new Date(rpt.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })],
      ['Tipo de Servicio', SERVICE_TYPES[rpt.serviceType] || rpt.serviceType],
    ];

    infos.forEach(([label, value], i) => {
      const x = margin + i * col;
      doc.rect(x, y, col - 4, boxH).fill(i % 2 === 0 ? lightGray : white).stroke('#CCCCCC');
      doc.fillColor(blue).fontSize(7).font('Helvetica-Bold').text(label.toUpperCase(), x + 6, y + 5, { width: col - 16 });
      doc.fillColor(darkGray).fontSize(9).font('Helvetica').text(value, x + 6, y + 15, { width: col - 16 });
    });

    y += boxH + 8;

    // Row 2: Cliente | Técnico
    const infos2 = [
      ['Cliente', client?.businessName || '–'],
      ['Técnico', technician?.name || '–'],
      ['Recibe', (rpt as any).receivedBy || client?.contactName || '–'],
    ];

    infos2.forEach(([label, value], i) => {
      const x = margin + i * col;
      doc.rect(x, y, col - 4, boxH).fill(i % 2 === 0 ? lightGray : white).stroke('#CCCCCC');
      doc.fillColor(blue).fontSize(7).font('Helvetica-Bold').text(label.toUpperCase(), x + 6, y + 5, { width: col - 16 });
      doc.fillColor(darkGray).fontSize(9).font('Helvetica').text(value, x + 6, y + 15, { width: col - 16 });
    });

    y += boxH + 14;

    // Section helper
    const section = (title: string) => {
      doc.rect(margin, y, cw, 20).fill(blue);
      doc.fillColor(white).fontSize(9).font('Helvetica-Bold').text(title.toUpperCase(), margin + 8, y + 6, { width: cw });
      y += 26;
    };

    const field = (text: string) => {
      const textH = doc.heightOfString(text, { width: cw - 16 });
      const h = Math.max(textH + 12, 24);
      doc.rect(margin, y, cw, h).fill(lightGray).stroke('#DDDDDD');
      doc.fillColor(darkGray).fontSize(9).font('Helvetica').text(text, margin + 8, y + 6, { width: cw - 16 });
      y += h + 6;
    };

    // Description
    section('Descripción del Servicio');
    field(rpt.description || '–');

    // Work done
    if (rpt.workDone) {
      section('Trabajo Realizado');
      field(rpt.workDone);
    }

    // Recommendations
    if (rpt.recommendations) {
      section('Recomendaciones');
      field(rpt.recommendations);
    }

    // Assets
    if (assets.length > 0) {
      section('Equipos Intervenidos');
      const colWidths = [cw * 0.35, cw * 0.2, cw * 0.2, cw * 0.25];
      const headers = ['Equipo', 'Tipo', 'Marca/Modelo', 'Serial'];
      let tx = margin;
      doc.rect(margin, y, cw, 18).fill(lightBlue);
      headers.forEach((h, i) => {
        doc.fillColor(white).fontSize(8).font('Helvetica-Bold').text(h, tx + 4, y + 5, { width: colWidths[i] - 8 });
        tx += colWidths[i];
      });
      y += 18;
      assets.forEach((ra: any, ri: number) => {
        const a = ra.asset;
        const rowH = 18;
        doc.rect(margin, y, cw, rowH).fill(ri % 2 === 0 ? white : lightGray).stroke('#DDDDDD');
        tx = margin;
        const vals = [a?.name || '–', a?.assetType?.name || '–', `${a?.brand || ''} ${a?.model || ''}`.trim() || '–', a?.serialNumber || '–'];
        vals.forEach((v, i) => {
          doc.fillColor(darkGray).fontSize(8).font('Helvetica').text(v, tx + 4, y + 5, { width: colWidths[i] - 8 });
          tx += colWidths[i];
        });
        y += rowH;
      });
      y += 8;
    }

    // Signatures
    y += 10;
    section('Firmas');

    const sigW = cw / 2 - 10;

    // Client signature
    doc.rect(margin, y, sigW, 80).stroke('#CCCCCC');
    if (rpt.clientSignature) {
      try {
        const sigData = rpt.clientSignature.replace(/^data:image\/\w+;base64,/, '');
        const sigBuffer = Buffer.from(sigData, 'base64');
        doc.image(sigBuffer, margin + 5, y + 5, { fit: [sigW - 10, 60] });
      } catch {}
    }
    doc.rect(margin, y + 62, sigW, 18).fill(lightGray);
    doc.fillColor(blue).fontSize(8).font('Helvetica-Bold')
      .text('FIRMA CLIENTE', margin + 4, y + 67, { width: sigW - 8 });
    const receiverName = (rpt as any).receivedBy || client?.contactName || client?.businessName || '–';
    doc.fillColor(darkGray).fontSize(8).font('Helvetica')
      .text(receiverName, margin + 4, y + 78, { width: sigW - 8 });

    // Technician signature
    const tx2 = margin + sigW + 20;
    doc.rect(tx2, y, sigW, 80).stroke('#CCCCCC');
    doc.rect(tx2, y + 62, sigW, 18).fill(lightGray);
    doc.fillColor(blue).fontSize(8).font('Helvetica-Bold')
      .text('FIRMA TÉCNICO', tx2 + 4, y + 67, { width: sigW - 8 });
    doc.fillColor(darkGray).fontSize(8).font('Helvetica')
      .text(technician?.name || '–', tx2 + 4, y + 78, { width: sigW - 8 });

    // Footer - simple line
    doc.moveTo(margin, 800).lineTo(pageWidth - margin, 800).stroke('#CCCCCC');
    doc.fillColor(darkGray).fontSize(7).font('Helvetica')
      .text(`${COMPANY.name} | ${COMPANY.address} | ${COMPANY.phone} | ${COMPANY.email} | ${COMPANY.web}`, margin, 806, { width: cw, align: 'center' });
    doc.fillColor(darkGray).fontSize(7)
      .text(`Reporte generado el ${new Date().toLocaleDateString('es-CO')}`, margin, 818, { width: cw, align: 'center' });

    doc.end();
    return new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  }

  async sendEmail(id: string, toEmail?: string) {
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
          <tr style="background:${i%2===0?'#f9f9f9':'white'}">
            <td style="padding:6px;border-bottom:1px solid #eee">${ra.asset?.name||'–'}</td>
            <td style="padding:6px;border-bottom:1px solid #eee">${ra.asset?.assetType?.name||'–'}</td>
            <td style="padding:6px;border-bottom:1px solid #eee">${ra.asset?.serialNumber||'–'}</td>
          </tr>`).join('')}
      </table>` : '<p style="color:#888">Sin equipos registrados</p>';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f4f4f4">
  <div style="max-width:600px;margin:20px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
    <div style="background:#0A4F8C;padding:24px;text-align:center">
      <img src="${COMPANY.logoUrl}" style="height:60px;margin-bottom:8px" onerror="this.style.display='none'">
      <h1 style="color:white;margin:0;font-size:18px">Reporte de Servicio Técnico</h1>
    </div>
    <div style="background:#00AEEF;padding:10px 24px;text-align:center">
      <span style="color:white;font-weight:bold;font-size:16px">${rpt.reportNumber}</span>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="padding:8px;background:#f5f5f5;width:50%"><strong style="color:#0A4F8C">Fecha:</strong><br>${new Date(rpt.date).toLocaleDateString('es-CO', {year:'numeric',month:'long',day:'numeric'})}</td>
          <td style="padding:8px;background:white;width:50%"><strong style="color:#0A4F8C">Tipo de Servicio:</strong><br>${SERVICE_TYPES[rpt.serviceType] || rpt.serviceType}</td>
        </tr>
        <tr>
          <td style="padding:8px;background:white"><strong style="color:#0A4F8C">Cliente:</strong><br>${client?.businessName||'–'}</td>
          <td style="padding:8px;background:#f5f5f5"><strong style="color:#0A4F8C">Técnico:</strong><br>${technician?.name||'–'}</td>
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
</body>
</html>`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Gipfel IT <soporte@grupogipfel.com>',
        to: recipient,
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
