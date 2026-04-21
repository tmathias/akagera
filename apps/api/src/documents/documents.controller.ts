import {
  Controller, Get, Post, Delete, Param, Query, Req,
  UploadedFile, UseInterceptors, UseGuards, Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get()
  list(@Req() req: any, @Query('aircraftId') aircraftId?: string) {
    return this.docs.list(req.tenantId, aircraftId);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (_, file, cb) => {
      const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
      cb(null, allowed.includes(file.mimetype));
    },
  }))
  upload(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return this.docs.upload(req.tenantId, req.user.id, file, body);
  }

  @Get(':id/download')
  getDownloadUrl(@Req() req: any, @Param('id') id: string) {
    return this.docs.getDownloadUrl(req.tenantId, id);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.docs.delete(req.tenantId, id);
  }
}
