import { Logger } from '@nestjs/common'

/**
 * Cấu hình bảo mật tập trung (GĐ7 — Hardening).
 *
 * MỤC ĐÍCH: gom mọi bí mật (JWT secret, MinIO key, mật khẩu seed...) về một chỗ, và
 * CHẶN NGAY LÚC KHỞI ĐỘNG nếu chạy production với giá trị mặc định/yếu — thay vì để app
 * chạy êm với `JWT_SECRET=change-me` (bất kỳ ai biết giá trị này đều tự ký được token
 * super_admin). Lỗi bảo mật nguy hiểm nhất là lỗi im lặng.
 *
 * TƯƠNG THÍCH NGƯỢC — ĐỌC KỸ: Dockerfile backend pin sẵn `NODE_ENV=production` và
 * docker-compose dev cũng đặt `NODE_ENV: production`, nên KHÔNG thể dùng riêng NODE_ENV làm
 * dấu hiệu "đang chạy thật" (làm vậy sẽ khiến stack dev hiện có không khởi động nổi). Cổng
 * chặn thật là biến `ALLOW_INSECURE_CONFIG`:
 *   - `ALLOW_INSECURE_CONFIG=true` (đặt sẵn trong .env.example cho máy dev) → chỉ CẢNH BÁO.
 *   - Không đặt / khác 'true' + NODE_ENV=production → CHẶN KHỞI ĐỘNG kèm hướng dẫn sửa.
 * Việc đầu tiên trong docs/devops-handoff.md là XOÁ biến này khỏi .env production.
 */

const logger = new Logger('SecurityConfig')

/** Giá trị bí mật mặc định/ví dụ đang có trong repo — tuyệt đối không được dùng ở production. */
const WEAK_SECRETS = new Set([
  'change-me',
  'change-me-refresh',
  'secret',
  'changeme',
  'minioadmin',
  'Admin@12345',
  'khophim',
  'root',
  '',
])

/** Độ dài tối thiểu cho một secret được coi là "thật" (~256 bit khi dùng hex/base64). */
export const MIN_SECRET_LENGTH = 32

/**
 * Thuật toán ký JWT DUY NHẤT được chấp nhận. Phải truyền tường minh vào cả `sign` lẫn
 * `verify`: nếu không ép cứng, thư viện có thể chấp nhận token khai `alg` khác (kinh điển
 * là `alg: none` hoặc đổi bất đối xứng → đối xứng) và bỏ qua toàn bộ giá trị của chữ ký.
 * Chuẩn Backend MISA — 02-security-baseline §1.
 */
export const JWT_ALGORITHM = 'HS256' as const

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Có được phép chạy tiếp với cấu hình yếu không. TRUE = chế độ máy dev (chỉ cảnh báo).
 * Xem ghi chú đầu file về lý do không dùng riêng NODE_ENV.
 */
export function insecureConfigAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ALLOW_INSECURE_CONFIG === 'true'
}

/** Secret ký access token. Dev thiếu env → fallback cũ (giữ nguyên hành vi trước GĐ7). */
export function jwtAccessSecret(): string {
  return process.env.JWT_SECRET || 'change-me'
}

/** Secret ký refresh token (KHÁC access secret — xem assertSecureConfig). */
export function jwtRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || 'change-me-refresh'
}

function isWeak(value: string | undefined): boolean {
  if (!value) return true
  if (WEAK_SECRETS.has(value)) return true
  return value.length < MIN_SECRET_LENGTH
}

export interface ConfigIssue {
  /** 'fatal' = chặn khởi động ở production; 'warn' = chỉ cảnh báo. */
  level: 'fatal' | 'warn'
  message: string
}

/**
 * Rà toàn bộ cấu hình nhạy cảm và trả về danh sách vấn đề. Tách riêng khỏi phần
 * throw/log để test được (không cần bootstrap cả app).
 */
