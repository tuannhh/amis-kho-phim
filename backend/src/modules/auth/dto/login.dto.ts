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

/** GĐ6.1 — SSO placeholder cho khung AMIS Mobile. Xem ghi chú ở AuthService.ssoAmisMobile. */
export class SsoAmisMobileDto {
  @IsString()
  @MinLength(1, { message: 'Thiếu token SSO' })
  token!: string
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
