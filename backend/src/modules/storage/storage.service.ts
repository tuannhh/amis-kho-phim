import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import type { Readable } from 'stream'

/**
 * StorageService — bọc MinIO qua S3 API (@aws-sdk/client-s3), ADR-004/GĐ3.
 *
 * Hai endpoint khác nhau (ADR-019):
 *  - `internal` (MINIO_ENDPOINT:MINIO_PORT, vd minio:9000): backend tự thao tác
 *    (tạo bucket, head, get-stream để phát Range, put thumbnail, xoá).
 *  - `public` (MINIO_PUBLIC_ENDPOINT, vd http://localhost:9200): CHỈ để ký
 *    presigned PUT URL — trình duyệt upload thẳng file lớn lên MinIO, không
 *    buffer qua Node (01-architecture.md §7). Chữ ký SigV4 gắn host nên phải ký
 *    bằng đúng host trình duyệt gọi tới.
 *
 * storage_key sinh HOÀN TOÀN ở server (uuid) — không nhận từ client, tránh
 * path traversal / đoán key của người khác (bài học bảo mật AMIS Kho ảnh v2).
 */

// Chỉ cho phép các định dạng video/ảnh bìa xác định — không tin content-type client tuỳ tiện.
const VIDEO_CONTENT_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
}
const IMAGE_TYPE_EXT: Record<string, string> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger('StorageService')
  private readonly bucket = process.env.MINIO_BUCKET || 'kho-phim'
  private readonly internal: S3Client
  private readonly presigner: S3Client

  constructor() {
    const accessKeyId = process.env.MINIO_ACCESS_KEY || 'minioadmin'
    const secretAccessKey = process.env.MINIO_SECRET_KEY || 'minioadmin'
    const region = process.env.MINIO_REGION || 'us-east-1'
    const host = process.env.MINIO_ENDPOINT || 'minio'
    const port = Number(process.env.MINIO_PORT || 9000)
    const internalEndpoint = `http://${host}:${port}`
    // Endpoint trình duyệt gọi được (ánh xạ cổng host) — mặc định khớp MINIO_API_PORT.
    const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT || 'http://localhost:9200'

    const common = {
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, // MinIO dùng path-style: http://host/bucket/key
    }
    this.internal = new S3Client({ ...common, endpoint: internalEndpoint })
    this.presigner = new S3Client({ ...common, endpoint: publicEndpoint })
  }

  /** Tạo bucket nếu chưa có (idempotent) khi backend khởi động. */
  async onModuleInit(): Promise<void> {
    try {
      await this.internal.send(new HeadBucketCommand({ Bucket: this.bucket }))
    } catch {
      try {
        await this.internal.send(new CreateBucketCommand({ Bucket: this.bucket }))
        this.logger.log(`Đã tạo bucket MinIO "${this.bucket}"`)
      } catch (e) {
        this.logger.warn(`Không tạo được bucket "${this.bucket}": ${(e as Error).message}`)
      }
    }
  }

  private get maxUploadBytes(): number {
    return Number(process.env.MAX_UPLOAD_MB || 2048) * 1024 * 1024
  }

  isAllowedVideoType(contentType: string): boolean {
    return !!VIDEO_CONTENT_TYPES[contentType]
  }

  isWithinLimit(size: number): boolean {
    return size > 0 && size <= this.maxUploadBytes
  }

  /** Sinh presigned PUT URL cho 1 file video. Trả về key server-side + url có hạn ngắn. */
  async createVideoUploadUrl(
    contentType: string,
    expiresIn = 600,
  ): Promise<{ storageKey: string; uploadUrl: string; expiresIn: number }> {
    const ext = VIDEO_CONTENT_TYPES[contentType]
    const storageKey = `video-${randomUUID()}.${ext}`
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, ContentType: contentType })
    const uploadUrl = await getSignedUrl(this.presigner, cmd, { expiresIn })
    return { storageKey, uploadUrl, expiresIn }
  }

  /** Upload ảnh bìa nhỏ đi thẳng qua backend (multipart). type từ image-size, không tin client. */
  async putThumbnail(buffer: Buffer, imageType: string, contentType: string): Promise<string> {
    const ext = IMAGE_TYPE_EXT[imageType] || 'jpg'
    const storageKey = `thumb-${randomUUID()}.${ext}`
    await this.internal.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, Body: buffer, ContentType: contentType }),
    )
    return storageKey
  }

  /** HeadObject: kiểm tra key có thật + lấy kích thước thật (không tin size client khai). */
  async stat(key: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const r = await this.internal.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return { size: Number(r.ContentLength || 0), contentType: r.ContentType || 'application/octet-stream' }
    } catch {
      return null
    }
  }

  /**
   * Lấy object (có thể kèm Range) để phát video. Trả stream + metadata do MinIO
   * tính sẵn (ContentRange/ContentLength/ContentType) → controller trả 206/200 chuẩn.
   */
  async getObject(
    key: string,
    range?: string,
  ): Promise<{
    body: Readable
    contentLength?: number
    contentType?: string
    contentRange?: string
  } | null> {
    try {
      const r = await this.internal.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range }),
      )
      return {
        body: r.Body as Readable,
        contentLength: r.ContentLength != null ? Number(r.ContentLength) : undefined,
        contentType: r.ContentType,
        contentRange: r.ContentRange,
      }
    } catch {
      return null
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.internal.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (e) {
      this.logger.warn(`Không xoá được object "${key}": ${(e as Error).message}`)
    }
  }
}
