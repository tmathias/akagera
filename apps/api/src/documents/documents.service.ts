import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';
import { v4 as uuidv4 } from 'uuid';

interface CreateDocumentDto {
  title: string;
  category: string;
  version?: string;
  aircraftId?: string;
  validFrom?: Date;
  validTo?: Date;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async list(tenantId: string, aircraftId?: string) {
    return this.prisma.document.findMany({
      where: { tenantId, ...(aircraftId ? { aircraftId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { aircraft: { select: { registration: true, type: true } } },
    });
  }

  async upload(
    tenantId: string,
    uploadedById: string,
    file: Express.Multer.File,
    dto: CreateDocumentDto,
  ) {
    const docId = uuidv4();
    const s3Key = this.s3.buildKey(tenantId, docId, file.originalname);

    const { checksum, sizeBytes } = await this.s3.upload(
      s3Key, file.buffer, file.mimetype,
      { tenantId, title: dto.title, version: dto.version ?? '1.0' },
    );

    return this.prisma.document.create({
      data: {
        id: docId,
        tenantId,
        aircraftId: dto.aircraftId,
        title: dto.title,
        category: dto.category as any,
        version: dto.version ?? '1.0',
        s3Key,
        sizeBytes,
        mimeType: file.mimetype,
        checksum,
        validFrom: dto.validFrom,
        validTo: dto.validTo,
        uploadedById,
      },
    });
  }

  async getDownloadUrl(tenantId: string, docId: string) {
    const doc = await this.prisma.document.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.tenantId !== tenantId) throw new ForbiddenException();
    return { url: await this.s3.getPresignedUrl(doc.s3Key) };
  }

  async delete(tenantId: string, docId: string) {
    const doc = await this.prisma.document.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException();
    if (doc.tenantId !== tenantId) throw new ForbiddenException();
    await this.s3.delete(doc.s3Key);
    await this.prisma.document.delete({ where: { id: docId } });
  }
}
