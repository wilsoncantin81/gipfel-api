import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
@ApiTags('Clientes') @ApiBearerAuth() @UseGuards(AuthGuard('jwt')) @Controller('clients')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}
  @Get() findAll(@Query() q: any) { return this.service.findAll(q); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Get(':id/stats') getStats(@Param('id') id: string) { return this.service.getStats(id); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
  @Put(':id/logo') updateLogo(@Param('id') id: string, @Body() body: any) { return this.service.updateLogo(id, body.logoUrl); }
}
