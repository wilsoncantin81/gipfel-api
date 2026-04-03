import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcrypt';

const ALL_MODULES = ['dashboard','clientes','activos','mantenimiento','reportes','tickets','tipos','usuarios','financiero','comisiones'];

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Credenciales inválidas');
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Credenciales inválidas');
    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const fullUser = await this.prisma.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, email: true, role: true, permissions: true } });
    const permissions = (fullUser?.permissions as string[]) || ALL_MODULES;
    return { 
      access_token: this.jwt.sign(payload), 
      user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions }
    };
  }

  async register(dto: any) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Correo ya registrado');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({ 
      data: { name: dto.name, email: dto.email, passwordHash, role: dto.role || 'TECNICO', permissions: ALL_MODULES as any }
    });
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({ 
      where: { id: userId }, 
      select: { id: true, name: true, email: true, role: true, isActive: true, permissions: true }
    });
  }

  async getUsers() {
    return this.prisma.user.findMany({ 
      select: { id: true, name: true, email: true, role: true, isActive: true, permissions: true },
      orderBy: { name: 'asc' }
    });
  }

  async getTechnicians() {
    return this.prisma.user.findMany({ 
      where: { isActive: true }, 
      select: { id: true, name: true, email: true, role: true }, 
      orderBy: { name: 'asc' }
    });
  }

  async updatePermissions(id: string, permissions: string[]) {
    return this.prisma.user.update({ where: { id }, data: { permissions: permissions as any } });
  }

  async resetPassword(id: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { success: true };
  }

  async updateStatus(id: string, isActive: boolean) {
    return this.prisma.user.update({ where: { id }, data: { isActive } });
  }
}
