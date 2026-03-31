import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Res, Header } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get() findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename=mantenimientos.xlsx')
  async exportExcel(@Query() q: any, @Res() res: Response) { res.send(await this.service.exportExcel(q)); }

  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
