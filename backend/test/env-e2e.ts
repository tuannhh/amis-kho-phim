/**
 * Biến môi trường cho kiểm thử tích hợp (e2e). Nạp TRƯỚC khi bất kỳ module nào được import.
 *
 * NGUYÊN TẮC BẮT BUỘC (07-testing-strategy §4): dữ liệu kiểm thử phải TÁCH BIỆT HOÀN TOÀN
 * khỏi dữ liệu vận hành. Vì vậy e2e dùng một DATABASE RIÊNG (`kho_phim_e2e`), không bao giờ
 * chạm vào `kho_phim` của môi trường dev. `test/global-setup.ts` tạo và dọn sạch DB này
 * trước mỗi lần chạy.
 */

// Kết nối tới MySQL/MinIO của Docker Compose qua cổng đã map ra host.
process.env.DB_HOST = process.env.E2E_DB_HOST || '127.0.0.1'
process.env.DB_PORT = process.env.E2E_DB_PORT || '3307'
process.env.DB_USER = process.env.E2E_DB_USER || 'khophim'
process.env.DB_PASSWORD = process.env.E2E_DB_PASSWORD || 'khophim'
process.env.DB_NAME = process.env.E2E_DB_NAME || 'kho_phim_e2e'
process.env.DB_ENABLED = 'true'

// Secret riêng cho e2e — KHÔNG dùng lại secret của bất kỳ môi trường nào khác.
process.env.JWT_SECRET = 'e2e-access-secret-'.padEnd(48, 'x')
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-'.padEnd(48, 'y')
process.env.JWT_ACCESS_TTL = '15m'
process.env.JWT_REFRESH_TTL = '7d'

// Tài khoản quản trị hạt giống dành riêng cho e2e.
process.env.SEED_SUPER_ADMIN_EMAIL = 'e2e-super@misa.com.vn'
process.env.SEED_SUPER_ADMIN_PASSWORD = 'E2eSuper@2026'
process.env.SEED_SUPER_ADMIN_NAME = 'E2E Super Admin'

// MinIO qua cổng host. StorageService bắt lỗi khi không kết nối được nên e2e vẫn chạy
// được nếu MinIO không bật — chỉ các assert liên quan storage bị ảnh hưởng.
process.env.MINIO_ENDPOINT = process.env.E2E_MINIO_HOST || '127.0.0.1'
process.env.MINIO_PORT = process.env.E2E_MINIO_PORT || '9200'
process.env.MINIO_PUBLIC_ENDPOINT = `http://127.0.0.1:${process.env.MINIO_PORT}`
process.env.MINIO_BUCKET = 'kho-phim'
process.env.MAX_UPLOAD_MB = '2048'

// SSO để trống = TẮT; ca test bật SSO sẽ tự set trong chính bài test đó.
process.env.AMIS_SSO_SHARED_SECRET = ''
