import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'

/**
 * Dùng chung cho create (POST) và update (PATCH) — form FE luôn gửi đủ trường.
 * GĐ2: chỉ link ngoài (youtube/vimeo/gdrive/misadrive) — 'storage' thật (MinIO) là GĐ3.
 */
export class UpsertFilmDto {
  @IsString()
  @MinLength(2, { message: 'Tên phim tối thiểu 2 ký tự' })
  @MaxLength(255)
  title!: string

  @IsInt({ message: 'Vui lòng chọn chuyên mục' })
  categoryId!: number

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  hashtags?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(500)
  youtubeUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  vimeoUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gdriveUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  misadriveUrl?: string
}

/** Xin presigned PUT URL cho file video. Server tự sinh storage_key (không nhận từ client). */
export class CreateUploadUrlDto {
  @IsString()
  @MaxLength(150)
  contentType!: string

  @IsInt()
  @IsPositive()
  size!: number
}

/**
 * Xác nhận tạo bản mới sau khi FE upload xong. Chỉ nhận storage_key/thumbnail_key
 * do server đã cấp (định dạng cố định); server head-check lại trong MinIO, không
 * tin size/duration client tự khai (lấy size thật từ MinIO).
 */
export class ConfirmVersionDto {
  @IsOptional()
  @IsString()
  @Matches(/^video-[a-f0-9-]{36}\.[a-z0-9]{2,4}$/, { message: 'storageKey không hợp lệ' })
  storageKey?: string

  @IsOptional()
  @IsString()
  @Matches(/^thumb-[a-f0-9-]{36}\.[a-z0-9]{2,4}$/, { message: 'thumbnailKey không hợp lệ' })
  thumbnailKey?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}:\d{2}(:\d{2})?$/, { message: 'duration không hợp lệ' })
  duration?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string
}
