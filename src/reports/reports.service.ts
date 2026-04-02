import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

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
    const { assetIds, observations, conclusion, timeUsed, signatureUrl, ...data } = dto;
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

  async getPDF(id: string) {
    const rpt = await this.findOne(id);
    if (!rpt) throw new Error('Report not found');
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.fontSize(20).text('Reporte de Servicio', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`N° Reporte: ${rpt.reportNumber}`);
    doc.text(`Fecha: ${new Date(rpt.date).toLocaleDateString('es-CO')}`);
    doc.text(`Cliente: ${(rpt as any).client?.businessName || ''}`);
    doc.text(`Técnico: ${(rpt as any).technician?.name || ''}`);
    doc.moveDown();
    doc.text(`Descripción: ${rpt.description}`);
    if (rpt.workDone) doc.text(`Trabajo realizado: ${rpt.workDone}`);
    if (rpt.recommendations) doc.text(`Recomendaciones: ${rpt.recommendations}`);
    doc.end();
    return new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  }

  async sendEmail(id: string) {
    const rpt = await this.findOne(id);
    if (!rpt) throw new Error('Report not found');
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });
    const client = (rpt as any).client;
    if (!client?.email) throw new Error('Cliente sin email');
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: client.email,
      subject: `Reporte de Servicio ${rpt.reportNumber}`,
      html: `<h2>Reporte ${rpt.reportNumber}</h2><p>Fecha: ${new Date(rpt.date).toLocaleDateString('es-CO')}</p><p>${rpt.description}</p>`,
    });
    await this.prisma.serviceReport.update({ where: { id }, data: { emailSent: true } });
    return { sent: true };
  }
}
