import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
 
@Injectable()
export class AssetTypesService {
  constructor(private prisma: PrismaService) {}
 
  findAll() {
    return this.prisma.assetType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { assets: true } } },
    });
  }
 
  create(dto: any) {
    const { name, icon, description } = dto;
    return this.prisma.assetType.create({ data: { name, icon, description } });
  }
 
  update(id: string, dto: any) {
    const { name, icon, description } = dto;
    return this.prisma.assetType.update({ where: { id }, data: { name, icon, description } });
  }
 
  remove(id: string) {
    return this.prisma.assetType.update({ where: { id }, data: { isActive: false } });
  }
}
