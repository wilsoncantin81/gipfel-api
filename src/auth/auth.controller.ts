import { Controller, Post, Body, Get, UseGuards, Request, HttpCode } from '@nestjs/common';
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

  @Post('register') @UseGuards(AuthGuard('jwt')) @ApiBearerAuth()
  register(@Body() body: any) { return this.auth.register(body); }

  @Get('me') @UseGuards(AuthGuard('jwt')) @ApiBearerAuth()
  profile(@Request() req: any) { return this.auth.getProfile(req.user.sub); }
}
