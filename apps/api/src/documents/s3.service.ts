import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client, PutObjectCommand, GetObjectCommand,
  DeleteObjectCommand, HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(S3Service.name);

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('AWS_S3_BUCKET', 'akagera-documents');
    this.s3 = new S3Client({
      region: config.get<string>('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  // ── Upload a buffer to S3 ────────────────────────────────────────────────
  async upload(
    key: string,
    body: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<{ key: string; checksum: string; sizeBytes: number }> {
    const checksum = createHash('sha256').update(body).digest('hex');
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ChecksumSHA256: checksum,
      Metadata: { ...metadata, checksum },
      ServerSideEncryption: 'AES256',
    }));
    return { key, checksum, sizeBytes: body.length };
  }

  // ── Pre-signed download URL (15-minute expiry) ──────────────────────────
  async getPresignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  // ── Pre-signed upload URL (for direct browser uploads) ─────────────────
  async getUploadUrl(key: string, contentType: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSeconds },
    );
  }

  // ── Delete object ────────────────────────────────────────────────────────
  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  // ── Stream object (for PDF proxy) ───────────────────────────────────────
  async getStream(key: string): Promise<Readable> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return res.Body as Readable;
  }

  buildKey(tenantId: string, docId: string, filename: string): string {
    return `${tenantId}/documents/${docId}/${filename}`;
  }
}
