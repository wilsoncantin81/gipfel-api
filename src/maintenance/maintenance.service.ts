import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async findAll(q: any) {
    const where: any = {};
    if (q.assetId) where.assetId = q.assetId;
    if (q.technicianId) where.technicianId = q.technicianId;
    if (q.type) where.type = q.type;
    return this.prisma.maintenanceRecord.findMany({
      where,
      include: {
        asset: { include: { client: true, assetType: true } },
        technician: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: any) {
    const { assetId, technicianId, type, description, findings, nextDate, cost, workDone, date } = dto;
    const record = await this.prisma.maintenanceRecord.create({
      data: {
        assetId,
        technicianId: technicianId || undefined,
        type,
        description: description || workDone || 'Mantenimiento',
        findings: findings || workDone || undefined,
        nextDate: nextDate ? new Date(nextDate) : undefined,
        cost: cost ? Number(cost) : undefined,
      },
      include: { asset: true, technician: { select: { id: true, name: true } } },
    });
    if (nextDate) {
      await this.prisma.asset.update({ where: { id: assetId }, data: { nextMaintenance: new Date(nextDate) } });
    }
    return record;
  }

  async remove(id: string) {
    await this.prisma.maintenanceRecord.delete({ where: { id } });
    return { deleted: true };
  }

  async exportExcel(q: any) {
    const where: any = {};
    if (q.assetId) where.assetId = q.assetId;
    const records = await this.prisma.maintenanceRecord.findMany({
      where,
      include: { asset: { include: { client: true } }, technician: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Mantenimientos');
    ws.columns = [
      { header: 'Fecha', key: 'date', width: 14 },
      { header: 'Activo', key: 'asset', width: 30 },
      { header: 'Cliente', key: 'client', width: 30 },
      { header: 'Tipo', key: 'type', width: 16 },
      { header: 'Descripción', key: 'desc', width: 40 },
      { header: 'Técnico', key: 'tech', width: 25 },
      { header: 'Costo', key: 'cost', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    records.forEach((r: any) => ws.addRow({
      date: r.createdAt.toLocaleDateString('es-CO'),
      asset: r.asset?.name || '',
      client: r.asset?.client?.businessName || '',
      type: r.type,
      desc: r.description,
      tech: r.technician?.name || '',
      cost: r.cost || 0,
    }));
    return wb.xlsx.writeBuffer();
  }
}
