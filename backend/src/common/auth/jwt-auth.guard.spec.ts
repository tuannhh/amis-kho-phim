import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { JwtAuthGuard } from './jwt-auth.guard'
import type { JwtPayload } from './auth-user'

/**
 * GĐ7 — JwtAuthGuard là cửa vào duy nhất của toàn bộ API (guard toàn cục).
 * Trọng tâm test: không nhận refresh token thay access token, không nhận token ký bằng
 * secret khác, và @Public phải thực sự bỏ qua xác thực.
 */

const SECRET = 'test-access-secret-'.padEnd(40, 'z')
const REFRESH_SECRET = 'test-refresh-secret-'.padEnd(40, 'z')

function makeContext(headers: Record<string, string> = {}) {
  const req: Record<string, unknown> = { headers }
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext
  return { ctx, req }
}

function makeGuard(isPublic: boolean, jwt: JwtService): JwtAuthGuard {
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector
  return new JwtAuthGuard(reflector, jwt)
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({})
  const savedEnv = { ...process.env }

  const sign = (payload: JwtPayload, secret = SECRET, expiresIn = '15m') =>
    jwt.sign(payload, { secret, expiresIn })

  const accessPayload: JwtPayload = { sub: 3, email: 'nv@misa.com.vn', role: 'employee', type: 'access' }

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET
    process.env.JWT_REFRESH_SECRET = REFRESH_SECRET
  })
  afterEach(() => {
    process.env = { ...savedEnv }
  })

  it('route @Public đi qua mà không cần token', () => {
    const { ctx } = makeContext()
    expect(makeGuard(true, jwt).canActivate(ctx)).toBe(true)
  })

  it('thiếu header Authorization → 401', () => {
    const { ctx } = makeContext()
    expect(() => makeGuard(false, jwt).canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('header sai định dạng (không có "Bearer ") → 401', () => {
    const { ctx } = makeContext({ authorization: sign(accessPayload) })
    expect(() => makeGuard(false, jwt).canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('access token hợp lệ → cho qua và gắn req.user đúng danh tính', () => {
    const { ctx, req } = makeContext({ authorization: `Bearer ${sign(accessPayload)}` })
    expect(makeGuard(false, jwt).canActivate(ctx)).toBe(true)
    expect(req.user).toEqual({ id: 3, email: 'nv@misa.com.vn', roleCode: 'employee' })
  })

  it('KHÔNG chấp nhận refresh token để gọi API thường (ADR-012)', () => {
    const refresh = sign({ ...accessPayload, type: 'refresh' }, REFRESH_SECRET, '7d')
    const { ctx } = makeContext({ authorization: `Bearer ${refresh}` })
    expect(() => makeGuard(false, jwt).canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('token type=refresh nhưng ký bằng ACCESS secret cũng bị từ chối', () => {
    const sneaky = sign({ ...accessPayload, type: 'refresh' }, SECRET)
    const { ctx } = makeContext({ authorization: `Bearer ${sneaky}` })
    expect(() => makeGuard(false, jwt).canActivate(ctx)).toThrow(/Sai loại token/)
  })

  it('token ký bằng secret khác (giả mạo) → 401', () => {
    const forged = sign({ ...accessPayload, role: 'super_admin' }, 'secret-cua-ke-tan-cong-1234567890')
    const { ctx } = makeContext({ authorization: `Bearer ${forged}` })
    expect(() => makeGuard(false, jwt).canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('token đã hết hạn → 401', () => {
    const expired = jwt.sign(accessPayload, { secret: SECRET, expiresIn: '-1s' })
    const { ctx } = makeContext({ authorization: `Bearer ${expired}` })
    expect(() => makeGuard(false, jwt).canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('chuỗi rác thay cho token → 401 (không crash 500)', () => {
    const { ctx } = makeContext({ authorization: 'Bearer khong-phai-jwt' })
    expect(() => makeGuard(false, jwt).canActivate(ctx)).toThrow(UnauthorizedException)
  })

  // ── Ép cứng thuật toán ký (chuẩn Backend MISA 02-security-baseline §1) ──
  it('TỪ CHỐI token khai `alg: none` (token không hề được ký)', () => {
    // Tự dựng tay vì thư viện không cho ký kiểu 'none'. Đây đúng là hình dạng token mà
    // kẻ tấn công gửi lên khi thử khai thác lỗ hổng "alg none" kinh điển.
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const header = b64({ alg: 'none', typ: 'JWT' })
    const body = b64({ sub: 1, email: 'admin@misa.com.vn', role: 'super_admin', type: 'access' })
    const { ctx } = makeContext({ authorization: `Bearer ${header}.${body}.` })
    expect(() => makeGuard(false, jwt).canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('TỪ CHỐI token ký bằng thuật toán khác HS256 (dù đúng secret)', () => {
    const hs512 = jwt.sign(accessPayload, { secret: SECRET, algorithm: 'HS512', expiresIn: '15m' })
    const { ctx } = makeContext({ authorization: `Bearer ${hs512}` })
    expect(() => makeGuard(false, jwt).canActivate(ctx)).toThrow(UnauthorizedException)
  })
})
