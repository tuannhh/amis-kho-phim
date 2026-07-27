import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginDto, RefreshDto, ChangePasswordDto, SsoAmisMobileDto } from './dto/login.dto'
import { Public } from '../../common/auth/public.decorator'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import type { AuthUser } from '../../common/auth/auth-user'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password)
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken)
  }

  /**
   * GĐ6.1 — SSO placeholder cho WebView AMIS Mobile. TẮT theo mặc định (501) nếu chưa cấu
   * hình AMIS_SSO_SHARED_SECRET. Xem ghi chú chi tiết ở AuthService.ssoAmisMobile.
   */
  @Public()
  @Post('sso/amis-mobile')
  @HttpCode(200)
  ssoAmisMobile(@Body() dto: SsoAmisMobileDto) {
    return this.auth.ssoAmisMobile(dto.token)
  }

  /** Lấy hồ sơ người đang đăng nhập (FE gọi khi khôi phục phiên từ localStorage). */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id)
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword)
  }
}
