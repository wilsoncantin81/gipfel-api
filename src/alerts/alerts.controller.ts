import { Controller, Get, Put, Param, Query, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
@ApiTags('Alertas') @ApiBearerAuth() @UseGuards(AuthGuard('jwt')) @Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}
  @Get() findAll(@Query() q: any) { return this.service.findAll(q); }
  @Get('unread-count') getCount() { return this.service.getUnreadCount(); }
  @Put('read-all') markAllRead() { return this.service.markAllRead(); }
  @Put(':id/read') markRead(@Param('id') id: string) { return this.service.markRead(id); }
  @Post('generate') generate() { return this.service.generateAlerts(); }
}
