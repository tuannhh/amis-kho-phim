import { Injectable, NotImplementedException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { createHmac, timingSafeEqual } from 'crypto'
import { UsersService, type PublicUser } from '../users/users.service'
import {
  JWT_ALGORITHM,
  jwtAccessSecret,
  jwtRefreshSecret,
  MIN_SECRET_LENGTH,
} from '../../common/config/security.config'
import { auditLog } from '../../common/audit/audit-log'
import type { JwtPayload } from '../../common/auth/auth-user'

/**
 * Hash bcrypt của một chuỗi vô nghĩa, dùng để "so sánh giả" khi email không tồn tại —
 * giữ thời gian phản hồi của login tương đương trường hợp email có thật, tránh lộ
 * danh sách email hợp lệ qua chênh lệch thời gian (user enumeration). GĐ7.
 */
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

/** Trần thời gian sống của token SSO AMIS Mobile (giây) — chặn token exp xa vô hạn. */
const SSO_MAX_TTL_SECONDS = Number(process.env.AMIS_SSO_MAX_TTL_SECONDS || 300)

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
    // GĐ7: email không tồn tại vẫn chạy 1 lần bcrypt.compare giả để thời gian phản hồi
    // tương đương — nếu return sớm, kẻ tấn công đo thời gian là biết email nào có thật.
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH)
      auditLog({ action: 'login.failure', actorId: null, outcome: 'failure', detail: { reason: 'khong-ton-tai' } })
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng')
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      auditLog({ action: 'login.failure', actorId: user.id, outcome: 'failure', detail: { reason: 'sai-mat-khau' } })
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng')
    }
    if (!user.isActive) {
      auditLog({ action: 'login.failure', actorId: user.id, outcome: 'failure', detail: { reason: 'tai-khoan-bi-khoa' } })
      throw new UnauthorizedException('Tài khoản đã bị khoá')
    }

    const publicUser = (await this.users.findByIdPublic(user.id))!
    auditLog({ action: 'login.success', actorId: publicUser.id, outcome: 'success', detail: { role: publicUser.roleCode } })
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
    // GĐ7 — secret yếu ở endpoint này = ai đoán được đều đăng nhập được dưới DANH NGHĨA
    // BẤT KỲ EMAIL nào (kể cả super_admin). Thà tắt tính năng còn hơn bật với secret yếu.
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new NotImplementedException(
        `SSO AMIS Mobile bị tắt: AMIS_SSO_SHARED_SECRET ngắn hơn ${MIN_SECRET_LENGTH} ký tự`,
      )
    }

    const email = this.verifySsoToken(token, secret)

    const user = await this.users.findByEmailWithHash(email)
    if (!user) {
      auditLog({ action: 'sso.failure', actorId: null, outcome: 'failure', detail: { reason: 'khong-co-tai-khoan' } })
      throw new UnauthorizedException('Không tìm thấy tài khoản MISA tương ứng')
    }
    if (!user.isActive) {
      auditLog({ action: 'sso.failure', actorId: user.id, outcome: 'failure', detail: { reason: 'tai-khoan-bi-khoa' } })
      throw new UnauthorizedException('Tài khoản đã bị khoá')
    }

    const publicUser = (await this.users.findByIdPublic(user.id))!
    auditLog({ action: 'sso.success', actorId: publicUser.id, outcome: 'success' })
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
    const nowSeconds = Date.now() / 1000
    if (payload.exp < nowSeconds) {
      throw new UnauthorizedException('Token SSO đã hết hạn')
    }
    // GĐ7 — chặn token có exp xa vô hạn. Không có kho nonce/jti nên token bị lộ vẫn dùng
    // lại được (replay) tới khi hết hạn; giới hạn cửa sổ đó xuống vài phút là biện pháp
    // giảm thiểu rẻ nhất. Chống replay triệt để cần nonce một lần — xem docs/devops-handoff.md.
    if (payload.exp - nowSeconds > SSO_MAX_TTL_SECONDS) {
      throw new UnauthorizedException(
        `Token SSO có hạn dùng quá dài (tối đa ${SSO_MAX_TTL_SECONDS} giây)`,
      )
    }
    return payload.email.trim().toLowerCase()
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    let payload: JwtPayload
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: jwtRefreshSecret(),
        algorithms: [JWT_ALGORITHM],
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
    try {
      await this.users.changePassword(userId, current, next)
    } catch (e) {
      auditLog({ action: 'password.change', actorId: userId, outcome: 'failure' })
      throw e
    }
    auditLog({ action: 'password.change', actorId: userId, outcome: 'success' })
  }

  private issueTokens(user: PublicUser): { accessToken: string; refreshToken: string } {
    const base = { sub: user.id, email: user.email, role: user.roleCode }
    const accessToken = this.jwt.sign(
      { ...base, type: 'access' } satisfies JwtPayload,
      {
        secret: jwtAccessSecret(),
        algorithm: JWT_ALGORITHM,
        expiresIn: process.env.JWT_ACCESS_TTL || '15m',
      },
    )
    const refreshToken = this.jwt.sign(
      { ...base, type: 'refresh' } satisfies JwtPayload,
      {
        secret: jwtRefreshSecret(),
        algorithm: JWT_ALGORITHM,
        expiresIn: process.env.JWT_REFRESH_TTL || '7d',
      },
    )
    return { accessToken, refreshToken }
  }
}
