import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getKPIs() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const in90 = new Date(now.getTime() + 90*86400000);
    const in30 = new Date(now.getTime() + 30*86400000);
    const [totalClients, activeClients, totalAssets, activeAssets,
      openTickets, criticalTickets, pendingWilson,
      reportsThisMonth, warrantyExpiring, maintDue, unreadAlerts,
      salesThisMonth, pendingCommissions] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.client.count({ where: { status: 'ACTIVO' } }),
      this.prisma.asset.count(),
      this.prisma.asset.count({ where: { status: 'ACTIVO' } }),
      this.prisma.ticket.count({ where: { status: { not: 'CERRADO' } } }),
      this.prisma.ticket.count({ where: { status: { not: 'CERRADO' }, priority: 'CRITICA' } }),
      this.prisma.ticket.count({ where: { status: 'PENDIENTE_WILSON' } }),
      this.prisma.serviceReport.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.asset.count({ where: { warrantyUntil: { lte: in90, gte: now }, status: 'ACTIVO' } }),
      this.prisma.asset.count({ where: { nextMaintenance: { lte: in30, gte: now }, status: 'ACTIVO' } }),
      this.prisma.alert.count({ where: { isRead: false } }),
      this.prisma.ticket.aggregate({ where: { status: 'CERRADO', resolvedAt: { gte: startOfMonth } }, _sum: { salePrice: true, utility: true } }),
      this.prisma.commission.aggregate({ where: { status: 'PENDIENTE' }, _sum: { amount: true } }),
    ]);
    // Count tickets by status
    const statuses = ['NUEVO','EN_EJECUCION','POR_CONFIRMACION','PENDIENTE_WILSON','POR_FACTURACION','CERRADO'];
    const statusCounts = await Promise.all(
      statuses.map(s => this.prisma.ticket.count({ where: { status: s as any } }))
    );
    const ticketsByStatus: Record<string,number> = {};
    statuses.forEach((s, i) => { ticketsByStatus[s] = statusCounts[i]; });

    return {
      clients: { total: totalClients, active: activeClients },
      assets: { total: totalAssets, active: activeAssets },
      tickets: { open: openTickets, critical: criticalTickets, pendingWilson },
      reports: { thisMonth: reportsThisMonth },
      alerts: { warrantyExpiring, maintenanceDue: maintDue, unread: unreadAlerts },
      financials: {
        salesThisMonth: salesThisMonth._sum.salePrice || 0,
        utilityThisMonth: salesThisMonth._sum.utility || 0,
        pendingCommissions: pendingCommissions._sum.amount || 0,
      },
      ticketsByStatus,
    };
  }

  async getRecentActivity(limit = 10) {
    return this.prisma.maintenanceRecord.findMany({
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { asset: { include: { client: true, assetType: true } }, technician: { select: { name: true } } },
    });
  }

  async getWarrantyExpiring() {
    const in90 = new Date(Date.now() + 90*86400000);
    return this.prisma.asset.findMany({
      where: { warrantyUntil: { lte: in90 }, status: 'ACTIVO' },
      include: { client: { select: { businessName: true } }, assetType: true },
      orderBy: { warrantyUntil: 'asc' },
    });
  }

  async getMaintenanceDue() {
    const in30 = new Date(Date.now() + 30*86400000);
    return this.prisma.asset.findMany({
      where: { nextMaintenance: { lte: in30 }, status: 'ACTIVO' },
      include: { client: { select: { businessName: true } }, assetType: true },
      orderBy: { nextMaintenance: 'asc' },
    });
  }

  async getAssetsByType() {
    return this.prisma.assetType.findMany({
      where: { isActive: true },
      include: { _count: { select: { assets: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getAssetsByClient() {
    const c = await this.prisma.client.findMany({
      where: { status: 'ACTIVO' },
      include: { _count: { select: { assets: true } } },
      orderBy: { businessName: 'asc' },
    });
    return c.map(x => ({ id: x.id, name: x.businessName, count: x._count.assets }));
  }

  async getTechnicians() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  async getFinancialSummary(query: any) {
    const where: any = { status: 'CERRADO' };
    if (query.from) where.resolvedAt = { ...where.resolvedAt, gte: new Date(query.from) };
    if (query.to) where.resolvedAt = { ...where.resolvedAt, lte: new Date(query.to) };
    if (query.technicianId) where.assignedToId = query.technicianId;
    const tickets = await this.prisma.ticket.findMany({
      where,
      include: { client: true, assignedTo: { select: { id: true, name: true } }, commission: true },
      orderBy: { resolvedAt: 'desc' },
    });
    const totalSales = tickets.reduce((s, t) => s + (t.salePrice || 0), 0);
    const totalCosts = tickets.reduce((s, t) => s + (t.totalCost || 0), 0);
    const totalUtility = tickets.reduce((s, t) => s + (t.utility || 0), 0);
    const totalCommissions = tickets.reduce((s, t) => s + (t.commission?.amount || 0), 0);
    return { tickets, totalSales, totalCosts, totalUtility, totalCommissions, count: tickets.length };
  }

  async getCommissions(query: any) {
    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;
    const commissions = await this.prisma.commission.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } }, ticket: { include: { client: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const totalPending = commissions.filter(c => c.status === 'PENDIENTE').reduce((s, c) => s + c.amount, 0);
    const totalPaid = commissions.filter(c => c.status === 'PAGADA').reduce((s, c) => s + c.amount, 0);
    return { commissions, totalPending, totalPaid };
  }

  async payCommission(id: string, notes?: string) {
    return this.prisma.commission.update({
      where: { id },
      data: { status: 'PAGADA', paidAt: new Date(), notes },
    });
  }

  async exportFinancials(query: any) {
    const { tickets } = await this.getFinancialSummary(query);
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Financiero');
    ws.columns = [
      { header: 'Ticket', key: 'num', width: 14 },
      { header: 'Cliente', key: 'client', width: 30 },
      { header: 'Técnico', key: 'tech', width: 25 },
      { header: 'Fecha cierre', key: 'date', width: 14 },
      { header: 'N° Factura', key: 'invoice', width: 16 },
      { header: 'Venta', key: 'sale', width: 14 },
      { header: 'Costos', key: 'cost', width: 14 },
      { header: 'Utilidad', key: 'utility', width: 14 },
      { header: 'Comisión', key: 'commission', width: 14 },
      { header: 'Estado comisión', key: 'commStatus', width: 18 },
    ];
    ws.getRow(1).font = { bold: true };
    tickets.forEach((t: any) => ws.addRow({
      num: t.ticketNumber, client: t.client?.businessName || '',
      tech: t.assignedTo?.name || '',
      date: t.resolvedAt ? new Date(t.resolvedAt).toLocaleDateString('es-CO') : '',
      invoice: t.invoiceNumber || '', sale: t.salePrice || 0,
      cost: t.totalCost || 0, utility: t.utility || 0,
      commission: t.commission?.amount || 0, commStatus: t.commission?.status || 'N/A',
    }));
    return wb.xlsx.writeBuffer();
  }
}
