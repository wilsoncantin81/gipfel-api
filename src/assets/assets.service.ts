import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(q: any) {
    const where: any = {};
    if (q.clientId) where.clientId = q.clientId;
    if (q.status) where.status = q.status;
    if (q.assetTypeId) where.assetTypeId = q.assetTypeId;
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
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
      name: dto.name,
      clientId: dto.clientId,
      assetTypeId: dto.assetTypeId,
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
      extraFields: dto.extraFields || undefined,
      dynFields: dto.dynFields || undefined,
    };
  }

  async create(dto: any) {
    const data = this.sanitize(dto);
    return this.prisma.asset.create({ data, include: { client: true, assetType: true } });
  }

  async update(id: string, dto: any) {
    const data = this.sanitize(dto);
    delete data.clientId;
    delete data.assetTypeId;
    return this.prisma.asset.update({ where: { id }, data, include: { client: true, assetType: true } });
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

  async exportExcel() {
    const assets = await this.prisma.asset.findMany({
      include: { client: { select: { businessName: true } }, assetType: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Activos');
    ws.columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Tipo', key: 'type', width: 20 },
      { header: 'Cliente', key: 'client', width: 30 },
      { header: 'Marca', key: 'brand', width: 15 },
      { header: 'Modelo', key: 'model', width: 15 },
      { header: 'Serial', key: 'serial', width: 20 },
      { header: 'Código', key: 'code', width: 18 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Ubicación', key: 'location', width: 20 },
      { header: 'IP', key: 'ip', width: 15 },
    ];
    ws.getRow(1).font = { bold: true };
    assets.forEach((a: any) => ws.addRow({
      name: a.name, type: a.assetType?.name || '', client: a.client?.businessName || '',
      brand: a.brand || '', model: a.model || '', serial: a.serialNumber || '',
      code: a.inventoryCode || '', status: a.status, location: a.location || '',
      ip: a.ipAddress || '',
    }));
    return wb.xlsx.writeBuffer();
  }
}
