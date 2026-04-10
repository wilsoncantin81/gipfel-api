import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('tickets')
export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  @Get() findAll(@Query() q: any) { return this.service.findAll(q); }
  @Get('tasks/:taskId') getTask(@Param('taskId') id: string) { return this.service.getTask(id); }
  @Get(':id/expenses/summary') getExpenseSummary(@Param('id') id: string) { return this.service.getExpenseSummary(id); }
  @Get(':id/status-logs') getStatusLogs(@Param('id') id: string) { return this.service.getStatusLogs(id); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: any, @Request() req: any) { return this.service.create({ ...dto, userId: req.user?.sub }); }
  @Post(':id/tasks') addTask(@Param('id') id: string, @Body() body: any) { return this.service.addTask(id, body.title); }
  @Post(':id/expenses') addExpense(@Param('id') id: string, @Body() dto: any) { return this.service.addExpense(id, dto); }
  @Put(':id/status') updateStatus(@Param('id') id: string, @Body() body: any, @Request() req: any) { return this.service.updateStatus(id, body, req.user?.sub); }
  @Put(':id/billing') updateBilling(@Param('id') id: string, @Body() body: any) { return this.service.updateBilling(id, body); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Put('tasks/:taskId/toggle') toggleTask(@Param('taskId') id: string) { return this.service.toggleTask(id); }
  @Delete('tasks/:taskId') deleteTask(@Param('taskId') id: string) { return this.service.deleteTask(id); }
  @Delete('expenses/:expenseId') deleteExpense(@Param('expenseId') id: string) { return this.service.deleteExpense(id); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
