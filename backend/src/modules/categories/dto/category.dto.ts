import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateCategoryDto {
  @IsString()
  @MinLength(2, { message: 'Tên chuyên mục tối thiểu 2 ký tự' })
  @MaxLength(150)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsOptional()
  @IsInt({ message: 'Chuyên mục cha không hợp lệ' })
  parentId?: number
}

/** Sửa chuyên mục: chỉ tên + mô tả (không đổi cha — khớp UI GĐ0.5, tránh vòng lặp cha-con). */
export class UpdateCategoryDto {
  @IsString()
  @MinLength(2, { message: 'Tên chuyên mục tối thiểu 2 ký tự' })
  @MaxLength(150)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}
