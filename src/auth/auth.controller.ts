import { Controller, Post, Body, Get, Put, UseGuards, Request, HttpCode, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login') @HttpCode(200) @UseGuards(AuthGuard('local'))
  login(@Request() req: any) { return this.auth.login(req.user); }

  @Get('technicians') @UseGuards(AuthGuard('jwt')) @ApiBearerAuth()
  technicians() { return this.auth.getTechnicians(); }

  @Get('users') @UseGuards(AuthGuard('jwt')) @ApiBearerAuth()
  getUsers() { return this.auth.getUsers(); }

  @Post('register') @UseGuards(AuthGuard('jwt')) @ApiBearerAuth()
  register(@Body() body: any) { return this.auth.register(body); }

  @Put('users/:id/permissions') @UseGuards(AuthGuard('jwt')) @ApiBearerAuth()
  updatePermissions(@Param('id') id: string, @Body() body: any) { return this.auth.updatePermissions(id, body.permissions); }

  @Put('users/:id/password') @UseGuards(AuthGuard('jwt')) @ApiBearerAuth()
  resetPassword(@Param('id') id: string, @Body() body: any) { return this.auth.resetPassword(id, body.password); }

  @Put('users/:id/status') @UseGuards(AuthGuard('jwt')) @ApiBearerAuth()
  updateStatus(@Param('id') id: string, @Body() body: any) { return this.auth.updateStatus(id, body.isActive); }

  @Get('me') @UseGuards(AuthGuard('jwt')) @ApiBearerAuth()
  profile(@Request() req: any) { return this.auth.getProfile(req.user.sub); }
}
