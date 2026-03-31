import { Controller, Post, Get, Delete, Param, UseInterceptors, UploadedFiles, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FilesService } from './files.service';
@ApiTags('Archivos') @ApiBearerAuth() @UseGuards(AuthGuard('jwt')) @Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}
  @Post(':entityType/:entityId')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  async upload(@Param('entityType') et: string, @Param('entityId') eid: string, @UploadedFiles() files: Express.Multer.File[], @Request() req: any) {
    return Promise.all(files.map(f => this.service.uploadFile(f, et, eid, req.user?.sub)));
  }
  @Get(':entityType/:entityId')
  getFiles(@Param('entityType') et: string, @Param('entityId') eid: string) { return this.service.getFiles(et, eid); }
  @Delete(':id')
  deleteFile(@Param('id') id: string) { return this.service.deleteFile(id); }
}