export function collectConfigIssues(env: NodeJS.ProcessEnv = process.env): ConfigIssue[] {
  const issues: ConfigIssue[] = []

  if (isWeak(env.JWT_SECRET)) {
    issues.push({
      level: 'fatal',
      message: `JWT_SECRET đang trống/mặc định/quá ngắn (cần >= ${MIN_SECRET_LENGTH} ký tự ngẫu nhiên). Sinh bằng: openssl rand -hex 32`,
    })
  }
  if (isWeak(env.JWT_REFRESH_SECRET)) {
    issues.push({
      level: 'fatal',
      message: `JWT_REFRESH_SECRET đang trống/mặc định/quá ngắn (cần >= ${MIN_SECRET_LENGTH} ký tự ngẫu nhiên). Sinh bằng: openssl rand -hex 32`,
    })
  }
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    issues.push({
      level: 'fatal',
      message: 'JWT_SECRET và JWT_REFRESH_SECRET phải KHÁC nhau (nếu trùng, refresh token dùng được như access token).',
    })
  }

  if (!env.MINIO_ACCESS_KEY || env.MINIO_ACCESS_KEY === 'minioadmin') {
    issues.push({ level: 'fatal', message: 'MINIO_ACCESS_KEY đang là giá trị mặc định "minioadmin".' })
  }
  if (!env.MINIO_SECRET_KEY || env.MINIO_SECRET_KEY === 'minioadmin') {
    issues.push({ level: 'fatal', message: 'MINIO_SECRET_KEY đang là giá trị mặc định "minioadmin".' })
  }

  const publicEndpoint = env.MINIO_PUBLIC_ENDPOINT || ''
  if (!publicEndpoint || /localhost|127\.0\.0\.1/.test(publicEndpoint)) {
    issues.push({
      level: 'fatal',
      message: `MINIO_PUBLIC_ENDPOINT="${publicEndpoint}" chỉ đúng ở máy dev. Trình duyệt người dùng thật KHÔNG upload được. Đổi sang domain thật (có HTTPS).`,
    })
  }

  if (!env.SEED_SUPER_ADMIN_PASSWORD || WEAK_SECRETS.has(env.SEED_SUPER_ADMIN_PASSWORD)) {
    issues.push({
      level: 'fatal',
      message: 'SEED_SUPER_ADMIN_PASSWORD đang là mật khẩu mẫu trong repo — đổi trước khi seed tài khoản quản trị đầu tiên.',
    })
  }

  if (!env.DB_PASSWORD || WEAK_SECRETS.has(env.DB_PASSWORD)) {
    issues.push({ level: 'warn', message: 'DB_PASSWORD đang là giá trị mẫu trong repo.' })
  }

  // SSO AMIS Mobile (GĐ6.1) — rỗng là hợp lệ (tính năng TẮT). Chỉ chặn khi bật bằng secret yếu.
  const ssoSecret = env.AMIS_SSO_SHARED_SECRET
  if (ssoSecret && ssoSecret.length < MIN_SECRET_LENGTH) {
    issues.push({
      level: 'fatal',
      message: `AMIS_SSO_SHARED_SECRET quá ngắn (< ${MIN_SECRET_LENGTH} ký tự). Secret yếu = bất kỳ ai đoán được đều đăng nhập được dưới DANH NGHĨA BẤT KỲ EMAIL nào. Để trống nếu chưa dùng.`,
    })
  }

  if (env.ENABLE_API_DOCS === 'true') {
    issues.push({
      level: 'warn',
      message: 'ENABLE_API_DOCS=true — trang /api/docs công khai toàn bộ API surface. Chỉ bật khi có lớp bảo vệ mạng (VPN/IP allowlist).',
    })
  }

  return issues
}

/**
 * Gọi ở bootstrap. Chế độ nghiêm ngặt (production + KHÔNG có ALLOW_INSECURE_CONFIG=true):
 * có `fatal` → throw, không cho app khởi động. Chế độ dev: chỉ log cảnh báo.
 */
export function assertSecureConfig(env: NodeJS.ProcessEnv = process.env): void {
  const issues = collectConfigIssues(env)
  if (!issues.length) return

  const fatals = issues.filter((i) => i.level === 'fatal')
  const strict = env.NODE_ENV === 'production' && !insecureConfigAllowed(env)

  if (strict && fatals.length) {
    const lines = fatals.map((i, idx) => `  ${idx + 1}. ${i.message}`).join('\n')
    throw new Error(
      `\n[BẢO MẬT] Backend TỪ CHỐI KHỞI ĐỘNG — cấu hình sau không an toàn cho môi trường thật:\n` +
        `${lines}\n\n` +
        `Cách xử lý:\n` +
        `  • Triển khai THẬT: sửa các biến trên (secret sinh bằng "openssl rand -hex 32",\n` +
        `    quản lý qua secret manager). Checklist đầy đủ: docs/devops-handoff.md\n` +
        `  • Máy DEV muốn chạy nhanh với giá trị mẫu: đặt ALLOW_INSECURE_CONFIG=true\n` +
        `    trong .env (đã có sẵn trong .env.example). TUYỆT ĐỐI không đặt ở production.\n`,
    )
  }

  for (const i of issues) {
    logger.warn(`[${i.level === 'fatal' ? 'CHẶN Ở MÔI TRƯỜNG THẬT' : 'Lưu ý'}] ${i.message}`)
  }
  if (fatals.length) {
    logger.warn(
      `Đang chạy chế độ nới lỏng (ALLOW_INSECURE_CONFIG=${env.ALLOW_INSECURE_CONFIG || '(không đặt)'}, ` +
        `NODE_ENV=${env.NODE_ENV || '(không đặt)'}) nên vẫn khởi động. ` +
        `${fatals.length} vấn đề trên SẼ CHẶN khởi động khi bỏ ALLOW_INSECURE_CONFIG ở môi trường thật.`,
    )
  }
}

/** Danh sách origin được phép gọi API. Rỗng ở production = chỉ same-origin (qua nginx). */
export function corsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS?.trim()
  if (raw) return raw.split(',').map((s) => s.trim()).filter(Boolean)
  // Dev: phản chiếu mọi origin (giữ nguyên hành vi cũ cho Vite dev server).
  // Production: không phản chiếu — FE đi cùng origin qua nginx nên không cần CORS.
  return isProduction() ? false : true
}
