import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async generateAlerts() {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 86400000);
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const [warrantyAssets, maintAssets] = await Promise.all([
      this.prisma.asset.findMany({ where: { warrantyUntil: { lte: in90 }, status: 'ACTIVO' } }),
      this.prisma.asset.findMany({ where: { nextMaintenance: { lte: in30 }, status: 'ACTIVO' } }),
    ]);
    let created = 0;
    for (const a of warrantyAssets) {
      const ex = await this.prisma.alert.findFirst({ where: { assetId: a.id, type: 'GARANTIA', isRead: false } });
      if (!ex) { await this.prisma.alert.create({ data: { assetId: a.id, clientId: a.clientId, type: 'GARANTIA', message: `Garantía de "${a.name}" vence el ${a.warrantyUntil?.toLocaleDateString('es-CO')}`, dueDate: a.warrantyUntil } }); created++; }
    }
    for (const a of maintAssets) {
      const ex = await this.prisma.alert.findFirst({ where: { assetId: a.id, type: 'MANTENIMIENTO', isRead: false } });
      if (!ex) { await this.prisma.alert.create({ data: { assetId: a.id, clientId: a.clientId, type: 'MANTENIMIENTO', message: `Mantenimiento de "${a.name}" programado para ${a.nextMaintenance?.toLocaleDateString('es-CO')}`, dueDate: a.nextMaintenance } }); created++; }
    }
    return { alertsCreated: created };
  }

  async findAll(query: any) {
    const where: any = {};
    if (query.clientId) where.clientId = query.clientId;
    if (query.isRead !== undefined) where.isRead = query.isRead === 'true';
    if (query.type) where.type = query.type;
    return this.prisma.alert.findMany({ where, orderBy: { createdAt: 'desc' }, include: { asset: true, client: true } });
  }

  async markRead(id: string) { return this.prisma.alert.update({ where: { id }, data: { isRead: true } }); }
  async markAllRead() { return this.prisma.alert.updateMany({ where: { isRead: false }, data: { isRead: true } }); }
  async getUnreadCount() { return { count: await this.prisma.alert.count({ where: { isRead: false } }) }; }
}
