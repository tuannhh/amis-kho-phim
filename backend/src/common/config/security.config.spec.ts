import { assertSecureConfig, collectConfigIssues, corsOrigins, MIN_SECRET_LENGTH } from './security.config'

/**
 * GĐ7 — chốt chặn cấu hình. Test ở đây bảo vệ đúng một điều: KHÔNG được vô tình đưa
 * secret mặc định lên môi trường thật mà app vẫn khởi động im lặng.
 */

const STRONG_A = 'a'.repeat(MIN_SECRET_LENGTH)
const STRONG_B = 'b'.repeat(MIN_SECRET_LENGTH)

/** Cấu hình "đã chuẩn hoá cho production" — dùng làm mốc để đổi từng biến một. */
function secureEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    JWT_SECRET: STRONG_A,
    JWT_REFRESH_SECRET: STRONG_B,
    MINIO_ACCESS_KEY: 'kho-phim-prod',
    MINIO_SECRET_KEY: 'x'.repeat(40),
    MINIO_PUBLIC_ENDPOINT: 'https://storage.misa.com.vn',
    SEED_SUPER_ADMIN_PASSWORD: 'M0t-Mat-Khau-That-2026',
    DB_PASSWORD: 'db-that-su-manh-2026',
  }
}

const messages = (env: NodeJS.ProcessEnv) => collectConfigIssues(env).map((i) => i.message).join(' | ')

describe('collectConfigIssues', () => {
  it('cấu hình production chuẩn thì không báo vấn đề nào', () => {
    expect(collectConfigIssues(secureEnv())).toEqual([])
  })

  it('bắt được JWT_SECRET còn giá trị mặc định "change-me"', () => {
    const issues = collectConfigIssues({ ...secureEnv(), JWT_SECRET: 'change-me' })
    expect(issues.some((i) => i.level === 'fatal' && i.message.includes('JWT_SECRET'))).toBe(true)
  })

  it('bắt được JWT_SECRET bị thiếu hoàn toàn', () => {
    const env = secureEnv()
    delete env.JWT_SECRET
    expect(messages(env)).toContain('JWT_SECRET')
  })

  it('bắt được secret đủ "lạ" nhưng quá ngắn', () => {
    const env = { ...secureEnv(), JWT_SECRET: 'x9k2' }
    expect(messages(env)).toContain('JWT_SECRET')
  })

  it('bắt được access secret trùng refresh secret', () => {
    const env = { ...secureEnv(), JWT_SECRET: STRONG_A, JWT_REFRESH_SECRET: STRONG_A }
    expect(messages(env)).toContain('phải KHÁC nhau')
  })

  it('bắt được MinIO còn tài khoản mặc định minioadmin', () => {
    expect(messages({ ...secureEnv(), MINIO_SECRET_KEY: 'minioadmin' })).toContain('MINIO_SECRET_KEY')
  })

  it('bắt được MINIO_PUBLIC_ENDPOINT còn trỏ localhost (rủi ro production đã ghi nhận)', () => {
    expect(messages({ ...secureEnv(), MINIO_PUBLIC_ENDPOINT: 'http://localhost:9200' })).toContain(
      'MINIO_PUBLIC_ENDPOINT',
    )
  })

  it('bắt được mật khẩu seed super_admin còn là mẫu trong repo', () => {
    expect(messages({ ...secureEnv(), SEED_SUPER_ADMIN_PASSWORD: 'Admin@12345' })).toContain(
      'SEED_SUPER_ADMIN_PASSWORD',
    )
  })

  it('AMIS_SSO_SHARED_SECRET rỗng là HỢP LỆ (tính năng tắt, an toàn mặc định)', () => {
    expect(collectConfigIssues({ ...secureEnv(), AMIS_SSO_SHARED_SECRET: '' })).toEqual([])
  })

  it('nhưng AMIS_SSO_SHARED_SECRET ngắn thì bị chặn (secret yếu = mạo danh mọi email)', () => {
    const issues = collectConfigIssues({ ...secureEnv(), AMIS_SSO_SHARED_SECRET: 'abc123' })
    expect(issues.some((i) => i.level === 'fatal' && i.message.includes('AMIS_SSO_SHARED_SECRET'))).toBe(true)
  })

  it('ENABLE_API_DOCS=true chỉ là cảnh báo, không chặn khởi động', () => {
    const issues = collectConfigIssues({ ...secureEnv(), ENABLE_API_DOCS: 'true' })
    expect(issues).toHaveLength(1)
    expect(issues[0].level).toBe('warn')
  })
})

describe('assertSecureConfig', () => {
  it('CHẶN khởi động khi production + secret mặc định + không có cờ nới lỏng', () => {
    const env = { ...secureEnv(), JWT_SECRET: 'change-me' }
    expect(() => assertSecureConfig(env)).toThrow(/TỪ CHỐI KHỞI ĐỘNG/)
  })

  it('thông báo lỗi có chỉ dẫn cách sửa (openssl + tài liệu bàn giao)', () => {
    const env = { ...secureEnv(), JWT_SECRET: 'change-me' }
    expect(() => assertSecureConfig(env)).toThrow(/docs\/devops-handoff\.md/)
  })

  it('CHO PHÉP chạy khi có ALLOW_INSECURE_CONFIG=true (stack dev hiện tại không bị gãy)', () => {
    const env = { ...secureEnv(), JWT_SECRET: 'change-me', ALLOW_INSECURE_CONFIG: 'true' }
    expect(() => assertSecureConfig(env)).not.toThrow()
  })

  it('CHO PHÉP chạy khi không phải production (npm run start:dev)', () => {
    const env = { ...secureEnv(), NODE_ENV: 'development', JWT_SECRET: 'change-me' }
    expect(() => assertSecureConfig(env)).not.toThrow()
  })

  it('cấu hình chuẩn thì im lặng đi qua', () => {
    expect(() => assertSecureConfig(secureEnv())).not.toThrow()
  })
})

describe('corsOrigins', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it('dev không khai báo gì → phản chiếu mọi origin (giữ hành vi trước GĐ7)', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.CORS_ORIGINS
    expect(corsOrigins()).toBe(true)
  })

  it('production không khai báo gì → KHÔNG phản chiếu (chỉ same-origin qua nginx)', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.CORS_ORIGINS
    expect(corsOrigins()).toBe(false)
  })

  it('có CORS_ORIGINS → trả đúng allowlist đã tách và trim', () => {
    process.env.NODE_ENV = 'production'
    process.env.CORS_ORIGINS = 'https://khophim.misa.com.vn, https://amis.misa.vn'
    expect(corsOrigins()).toEqual(['https://khophim.misa.com.vn', 'https://amis.misa.vn'])
  })
})
