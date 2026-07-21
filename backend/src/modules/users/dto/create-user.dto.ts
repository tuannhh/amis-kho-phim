import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import type { RoleCode } from '../entities/role.entity'

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(190)
  email!: string

  @IsString()
  @MinLength(2, { message: 'Họ tên tối thiểu 2 ký tự' })
  @MaxLength(150)
  fullName!: string

  @IsIn(['admin', 'employee'], { message: 'Vai trò không hợp lệ' })
  roleCode!: Exclude<RoleCode, 'super_admin'>

  /** Mật khẩu tạm; để trống → hệ thống tự sinh và trả về 1 lần trong response. */
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72)
  password?: string
}

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive!: boolean
}
