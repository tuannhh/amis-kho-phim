import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

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
