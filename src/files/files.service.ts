import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

const TYPE_MAP: Record<string, string> = {
  asset: 'ASSET', maintenance: 'MAINTENANCE', report: 'REPORT', ticket: 'TICKET',
  ASSET: 'ASSET', MAINTENANCE: 'MAINTENANCE', REPORT: 'REPORT', TICKET: 'TICKET',
};

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  async saveFile(entityType: string, entityId: string, file: Express.Multer.File) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filename = `${Date.now()}-${file.originalname}`;
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, file.buffer);
    const mappedType = TYPE_MAP[entityType] || 'ASSET';
    return this.prisma.attachment.create({
      data: { entityType: mappedType as any, entityId, filename: file.originalname, url: `/uploads/${filename}`, mimeType: file.mimetype, size: file.size },
    });
  }

  async getFiles(entityType: string, entityId: string) {
    const mappedType = TYPE_MAP[entityType] || 'ASSET';
    return this.prisma.attachment.findMany({ where: { entityType: mappedType as any, entityId } });
  }

  async deleteFile(id: string) {
    const file = await this.prisma.attachment.findUnique({ where: { id } });
    if (file) {
      const filepath = path.join(process.cwd(), file.url);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      await this.prisma.attachment.delete({ where: { id } });
    }
    return { deleted: true };
  }
}
