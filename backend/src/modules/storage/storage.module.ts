import { Module } from '@nestjs/common'
import { StorageService } from './storage.service'
import { MediaController } from './media.controller'

/**
 * StorageModule — tích hợp MinIO (S3). Export StorageService cho module khác
 * (FilmsModule) dùng để ký presigned URL, upload thumbnail, xác nhận version.
 * MediaController phát media (Range) công khai theo key.
 */
@Module({
  providers: [StorageService],
  controllers: [MediaController],
  exports: [StorageService],
})
export class StorageModule {}
