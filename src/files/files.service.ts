import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

const TYPE_MAP: Record<string, string> = {
  asset: 'ASSET', maintenance: 'MAINTENANCE', report: 'REPORT', ticket: 'TICKET',
  ASSET: 'ASSET', MAINTENANCE: 'MAINTENANCE', REPORT: 'REPORT', TICKET: 'TICKET',
};

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  private async uploadToFTP(buffer: Buffer, filename: string): Promise<string> {
    const ftp = require('basic-ftp');
    const { Readable } = require('stream');
    const client = new ftp.Client();
    client.ftp.verbose = false;
    try {
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASS,
        port: 21,
        secure: false,
      });
      const remotePath = process.env.FTP_REMOTE_PATH || '/public_html/grupogipfel.com/imagenes';
      await client.ensureDir(remotePath);
      const stream = Readable.from(buffer);
      await client.uploadFrom(stream, `${remotePath}/${filename}`);
      const baseUrl = process.env.FTP_BASE_URL || 'https://www.grupogipfel.com/imagenes';
      return `${baseUrl}/${filename}`;
    } finally {
      client.close();
    }
  }

  async saveFile(entityType: string, entityId: string, file: Express.Multer.File) {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${entityType}_${entityId}_${timestamp}_${safeName}`;
    const url = await this.uploadToFTP(file.buffer, filename);
    const mappedType = TYPE_MAP[entityType] || 'ASSET';
    return this.prisma.attachment.create({
      data: {
        entityType: mappedType as any,
        entityId,
        filename: file.originalname,
        url,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  }

  async getFiles(entityType: string, entityId: string) {
    const mappedType = TYPE_MAP[entityType] || 'ASSET';
    return this.prisma.attachment.findMany({ where: { entityType: mappedType as any, entityId } });
  }

  async deleteFile(id: string) {
    const file = await this.prisma.attachment.findUnique({ where: { id } });
    if (file) {
      await this.prisma.attachment.delete({ where: { id } });
    }
    return { deleted: true };
  }
}
