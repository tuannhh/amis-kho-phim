import { IsString, MaxLength, MinLength } from 'class-validator'

/** Tạo/sửa phòng ban — chỉ có tên (danh mục tối giản, ADR-042). */
export class UpsertDepartmentDto {
  @IsString()
  @MinLength(2, { message: 'Tên phòng ban tối thiểu 2 ký tự' })
  @MaxLength(150)
  name!: string
}
