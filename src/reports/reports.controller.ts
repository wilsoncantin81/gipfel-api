import { Controller, Get, Post, Param, Body, Query, UseGuards, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
@ApiTags('Reportes') @ApiBearerAuth() @UseGuards(AuthGuard('jwt')) @Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get() findAll(@Query() q: any) { return this.service.findAll(q); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Post(':id/signature') saveSignature(@Param('id') id: string, @Body() body: any) { return this.service.saveSignature(id, body.signatureUrl); }
  @Get(':id/pdf') async pdf(@Param('id') id: string, @Res() res: Response) {
    const r = await this.service.findOne(id);
    res.setHeader('Content-Type','text/html');
    res.setHeader('Content-Disposition',`attachment; filename="${r.reportNumber}.html"`);
    res.send(this.service.buildHtml(r));
  }
  @Post(':id/send') sendEmail(@Param('id') id: string) { return this.service.sendByEmail(id); }
}
