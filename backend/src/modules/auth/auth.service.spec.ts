import { JwtService } from '@nestjs/jwt'
import { NotImplementedException, UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { createHmac } from 'crypto'
import { AuthService } from './auth.service'
import type { UsersService, PublicUser } from '../users/users.service'
import type { JwtPayload } from '../../common/auth/auth-user'

/**
 * GĐ7 — AuthService là nơi cấp "chìa khoá" cho toàn hệ thống.
 * Bao gồm cả endpoint SSO AMIS Mobile (GĐ6.1) vốn chưa từng qua security review.
 */

const SECRET = 'access-secret-cho-test-'.padEnd(40, 'z')
const REFRESH_SECRET = 'refresh-secret-cho-test-'.padEnd(40, 'z')
const SSO_SECRET = 'sso-shared-secret-cho-test-'.padEnd(40, 'z')

const PASSWORD = 'MatKhau@123'

const publicUser: PublicUser = {
  id: 5,
  email: 'nhanvien@misa.com.vn',
  fullName: 'Nguyễn Văn A',
  roleCode: 'employee',
  departmentId: 1,
  createdBy: 1,
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

/** Token SSO theo định dạng placeholder GĐ6.1: base64url(payload) + '.' + hmacHex. */
function makeSsoToken(
  payload: Record<string, unknown>,
  secret = SSO_SECRET,
): string {
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret).update(b64).digest('hex')
  return `${b64}.${sig}`
}

const inSeconds = (n: number) => Math.floor(Date.now() / 1000) + n

describe('AuthService', () => {
  const jwt = new JwtService({})
  const savedEnv = { ...process.env }
  let users: jest.Mocked<Pick<UsersService, 'findByEmailWithHash' | 'findByIdPublic' | 'findActiveEntity' | 'changePassword'>>
  let service: AuthService
  let passwordHash: string

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 10)
  })

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET
    process.env.JWT_REFRESH_SECRET = REFRESH_SECRET
    delete process.env.AMIS_SSO_SHARED_SECRET

    users = {
      findByEmailWithHash: jest.fn(),
      findByIdPublic: jest.fn().mockResolvedValue(publicUser),
      findActiveEntity: jest.fn(),
      changePassword: jest.fn(),
    } as never
    service = new AuthService(users as unknown as UsersService, jwt)
  })

  afterEach(() => {
    process.env = { ...savedEnv }
  })

  const withUser = (over: Partial<{ isActive: boolean }> = {}) =>
    users.findByEmailWithHash.mockResolvedValue({
      id: 5,
      email: publicUser.email,
      passwordHash,
      isActive: true,
      ...over,
    } as never)

  // ── Đăng nhập ────────────────────────────────────────────────────────────
  describe('login', () => {
    it('đúng email + mật khẩu → cấp cặp token, access token giải mã ra đúng danh tính', async () => {
      withUser()
      const result = await service.login(publicUser.email, PASSWORD)

      const decoded = jwt.verify<JwtPayload>(result.accessToken, { secret: SECRET })
      expect(decoded.sub).toBe(5)
      expect(decoded.role).toBe('employee')
      expect(decoded.type).toBe('access')
      expect(result.user).toEqual(publicUser)
    })

    it('access token và refresh token ký bằng 2 secret KHÁC nhau (ADR-012)', async () => {
      withUser()
      const { accessToken, refreshToken } = await service.login(publicUser.email, PASSWORD)
      // Refresh token không được verify nổi bằng access secret và ngược lại.
      expect(() => jwt.verify(refreshToken, { secret: SECRET })).toThrow()
      expect(() => jwt.verify(accessToken, { secret: REFRESH_SECRET })).toThrow()
    })

    it('sai mật khẩu → 401', async () => {
      withUser()
      await expect(service.login(publicUser.email, 'sai-mat-khau')).rejects.toThrow(UnauthorizedException)
    })

    it('email không tồn tại → 401 với THÔNG BÁO GIỐNG HỆT sai mật khẩu (chống dò tài khoản)', async () => {
      users.findByEmailWithHash.mockResolvedValue(null)
      const notFound = await service.login('khong-ton-tai@misa.com.vn', PASSWORD).catch((e) => e)

      withUser()
      const wrongPass = await service.login(publicUser.email, 'sai-mat-khau').catch((e) => e)

      expect(notFound.message).toBe(wrongPass.message)
    })

    it('email không tồn tại vẫn tốn thời gian bcrypt (chống dò tài khoản qua thời gian phản hồi)', async () => {
      // Không spy được bcryptjs (export không configurable) nên đo hành vi thật:
      // nếu bỏ phần "so sánh giả", nhánh này trả về gần như tức thì (~0ms) trong khi
      // nhánh email có thật tốn ~70ms (bcrypt cost 10) → chênh lệch đó chính là lỗ hổng.
      users.findByEmailWithHash.mockResolvedValue(null)
      const started = Date.now()
      await service.login('khong-ton-tai@misa.com.vn', PASSWORD).catch(() => undefined)
      const elapsed = Date.now() - started

      // Ngưỡng 20ms nới rộng so với ~70ms thực tế để không phụ thuộc tốc độ máy CI,
      // nhưng vẫn đủ chặt để phát hiện việc return sớm.
      expect(elapsed).toBeGreaterThanOrEqual(20)
    })

    it('tài khoản bị khoá → 401 dù mật khẩu đúng', async () => {
      withUser({ isActive: false })
      await expect(service.login(publicUser.email, PASSWORD)).rejects.toThrow(/khoá/)
    })

    it('email khác hoa/thường và thừa khoảng trắng vẫn đăng nhập được', async () => {
      withUser()
      await service.login('  NhanVien@MISA.com.vn  ', PASSWORD)
      expect(users.findByEmailWithHash).toHaveBeenCalledWith('nhanvien@misa.com.vn')
    })
  })

  // ── Refresh ──────────────────────────────────────────────────────────────
  describe('refresh', () => {
    const signRefresh = (payload: Partial<JwtPayload> = {}) =>
      jwt.sign(
        { sub: 5, email: publicUser.email, role: 'employee', type: 'refresh', ...payload } as JwtPayload,
        { secret: REFRESH_SECRET, expiresIn: '7d' },
      )

    it('refresh token hợp lệ → cấp cặp token mới', async () => {
      users.findActiveEntity.mockResolvedValue({ id: 5 } as never)
      const result = await service.refresh(signRefresh())
      expect(jwt.verify<JwtPayload>(result.accessToken, { secret: SECRET }).type).toBe('access')
    })

    it('KHÔNG cho dùng access token ở /auth/refresh', async () => {
      const access = jwt.sign(
        { sub: 5, email: publicUser.email, role: 'employee', type: 'access' } as JwtPayload,
        { secret: REFRESH_SECRET },
      )
      await expect(service.refresh(access)).rejects.toThrow(/Sai loại token/)
    })

    it('refresh token hết hạn → 401', async () => {
      const expired = jwt.sign(
        { sub: 5, email: publicUser.email, role: 'employee', type: 'refresh' } as JwtPayload,
        { secret: REFRESH_SECRET, expiresIn: '-1s' },
      )
      await expect(service.refresh(expired)).rejects.toThrow(UnauthorizedException)
    })

    it('tài khoản đã bị khoá/xoá sau khi cấp token → refresh bị chặn', async () => {
      users.findActiveEntity.mockResolvedValue(null)
      await expect(service.refresh(signRefresh())).rejects.toThrow(/không tồn tại hoặc đã bị khoá/)
    })

    it('refresh token giả mạo (ký bằng secret khác) → 401', async () => {
      const forged = jwt.sign(
        { sub: 1, email: 'admin@misa.com.vn', role: 'super_admin', type: 'refresh' } as JwtPayload,
        { secret: 'secret-cua-ke-tan-cong-1234567890' },
      )
      await expect(service.refresh(forged)).rejects.toThrow(UnauthorizedException)
    })
  })

  // ── SSO AMIS Mobile (GĐ6.1 placeholder) ──────────────────────────────────
  describe('ssoAmisMobile (placeholder GĐ6.1)', () => {
    it('không cấu hình secret → 501, KHÔNG phải 500 và tuyệt đối không cấp token', async () => {
      const token = makeSsoToken({ email: publicUser.email, exp: inSeconds(60) })
      await expect(service.ssoAmisMobile(token)).rejects.toThrow(NotImplementedException)
    })

    it('secret quá ngắn → coi như TẮT (501), không chấp nhận secret yếu', async () => {
      process.env.AMIS_SSO_SHARED_SECRET = 'ngan'
      const token = makeSsoToken({ email: publicUser.email, exp: inSeconds(60) }, 'ngan')
      await expect(service.ssoAmisMobile(token)).rejects.toThrow(NotImplementedException)
    })

    it('token hợp lệ → cấp JWT nội bộ y hệt luồng login thường', async () => {
      process.env.AMIS_SSO_SHARED_SECRET = SSO_SECRET
      withUser()
      const token = makeSsoToken({ email: publicUser.email, exp: inSeconds(60) })
      const result = await service.ssoAmisMobile(token)
      expect(jwt.verify<JwtPayload>(result.accessToken, { secret: SECRET }).sub).toBe(5)
    })

    it('chữ ký HMAC sai (ký bằng secret khác) → 401', async () => {
      process.env.AMIS_SSO_SHARED_SECRET = SSO_SECRET
      withUser()
      const token = makeSsoToken({ email: publicUser.email, exp: inSeconds(60) }, 'secret-cua-ke-tan-cong-abcdefgh')
      await expect(service.ssoAmisMobile(token)).rejects.toThrow(UnauthorizedException)
    })

    it('sửa payload nhưng giữ chữ ký cũ (đổi sang email super admin) → 401', async () => {
      process.env.AMIS_SSO_SHARED_SECRET = SSO_SECRET
      withUser()
      const legit = makeSsoToken({ email: publicUser.email, exp: inSeconds(60) })
      const sig = legit.split('.')[1]
      const evilPayload = Buffer.from(
        JSON.stringify({ email: 'superadmin@misa.com.vn', exp: inSeconds(60) }),
        'utf8',
      ).toString('base64url')
      await expect(service.ssoAmisMobile(`${evilPayload}.${sig}`)).rejects.toThrow(UnauthorizedException)
    })

    it('token đã hết hạn → 401', async () => {
      process.env.AMIS_SSO_SHARED_SECRET = SSO_SECRET
      withUser()
      const token = makeSsoToken({ email: publicUser.email, exp: inSeconds(-10) })
      await expect(service.ssoAmisMobile(token)).rejects.toThrow(/hết hạn/)
    })

    it('token có exp xa vô hạn (1 năm) → 401 vì vượt trần TTL (giới hạn cửa sổ replay)', async () => {
      process.env.AMIS_SSO_SHARED_SECRET = SSO_SECRET
      withUser()
      const token = makeSsoToken({ email: publicUser.email, exp: inSeconds(365 * 24 * 3600) })
      await expect(service.ssoAmisMobile(token)).rejects.toThrow(/quá dài/)
    })

    it('token sai định dạng (không đủ 2 phần) → 401', async () => {
      process.env.AMIS_SSO_SHARED_SECRET = SSO_SECRET
      await expect(service.ssoAmisMobile('rac')).rejects.toThrow(UnauthorizedException)
    })

    it('thiếu trường email trong payload → 401', async () => {
      process.env.AMIS_SSO_SHARED_SECRET = SSO_SECRET
      const token = makeSsoToken({ exp: inSeconds(60) })
      await expect(service.ssoAmisMobile(token)).rejects.toThrow(UnauthorizedException)
    })

    it('email hợp lệ nhưng chưa có tài khoản trong Kho phim → 401 (không tự tạo user)', async () => {
      process.env.AMIS_SSO_SHARED_SECRET = SSO_SECRET
      users.findByEmailWithHash.mockResolvedValue(null)
      const token = makeSsoToken({ email: 'nguoi-la@misa.com.vn', exp: inSeconds(60) })
      await expect(service.ssoAmisMobile(token)).rejects.toThrow(/Không tìm thấy tài khoản/)
    })

    it('tài khoản đã bị khoá → SSO cũng bị chặn (không có đường vòng qua bridge)', async () => {
      process.env.AMIS_SSO_SHARED_SECRET = SSO_SECRET
      withUser({ isActive: false })
      const token = makeSsoToken({ email: publicUser.email, exp: inSeconds(60) })
      await expect(service.ssoAmisMobile(token)).rejects.toThrow(/khoá/)
    })
  })
})
