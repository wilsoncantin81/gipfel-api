import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(q: any) {
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.search) where.businessName = { contains: q.search, mode: 'insensitive' };
    return this.prisma.client.findMany({
      where,
      include: { _count: { select: { assets: true, tickets: true } } },
      orderBy: { businessName: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.client.findUnique({ where: { id }, include: { assets: { include: { assetType: true } } } });
  }

  async getStats(id: string) {
    const [totalAssets, activeAssets, openTickets, totalReports] = await Promise.all([
      this.prisma.asset.count({ where: { clientId: id } }),
      this.prisma.asset.count({ where: { clientId: id, status: 'ACTIVO' } }),
      this.prisma.ticket.count({ where: { clientId: id, status: { not: 'CERRADO' } } }),
      this.prisma.serviceReport.count({ where: { clientId: id } }),
    ]);
    return { totalAssets, activeAssets, openTickets, totalReports };
  }

  async create(dto: any) {
    return this.prisma.client.create({ data: dto });
  }

  async update(id: string, dto: any) {
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.client.delete({ where: { id } });
    return { deleted: true };
  }

  async updateLogo(id: string, logoUrl: string) {
    return this.prisma.client.update({ where: { id }, data: { logoUrl } });
  }

  async getTechnicians() {
    return this.prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } });
  }
}
