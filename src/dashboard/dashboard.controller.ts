import { Controller, Get, Put, Param, Body, Query, UseGuards, Res, Header } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('kpis') getKPIs() { return this.service.getKPIs(); }
  @Get('activity') getActivity(@Query('limit') limit: string) { return this.service.getRecentActivity(Number(limit) || 10); }
  @Get('warranty-expiring') getWarranty() { return this.service.getWarrantyExpiring(); }
  @Get('maintenance-due') getMaintenance() { return this.service.getMaintenanceDue(); }
  @Get('assets-by-type') getByType() { return this.service.getAssetsByType(); }
  @Get('assets-by-client') getByClient() { return this.service.getAssetsByClient(); }
  @Get('technicians') getTechnicians() { return this.service.getTechnicians(); }
  @Get('financials/summary') getFinancialSummary(@Query() q: any) { return this.service.getFinancialSummary(q); }
  @Get('financials/commissions') getCommissions(@Query() q: any) { return this.service.getCommissions(q); }

  @Put('financials/commissions/:id/pay')
  payCommission(@Param('id') id: string, @Body() body: any) { return this.service.payCommission(id, body?.notes); }

  @Get('financials/export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename=financiero.xlsx')
  async exportFinancials(@Query() q: any, @Res() res: Response) {
    res.send(await this.service.exportFinancials(q));
  }
}
