import { Controller, Get, Post, Param, Body, Query, UseGuards, Res, Header } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get() findAll(@Query() q: any) { return this.service.findAll(q || {}); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Post(':id/signature') saveSignature(@Param('id') id: string, @Body() body: any) { return this.service.saveSignature(id, body.signature); }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=reporte.pdf')
  async getPDF(@Param('id') id: string, @Res() res: Response) { res.send(await this.service.getPDF(id)); }

  @Post(':id/send') sendEmail(@Param('id') id: string) { return this.service.sendEmail(id); }
}
