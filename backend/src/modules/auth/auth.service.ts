import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { UsersService, type PublicUser } from '../users/users.service'
import type { JwtPayload } from '../../common/auth/auth-user'

export interface LoginResult {
  accessToken: string
  refreshToken: string
  user: PublicUser
}

/**
 * Xác thực nội bộ (email + mật khẩu → JWT). Seam để GĐ7 thay bằng OIDC AMIS:
 * chỉ cần đổi chỗ "xác minh danh tính", phần cấp JWT/kiểm quyền giữ nguyên.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findByEmailWithHash(email.trim().toLowerCase())
    // Thông báo mơ hồ (không lộ email tồn tại hay không) — chống dò tài khoản.
    if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không đúng')

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) throw new UnauthorizedException('Email hoặc mật khẩu không đúng')
    if (!user.isActive) throw new UnauthorizedException('Tài khoản đã bị khoá')

    const publicUser = (await this.users.findByIdPublic(user.id))!
    return { ...this.issueTokens(publicUser), user: publicUser }
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    let payload: JwtPayload
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
      })
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn')
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Sai loại token')

    const entity = await this.users.findActiveEntity(payload.sub)
    if (!entity) throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khoá')

    const publicUser = (await this.users.findByIdPublic(entity.id))!
    return { ...this.issueTokens(publicUser), user: publicUser }
  }

  async me(userId: number): Promise<PublicUser> {
    const u = await this.users.findByIdPublic(userId)
    if (!u) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ')
    return u
  }

  async changePassword(userId: number, current: string, next: string): Promise<void> {
    await this.users.changePassword(userId, current, next)
  }

  private issueTokens(user: PublicUser): { accessToken: string; refreshToken: string } {
    const base = { sub: user.id, email: user.email, role: user.roleCode }
    const accessToken = this.jwt.sign(
      { ...base, type: 'access' } satisfies JwtPayload,
      {
        secret: process.env.JWT_SECRET || 'change-me',
        expiresIn: process.env.JWT_ACCESS_TTL || '15m',
      },
    )
    const refreshToken = this.jwt.sign(
      { ...base, type: 'refresh' } satisfies JwtPayload,
      {
        secret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
        expiresIn: process.env.JWT_REFRESH_TTL || '7d',
      },
    )
    return { accessToken, refreshToken }
  }
}
