import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Res, Header } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AssetsService } from './assets.service';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('assets')
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get() findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename=activos.xlsx')
  async exportExcel(@Query() q: any, @Res() res: Response) { res.send(await this.service.exportExcel(q)); }

  @Get('export-pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=activos.pdf')
  async exportPDF(@Query() q: any, @Res() res: Response) { res.send(await this.service.exportPDF(q)); }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=hoja-vida.pdf')
  async getAssetPDF(@Param('id') id: string, @Res() res: Response) { res.send(await this.service.getAssetPDF(id)); }

  @Get(':id/qr') getQR(@Param('id') id: string) { return this.service.getQR(id); }
  @Get(':id/password') getPassword(@Param('id') id: string) { return this.service.getPassword(id); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
