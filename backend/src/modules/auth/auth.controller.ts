import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { LoginDto, RefreshDto, ChangePasswordDto, SsoAmisMobileDto } from './dto/login.dto'
import { Public } from '../../common/auth/public.decorator'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import type { AuthUser } from '../../common/auth/auth-user'

/**
 * Xác thực. GĐ7: toàn bộ controller bọc ThrottlerGuard — đây là bề mặt tấn công brute
 * force duy nhất của hệ thống (đoán mật khẩu / dò token SSO). Giới hạn tính theo IP;
 * nginx đã set X-Forwarded-For và main.ts bật 'trust proxy' nên lấy đúng IP người dùng.
 */
@ApiTags('auth')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 10 lần thử đăng nhập / 1 phút / IP — đủ rộng cho người gõ nhầm, quá hẹp cho bot. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Đăng nhập bằng email + mật khẩu, trả access/refresh token' })
  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password)
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Đổi refresh token lấy cặp token mới' })
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: '[GĐ6.1 placeholder] Đổi token SSO AMIS Mobile lấy JWT nội bộ' })
  @Public()
  @Post('sso/amis-mobile')
  @HttpCode(200)
  ssoAmisMobile(@Body() dto: SsoAmisMobileDto) {
    return this.auth.ssoAmisMobile(dto.token)
  }

  /** Lấy hồ sơ người đang đăng nhập (FE gọi khi khôi phục phiên từ localStorage). */
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Hồ sơ người dùng đang đăng nhập' })
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id)
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Tự đổi mật khẩu (cần mật khẩu hiện tại)' })
  @Post('change-password')
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword)
  }
}
