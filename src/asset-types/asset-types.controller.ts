import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AssetTypesService } from './asset-types.service';
@ApiTags('Tipos de Activo') @ApiBearerAuth() @UseGuards(AuthGuard('jwt')) @Controller('asset-types')
export class AssetTypesController {
  constructor(private readonly service: AssetTypesService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
