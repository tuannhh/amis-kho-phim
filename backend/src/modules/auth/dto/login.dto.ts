import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string

  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu' })
  @MaxLength(72)
  password!: string
}

export class RefreshDto {
  @IsString()
  @MinLength(10)
  refreshToken!: string
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  @MaxLength(72)
  newPassword!: string
}
