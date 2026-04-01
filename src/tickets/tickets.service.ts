import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async findAll(q: any) {
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.clientId) where.clientId = q.clientId;
    if (q.assignedToId) where.assignedToId = q.assignedToId;
    if (q.priority) where.priority = q.priority;
    return this.prisma.ticket.findMany({
      where,
      include: {
        client: { select: { id: true, businessName: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { tasks: true, expenses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: {
        client: true,
        asset: { include: { assetType: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        report: { select: { id: true, reportNumber: true, date: true } },
        tasks: { orderBy: { order: 'asc' } },
        expenses: { orderBy: { date: 'asc' } },
        commission: { include: { user: { select: { id: true, name: true } } } },
      },
    });
  }

  async getTask(id: string) {
    return this.prisma.ticketTask.findUnique({ where: { id } });
  }

  async getExpenseSummary(id: string) {
    const [expenses, ticket] = await Promise.all([
      this.prisma.ticketExpense.findMany({ where: { ticketId: id } }),
      this.prisma.ticket.findUnique({ where: { id } }),
    ]);
    const totalCost = expenses.reduce((s, e) => s + e.total, 0);
    const salePrice = ticket?.salePrice || 0;
    const utility = salePrice - totalCost;
    return { expenses, totalCost, salePrice, utility, commission: utility * 0.1 };
  }

  async create(dto: any) {
    const count = await this.prisma.ticket.count();
    const ticketNumber = `TKT-${String(count + 1).padStart(5, '0')}`;
    const { tasks, ...rest } = dto;
    const data: any = {
      ticketNumber,
      clientId: rest.clientId,
      title: rest.title,
      description: rest.description || undefined,
      priority: rest.priority || 'MEDIA',
      status: 'NUEVO',
      assetId: rest.assetId || undefined,
      assignedToId: rest.assignedToId || undefined,
    };
    if (tasks && tasks.length > 0) {
      data.tasks = { create: tasks.map((title: string, i: number) => ({ title, order: i })) };
    }
    return this.prisma.ticket.create({ data, include: { client: true } });
  }

  async update(id: string, dto: any) {
    return this.prisma.ticket.update({ where: { id }, data: dto });
  }

  async updateStatus(id: string, body: any) {
    const { status, conclusion, invoiceNumber, salePrice } = body;
    
    if (status === 'CERRADO') {
      const ticket = await this.prisma.ticket.findUnique({ where: { id } });
      if (!ticket?.invoiceNumber && !invoiceNumber) {
        throw new BadRequestException('Se requiere número de factura para cerrar el ticket');
      }
      if (!ticket?.salePrice && !salePrice) {
        throw new BadRequestException('Se requiere precio de venta para cerrar el ticket');
      }
    }

    const data: any = { status };
    if (conclusion) data.conclusion = conclusion;
    if (invoiceNumber) data.invoiceNumber = invoiceNumber;
    if (salePrice !== undefined) data.salePrice = salePrice;
    if (status === 'CERRADO') {
      data.resolvedAt = new Date();
      const ticket = await this.prisma.ticket.findUnique({ where: { id } });
      const finalSalePrice = salePrice || ticket?.salePrice || 0;
      const finalCost = ticket?.totalCost || 0;
      const utility = finalSalePrice - finalCost;
      data.utility = utility;
      
      if (ticket?.assignedToId && utility > 0) {
        await this.prisma.commission.upsert({
          where: { ticketId: id },
          create: { ticketId: id, userId: ticket.assignedToId, amount: utility * 0.1, percentage: 10 },
          update: { amount: utility * 0.1 },
        });
      }
    }

    return this.prisma.ticket.update({ where: { id }, data });
  }

  async updateBilling(id: string, body: any) {
    const { invoiceNumber, salePrice, conclusion } = body;
    const data: any = {};
    if (invoiceNumber !== undefined) data.invoiceNumber = invoiceNumber;
    if (salePrice !== undefined) {
      data.salePrice = salePrice;
      const expenses = await this.prisma.ticketExpense.findMany({ where: { ticketId: id } });
      const totalCost = expenses.reduce((s, e) => s + e.total, 0);
      data.totalCost = totalCost;
      data.utility = salePrice - totalCost;
    }
    if (conclusion !== undefined) data.conclusion = conclusion;
    return this.prisma.ticket.update({ where: { id }, data });
  }

  async addTask(ticketId: string, title: string) {
    const count = await this.prisma.ticketTask.count({ where: { ticketId } });
    return this.prisma.ticketTask.create({ data: { ticketId, title, order: count } });
  }

  async toggleTask(id: string) {
    const task = await this.prisma.ticketTask.findUnique({ where: { id } });
    if (!task) throw new BadRequestException('Tarea no encontrada');
    return this.prisma.ticketTask.update({ where: { id }, data: { done: !task.done } });
  }

  async deleteTask(id: string) {
    await this.prisma.ticketTask.delete({ where: { id } });
    return { deleted: true };
  }

  async addExpense(ticketId: string, dto: any) {
    const qty = Number(dto.quantity) || 1;
    const price = Number(dto.unitPrice);
    const total = qty * price;
    const expense = await this.prisma.ticketExpense.create({
      data: { ticketId, date: new Date(dto.date), description: dto.description, supplier: dto.supplier, supplierInvoice: dto.supplierInvoice, quantity: qty, unitPrice: price, total },
    });
    const allExpenses = await this.prisma.ticketExpense.findMany({ where: { ticketId } });
    const totalCost = allExpenses.reduce((s, e) => s + e.total, 0);
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    const utility = (ticket?.salePrice || 0) - totalCost;
    await this.prisma.ticket.update({ where: { id: ticketId }, data: { totalCost, utility } });
    return expense;
  }

  async deleteExpense(id: string) {
    const expense = await this.prisma.ticketExpense.findUnique({ where: { id } });
    if (!expense) throw new BadRequestException('Gasto no encontrado');
    await this.prisma.ticketExpense.delete({ where: { id } });
    const allExpenses = await this.prisma.ticketExpense.findMany({ where: { ticketId: expense.ticketId } });
    const totalCost = allExpenses.reduce((s, e) => s + e.total, 0);
    const ticket = await this.prisma.ticket.findUnique({ where: { id: expense.ticketId } });
    const utility = (ticket?.salePrice || 0) - totalCost;
    await this.prisma.ticket.update({ where: { id: expense.ticketId }, data: { totalCost, utility } });
    return { deleted: true };
  }

  async remove(id: string) {
    await this.prisma.ticket.delete({ where: { id } });
    return { deleted: true };
  }
}
