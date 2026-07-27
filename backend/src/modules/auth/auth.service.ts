import { Injectable, NotImplementedException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { createHmac, timingSafeEqual } from 'crypto'
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

  /**
   * GĐ6.1 — SSO tạm cho khung AMIS Mobile (WebView+bridge).
   * PLACEHOLDER: đây KHÔNG phải cơ chế xác minh chính thức của đội AMIS Mobile — chưa có
   * spec bridge/JWKS thật lúc viết. Tạm dùng HMAC-SHA256 trên payload JSON {email, exp} với
   * shared secret đọc từ env AMIS_SSO_SHARED_SECRET (rỗng = TẮT tính năng, an toàn mặc định).
   * Khi đội AMIS Mobile cung cấp spec thật (OIDC/JWKS hoặc cơ chế khác), DevOps chỉ cần thay
   * hàm `verifySsoToken` này — phần cấp JWT/RBAC phía sau (issueTokens) giữ nguyên, đúng tinh
   * thần seam "Seam để GĐ7 thay bằng OIDC AMIS" ở đầu file.
   */
  async ssoAmisMobile(token: string): Promise<LoginResult> {
    const secret = process.env.AMIS_SSO_SHARED_SECRET
    if (!secret) {
      throw new NotImplementedException('Chưa cấu hình SSO AMIS Mobile')
    }

    const email = this.verifySsoToken(token, secret)

    const user = await this.users.findByEmailWithHash(email)
    if (!user) throw new UnauthorizedException('Không tìm thấy tài khoản MISA tương ứng')
    if (!user.isActive) throw new UnauthorizedException('Tài khoản đã bị khoá')

    const publicUser = (await this.users.findByIdPublic(user.id))!
    return { ...this.issueTokens(publicUser), user: publicUser }
  }

  /**
   * Xác minh chữ ký tạm thời: token = `${base64url(payloadJson)}.${hmacHex}`,
   * payloadJson = {"email": "...", "exp": <unix seconds>}.
   * TODO(DevOps/AMIS Mobile): thay bằng xác minh JWT chuẩn (OIDC/JWKS) khi có spec thật.
   */
  private verifySsoToken(token: string, secret: string): string {
    const parts = token.split('.')
    if (parts.length !== 2) throw new UnauthorizedException('Token SSO không hợp lệ')
    const [payloadB64, signatureHex] = parts

    const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('hex')
    const a = Buffer.from(signatureHex, 'utf8')
    const b = Buffer.from(expectedSig, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Token SSO không hợp lệ')
    }

    let payload: { email?: string; exp?: number }
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    } catch {
      throw new UnauthorizedException('Token SSO không hợp lệ')
    }
    if (!payload.email || typeof payload.exp !== 'number') {
      throw new UnauthorizedException('Token SSO không hợp lệ')
    }
    if (payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Token SSO đã hết hạn')
    }
    return payload.email.trim().toLowerCase()
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
