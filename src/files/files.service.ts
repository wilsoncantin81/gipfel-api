import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  async saveFile(entityType: string, entityId: string, file: Express.Multer.File) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filename = `${Date.now()}-${file.originalname}`;
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, file.buffer);
    return this.prisma.attachment.create({
      data: { entityType: entityType as any, entityId, filename: file.originalname, url: `/uploads/${filename}`, mimeType: file.mimetype, size: file.size },
    });
  }

  async getFiles(entityType: string, entityId: string) {
    return this.prisma.attachment.findMany({ where: { entityType: entityType as any, entityId } });
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
