import { Controller, Post, Get, Delete, Param, UseGuards, UseInterceptors, UploadedFiles, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Post(':entityType/:entityId')
  @UseInterceptors(FilesInterceptor('files'))
  upload(@Param('entityType') et: string, @Param('entityId') eid: string, @UploadedFiles() files: Express.Multer.File[]) {
    return Promise.all(files.map(f => this.service.saveFile(et, eid, f)));
  }

  @Get(':entityType/:entityId')
  getFiles(@Param('entityType') et: string, @Param('entityId') eid: string) {
    return this.service.getFiles(et, eid);
  }

  @Delete(':id')
  deleteFile(@Param('id') id: string) { return this.service.deleteFile(id); }
}
