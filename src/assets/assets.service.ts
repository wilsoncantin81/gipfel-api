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

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(q: any) {
    const where: any = {};
    if (q.clientId) where.clientId = q.clientId;
    if (q.status) where.status = q.status;
    if (q.assetTypeId) {
      const ids = Array.isArray(q.assetTypeId) ? q.assetTypeId : [q.assetTypeId];
      where.assetTypeId = ids.length === 1 ? ids[0] : { in: ids };
    }
    if (q.search) where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { inventoryCode: { contains: q.search, mode: 'insensitive' } },
      { serialNumber: { contains: q.search, mode: 'insensitive' } },
      { brand: { contains: q.search, mode: 'insensitive' } },
    ];
    return this.prisma.asset.findMany({
      where,
      include: { client: { select: { id: true, businessName: true } }, assetType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.asset.findUnique({
      where: { id },
      include: {
        client: true, assetType: true,
        maintenanceRecords: { include: { technician: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  private sanitize(dto: any) {
    return {
      clientId: dto.clientId,
      assetTypeId: dto.assetTypeId,
      name: dto.name,
      brand: dto.brand || undefined,
      model: dto.model || undefined,
      serialNumber: dto.serialNumber || dto.serial || undefined,
      inventoryCode: dto.inventoryCode || dto.code || undefined,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : undefined,
      location: dto.location || undefined,
      status: dto.status || 'ACTIVO',
      notes: dto.notes || undefined,
      encryptedPassword: dto.password ? Buffer.from(dto.password).toString('base64') : undefined,
      nextMaintenance: dto.nextMaintenance ? new Date(dto.nextMaintenance) : undefined,
      maintenanceFrequencyDays: dto.maintenanceFrequencyDays ? Number(dto.maintenanceFrequencyDays) : undefined,
      supplier: dto.supplier || undefined,
      assignedUser: dto.assignedUser || undefined,
      responsible: dto.responsible || undefined,
      ipAddress: dto.ipAddress || undefined,
      macAddress: dto.macAddress || undefined,
      remoteAccess: dto.remoteAccess || undefined,
      extraFields: dto.extraFields ? (Array.isArray(dto.extraFields) ? dto.extraFields : []) : undefined,
    };
  }

  async create(dto: any) {
    return this.prisma.asset.create({ data: this.sanitize(dto) as any, include: { client: true, assetType: true } });
  }

  async update(id: string, dto: any) {
    const { clientId, assetTypeId, ...rest } = this.sanitize(dto);
    return this.prisma.asset.update({ where: { id }, data: rest as any, include: { client: true, assetType: true } });
  }

  async remove(id: string) {
    await this.prisma.asset.delete({ where: { id } });
    return { deleted: true };
  }

  async getPassword(id: string) {
    const a = await this.prisma.asset.findUnique({ where: { id } });
    if (!a?.encryptedPassword) return { password: null };
    try { return { password: Buffer.from(a.encryptedPassword, 'base64').toString('utf8') }; }
    catch { return { password: a.encryptedPassword }; }
  }

  async getQR(id: string) {
    const QRCode = require('qrcode');
    const a = await this.prisma.asset.findUnique({ where: { id } });
    if (!a) return { qrCodeUrl: null };
    const qr = await QRCode.toDataURL(`GIPFEL-ASSET:${id}`);
    return { qrCodeUrl: qr, name: a.name };
  }

  async exportExcel(q: any = {}) {
    const assets = await this.findAll(q);
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Grupo Gipfel';
    const ws = wb.addWorksheet('Inventario de Activos');

    const blue = { argb: 'FF0A4F8C' };
    const lightBlue = { argb: 'FF00AEEF' };
    const white = { argb: 'FFFFFFFF' };
    const lightBg = { argb: 'FFF0F7FF' };

    // Row 1: Company title
    const headers = ['Código','Nombre','Tipo','Cliente','Marca','Modelo','Serial','Estado','Ubicación','Proveedor','Usuario Asignado','Responsable','IP','MAC','Acceso Remoto','F. Compra','Garantía','Próx. Mant.','Notas'];
    const totalCols = headers.length;

    ws.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = 'GRUPO GIPFEL — INVENTARIO DE ACTIVOS TI';
    titleCell.font = { bold: true, size: 14, color: white };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: blue };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    ws.mergeCells(2, 1, 2, totalCols);
    const subCell = ws.getCell(2, 1);
    subCell.value = `${COMPANY.address} | Tel: ${COMPANY.phone} | ${COMPANY.email} | Generado: ${new Date().toLocaleDateString('es-CO')}`;
    subCell.font = { size: 9, color: white };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: lightBlue };
    subCell.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 18;

    // Row 3: Headers
    const widths = [14,28,18,25,15,15,20,12,18,18,20,18,15,17,18,14,14,14,25];
    headers.forEach((h, i) => {
      const cell = ws.getCell(3, i + 1);
      cell.value = h;
      cell.font = { bold: true, color: white, size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: blue };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: lightBlue } };
      ws.getColumn(i + 1).width = widths[i];
    });
    ws.getRow(3).height = 22;

    // Data rows
    assets.forEach((a: any, idx: number) => {
      const bg = idx % 2 === 0 ? white : lightBg;
      
      // Get extra fields as string
      let extraStr = '';
      try {
        const ef = Array.isArray((a as any).extraFields)
          ? (a as any).extraFields
          : Object.entries((a as any).extraFields || {}).map(([k, v]) => ({ k, v }));
        extraStr = ef.map((f: any) => `${f.k}: ${f.v}`).join(' | ');
      } catch {}

      const vals = [
        a.inventoryCode || '',
        a.name,
        a.assetType?.name || '',
        a.client?.businessName || '',
        a.brand || '',
        a.model || '',
        a.serialNumber || '',
        a.status,
        a.location || '',
        (a as any).supplier || '',
        (a as any).assignedUser || '',
        (a as any).responsible || '',
        (a as any).ipAddress || '',
        (a as any).macAddress || '',
        (a as any).remoteAccess || '',
        a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('es-CO') : '',
        a.warrantyUntil ? new Date(a.warrantyUntil).toLocaleDateString('es-CO') : '',
        a.nextMaintenance ? new Date(a.nextMaintenance).toLocaleDateString('es-CO') : '',
        extraStr,
      ];

      vals.forEach((v, i) => {
        const cell = ws.getCell(idx + 4, i + 1);
        cell.value = v;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
        cell.font = { size: 9 };
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } } };
        if (i === 7) {
          cell.font = { size: 9, bold: true, color: { argb: v === 'ACTIVO' ? 'FF27AE60' : v === 'EN_MANTENIMIENTO' ? 'FFF39C12' : 'FFE74C3C' } };
        }
      });
      ws.getRow(idx + 4).height = 16;
    });

    // Summary
    const lastRow = assets.length + 4;
    ws.mergeCells(lastRow, 1, lastRow, totalCols);
    const sumCell = ws.getCell(lastRow, 1);
    sumCell.value = `Total de activos: ${assets.length}`;
    sumCell.font = { bold: true, size: 10, color: blue };
    sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4FD' } };
    ws.getRow(lastRow).height = 18;

    return wb.xlsx.writeBuffer();
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

  async exportPDF(q: any = {}) {
    const assets = await this.findAll(q);
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const blue = '#0A4F8C';
    const lightBlue = '#00AEEF';
    const white = '#FFFFFF';
    const lightGray = '#F5F5F5';
    const darkGray = '#333333';
    const pageWidth = 841.89;
    const margin = 40;
    const cw = pageWidth - margin * 2;

    // Header - white background
    doc.rect(0, 0, pageWidth, 80).fill(white).stroke('#EEEEEE');
    const logoBuffer = await this.fetchImageBuffer(COMPANY.logoUrl);
    if (logoBuffer) {
      try { doc.image(logoBuffer, margin, 10, { height: 55, fit: [160, 55] }); } catch {}
    }
    doc.fillColor(blue).fontSize(16).font('Helvetica-Bold')
      .text('INVENTARIO DE ACTIVOS TI', margin + 180, 20, { width: cw - 180, align: 'right' });
    doc.fillColor(blue).fontSize(8).font('Helvetica')
      .text(`${COMPANY.address} | ${COMPANY.phone} | ${COMPANY.email}`, margin + 180, 42, { width: cw - 180, align: 'right' });
    doc.fillColor(blue).fontSize(8)
      .text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, margin + 180, 56, { width: cw - 180, align: 'right' });
    // Blue separator line
    doc.rect(0, 78, pageWidth, 3).fill(lightBlue);

    let y = 95;

    // Table headers
    const cols = [
      { label: 'Código', w: 65 },
      { label: 'Nombre', w: 130 },
      { label: 'Tipo', w: 80 },
      { label: 'Cliente', w: 110 },
      { label: 'Marca/Modelo', w: 100 },
      { label: 'Serial', w: 90 },
      { label: 'Estado', w: 65 },
      { label: 'Ubicación', w: 85 },
      { label: 'Garantía', w: 75 },
    ];

    // Header row
    doc.rect(margin, y, cw, 20).fill(blue);
    let tx = margin;
    cols.forEach(col => {
      doc.fillColor(white).fontSize(8).font('Helvetica-Bold')
        .text(col.label, tx + 3, y + 6, { width: col.w - 6 });
      tx += col.w;
    });
    y += 20;

    // Data rows
    assets.forEach((a: any, i: number) => {
      if (y > 530) {
        doc.addPage({ layout: 'landscape' });
        y = 40;
        // Repeat header
        doc.rect(margin, y, cw, 20).fill(blue);
        tx = margin;
        cols.forEach(col => {
          doc.fillColor(white).fontSize(8).font('Helvetica-Bold')
            .text(col.label, tx + 3, y + 6, { width: col.w - 6 });
          tx += col.w;
        });
        y += 20;
      }

      const rowH = 16;
      doc.rect(margin, y, cw, rowH).fill(i % 2 === 0 ? white : lightGray).stroke('#EEEEEE');
      tx = margin;
      const vals = [
        a.inventoryCode || '–',
        a.name,
        a.assetType?.name || '–',
        a.client?.businessName || '–',
        `${a.brand || ''} ${a.model || ''}`.trim() || '–',
        a.serialNumber || '–',
        a.status,
        a.location || '–',
        a.warrantyUntil ? new Date(a.warrantyUntil).toLocaleDateString('es-CO') : '–',
      ];
      vals.forEach((v, ci) => {
        const color = ci === 6
          ? (v === 'ACTIVO' ? '#27AE60' : v === 'EN_MANTENIMIENTO' ? '#F39C12' : '#E74C3C')
          : darkGray;
        doc.fillColor(color).fontSize(7).font(ci === 6 ? 'Helvetica-Bold' : 'Helvetica')
          .text(String(v), tx + 3, y + 5, { width: cols[ci].w - 6, ellipsis: true });
        tx += cols[ci].w;
      });
      y += rowH;
    });

    // Footer
    doc.moveTo(margin, y + 10).lineTo(pageWidth - margin, y + 10).stroke('#CCCCCC');
    doc.fillColor(darkGray).fontSize(7)
      .text(`${COMPANY.name} | Total activos: ${assets.length} | Generado el ${new Date().toLocaleDateString('es-CO')}`,
        margin, y + 14, { width: cw, align: 'center' });

    doc.end();
    return new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  }

  async getAssetPDF(id: string) {
    const a = await this.findOne(id);
    if (!a) throw new Error('Asset not found');

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
    const client = (a as any).client;
    const assetType = (a as any).assetType;
    const maintenance = (a as any).maintenanceRecords || [];

    // Header
    doc.rect(0, 0, pageWidth, 100).fill(white).stroke('#EEEEEE');
    const logoBuffer = await this.fetchImageBuffer(COMPANY.logoUrl);
    if (logoBuffer) {
      try { doc.image(logoBuffer, margin, 15, { height: 60, fit: [160, 60] }); } catch {}
    }
    doc.fillColor(blue).fontSize(8).font('Helvetica')
      .text(COMPANY.address, pageWidth - 210, 20, { width: 165, align: 'right' })
      .text(`Tel: ${COMPANY.phone} | Cel: ${COMPANY.mobile}`, pageWidth - 210, 34, { width: 165, align: 'right' })
      .text(COMPANY.email, pageWidth - 210, 48, { width: 165, align: 'right' })
      .text(COMPANY.web, pageWidth - 210, 62, { width: 165, align: 'right' });

    // Title bar
    doc.rect(0, 100, pageWidth, 32).fill(blue);
    doc.fillColor(white).fontSize(13).font('Helvetica-Bold')
      .text('HOJA DE VIDA — ACTIVO TI', margin, 110, { width: cw, align: 'center' });

    let y = 148;

    // Asset name bar
    doc.rect(margin, y, cw, 28).fill(lightBlue);
    doc.fillColor(white).fontSize(13).font('Helvetica-Bold')
      .text(`${assetType?.name || ''} — ${a.name}`, margin + 8, y + 8, { width: cw - 16 });
    y += 36;

    // Info boxes row 1
    const boxH = 26;
    const col = cw / 3;
    const row1 = [
      ['N° Inventario', a.inventoryCode || '–'],
      ['Serial', a.serialNumber || '–'],
      ['Estado', a.status],
    ];
    row1.forEach(([label, value], i) => {
      const x = margin + i * col;
      doc.rect(x, y, col - 4, boxH).fill(i % 2 === 0 ? lightGray : white).stroke('#CCCCCC');
      doc.fillColor(blue).fontSize(7).font('Helvetica-Bold').text(label.toUpperCase(), x + 6, y + 4, { width: col - 16 });
      doc.fillColor(darkGray).fontSize(9).font('Helvetica').text(String(value), x + 6, y + 14, { width: col - 16 });
    });
    y += boxH + 4;

    const row2 = [
      ['Cliente', client?.businessName || '–'],
      ['Marca / Modelo', `${a.brand || '–'} / ${a.model || '–'}`],
      ['Tipo de activo', assetType?.name || '–'],
    ];
    row2.forEach(([label, value], i) => {
      const x = margin + i * col;
      doc.rect(x, y, col - 4, boxH).fill(i % 2 === 0 ? lightGray : white).stroke('#CCCCCC');
      doc.fillColor(blue).fontSize(7).font('Helvetica-Bold').text(label.toUpperCase(), x + 6, y + 4, { width: col - 16 });
      doc.fillColor(darkGray).fontSize(9).font('Helvetica').text(String(value), x + 6, y + 14, { width: col - 16 });
    });
    y += boxH + 4;

    const row3 = [
      ['Fecha de compra', a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('es-CO') : '–'],
      ['Garantía hasta', a.warrantyUntil ? new Date(a.warrantyUntil).toLocaleDateString('es-CO') : '–'],
      ['Próx. Mantenimiento', a.nextMaintenance ? new Date((a as any).nextMaintenance).toLocaleDateString('es-CO') : '–'],
    ];
    row3.forEach(([label, value], i) => {
      const x = margin + i * col;
      doc.rect(x, y, col - 4, boxH).fill(i % 2 === 0 ? lightGray : white).stroke('#CCCCCC');
      doc.fillColor(blue).fontSize(7).font('Helvetica-Bold').text(label.toUpperCase(), x + 6, y + 4, { width: col - 16 });
      doc.fillColor(darkGray).fontSize(9).font('Helvetica').text(String(value), x + 6, y + 14, { width: col - 16 });
    });
    y += boxH + 10;

    // Section helper
    const section = (title: string) => {
      doc.rect(margin, y, cw, 20).fill(blue);
      doc.fillColor(white).fontSize(9).font('Helvetica-Bold').text(title.toUpperCase(), margin + 8, y + 6, { width: cw });
      y += 26;
    };

    // Network info
    if ((a as any).ipAddress || (a as any).macAddress || (a as any).remoteAccess) {
      section('Red y Acceso Remoto');
      const netCols = [
        ['Dirección IP', (a as any).ipAddress || '–'],
        ['MAC Address', (a as any).macAddress || '–'],
        ['Acceso Remoto', (a as any).remoteAccess || '–'],
      ];
      netCols.forEach(([label, value], i) => {
        const x = margin + i * col;
        doc.rect(x, y, col - 4, boxH).fill(i % 2 === 0 ? lightGray : white).stroke('#CCCCCC');
        doc.fillColor(blue).fontSize(7).font('Helvetica-Bold').text(label.toUpperCase(), x + 6, y + 4, { width: col - 16 });
        doc.fillColor(darkGray).fontSize(9).font('Helvetica').text(String(value), x + 6, y + 14, { width: col - 16 });
      });
      y += boxH + 10;
    }

    // Additional info
    if ((a as any).supplier || (a as any).assignedUser || (a as any).responsible) {
      section('Información Adicional');
      const addCols = [
        ['Proveedor', (a as any).supplier || '–'],
        ['Usuario asignado', (a as any).assignedUser || '–'],
        ['Responsable', (a as any).responsible || '–'],
      ];
      addCols.forEach(([label, value], i) => {
        const x = margin + i * col;
        doc.rect(x, y, col - 4, boxH).fill(i % 2 === 0 ? lightGray : white).stroke('#CCCCCC');
        doc.fillColor(blue).fontSize(7).font('Helvetica-Bold').text(label.toUpperCase(), x + 6, y + 4, { width: col - 16 });
        doc.fillColor(darkGray).fontSize(9).font('Helvetica').text(String(value), x + 6, y + 14, { width: col - 16 });
      });
      y += boxH + 10;
    }

    // Extra fields / Specs
    const extraFields = Array.isArray((a as any).extraFields)
      ? (a as any).extraFields
      : Object.entries((a as any).extraFields || {}).map(([k, v]) => ({ k, v }));
    if (extraFields.length > 0) {
      section('Especificaciones Técnicas Adicionales');
      extraFields.forEach((f: any, fi: number) => {
        const x = margin + (fi % 3) * col;
        if (fi % 3 === 0 && fi > 0) y += boxH + 2;
        if (fi % 3 === 0) {
          // new row
        }
        doc.rect(x, y, col - 4, boxH).fill(fi % 2 === 0 ? lightGray : white).stroke('#CCCCCC');
        doc.fillColor(blue).fontSize(7).font('Helvetica-Bold').text(String(f.k||'').toUpperCase(), x + 6, y + 4, { width: col - 16 });
        doc.fillColor(darkGray).fontSize(9).font('Helvetica').text(String(f.v||'–'), x + 6, y + 14, { width: col - 16 });
        if ((fi + 1) % 3 === 0 || fi === extraFields.length - 1) y += boxH + 4;
      });
      y += 6;
    }

    // Maintenance history
    section('Historial de Mantenimiento');
    if (maintenance.length === 0) {
      doc.rect(margin, y, cw, 24).fill(lightGray);
      doc.fillColor(darkGray).fontSize(9).font('Helvetica')
        .text('Sin registros de mantenimiento', margin + 8, y + 8, { width: cw - 16 });
      y += 30;
    } else {
      // Table header
      const mCols = [
        { label: 'Fecha', w: cw * 0.18 },
        { label: 'Tipo', w: cw * 0.18 },
        { label: 'Técnico', w: cw * 0.22 },
        { label: 'Descripción', w: cw * 0.42 },
      ];
      doc.rect(margin, y, cw, 18).fill(lightBlue);
      let tx = margin;
      mCols.forEach(col => {
        doc.fillColor(white).fontSize(8).font('Helvetica-Bold')
          .text(col.label, tx + 4, y + 5, { width: col.w - 8 });
        tx += col.w;
      });
      y += 18;

      maintenance.forEach((m: any, mi: number) => {
        if (y > 760) {
          doc.addPage();
          y = 50;
          section('Historial de Mantenimiento (continuación)');
        }
        const rowH = 18;
        doc.rect(margin, y, cw, rowH).fill(mi % 2 === 0 ? white : lightGray).stroke('#EEEEEE');
        tx = margin;
        const mVals = [
          new Date(m.createdAt).toLocaleDateString('es-CO'),
          m.type,
          m.technician?.name || '–',
          m.description,
        ];
        mVals.forEach((v, ci) => {
          doc.fillColor(darkGray).fontSize(7.5).font('Helvetica')
            .text(String(v), tx + 4, y + 5, { width: mCols[ci].w - 8, ellipsis: true });
          tx += mCols[ci].w;
        });
        y += rowH;
      });
      y += 8;
    }

    // Footer
    doc.moveTo(margin, Math.max(y + 10, 800)).lineTo(pageWidth - margin, Math.max(y + 10, 800)).stroke('#CCCCCC');
    doc.fillColor(darkGray).fontSize(7)
      .text(`${COMPANY.name} | ${COMPANY.address} | ${COMPANY.phone} | ${COMPANY.email}`,
        margin, Math.max(y + 16, 806), { width: cw, align: 'center' });
    doc.fillColor(darkGray).fontSize(7)
      .text(`Hoja de vida generada el ${new Date().toLocaleDateString('es-CO')}`,
        margin, Math.max(y + 26, 816), { width: cw, align: 'center' });

    doc.end();
    return new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  }
}
