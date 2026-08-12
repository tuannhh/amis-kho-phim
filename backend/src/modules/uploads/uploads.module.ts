import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UploadIntent } from './entities/upload-intent.entity'
import { UploadIntentsService } from './upload-intents.service'
import { StorageModule } from '../storage/storage.module'

/**
 * UploadsModule — chủ sở hữu + vòng đời của presigned upload URL đã ký (Tier A retrofit,
 * 2026-08-12). Tách module riêng thay vì nhét thẳng vào FilmsModule vì đây là mối quan tâm
 * độc lập (ownership/cleanup của storage), dù hiện chỉ FilmsService dùng tới — đúng nguyên
 * tắc module hoá mặc định của chuẩn Backend MISA (tách theo trách nhiệm, không đợi "đủ lớn
 * mới tách" hay "đủ nhiều nơi dùng mới tách").
 */
@Module({
  imports: [TypeOrmModule.forFeature([UploadIntent]), StorageModule],
  providers: [UploadIntentsService],
  exports: [UploadIntentsService],
})
export class UploadsModule {}
