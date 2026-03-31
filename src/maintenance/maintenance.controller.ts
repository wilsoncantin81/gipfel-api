import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Res, Header } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { MaintenanceService } from './maintenance.service';
@ApiTags('Mantenimiento') @ApiBearerAuth() @UseGuards(AuthGuard('jwt')) @Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}
  @Get() findAll(@Query() q: any) { return this.service.findAll(q); }
  @Get('asset/:assetId') findByAsset(@Param('assetId') id: string) { return this.service.findByAsset(id); }
  @Get('export') @Header('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') @Header('Content-Disposition','attachment; filename=mantenimiento.xlsx')
  async export(@Query() q: any, @Res() res: Response) { res.send(await this.service.exportExcel(q)); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
