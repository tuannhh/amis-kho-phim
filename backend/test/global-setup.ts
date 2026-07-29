import * as mysql from 'mysql2/promise'

/**
 * Dựng lại database e2e SẠCH trước mỗi lần chạy (07-testing-strategy §4: "Dữ liệu kiểm thử
 * nên được thiết lập lại từ đầu trước/sau mỗi lần chạy, để kết quả không phụ thuộc vào
 * trạng thái còn sót lại từ lần chạy trước").
 *
 * DROP rồi CREATE lại: an toàn vì đây là database RIÊNG cho e2e (`kho_phim_e2e`), tách hẳn
 * khỏi `kho_phim` của dev. Schema sau đó do chính TypeORM dựng qua `migrationsRun: true`
 * khi AppModule khởi tạo — nghĩa là e2e cũng đồng thời xác minh luôn rằng bộ migration
 * chạy được từ database trống.
 */
export default async function globalSetup(): Promise<void> {
  const host = process.env.E2E_DB_HOST || '127.0.0.1'
  const port = Number(process.env.E2E_DB_PORT || 3307)
  const user = process.env.E2E_DB_USER || 'khophim'
  const password = process.env.E2E_DB_PASSWORD || 'khophim'
  const database = process.env.E2E_DB_NAME || 'kho_phim_e2e'

  if (database === 'kho_phim') {
    throw new Error('CHẶN AN TOÀN: e2e không được phép chạy trên database "kho_phim" của dev.')
  }

  // Tài khoản ứng dụng (`khophim`) CỐ Ý chỉ có quyền trên database của chính nó — đúng
  // nguyên tắc đặc quyền tối thiểu. Vì vậy việc tạo database e2e phải dùng tài khoản quản
  // trị, rồi CẤP QUYỀN lại cho tài khoản ứng dụng. Bản thân bộ test vẫn chạy dưới tài khoản
  // ứng dụng, không chạy dưới root — để e2e phản ánh đúng quyền hạn thật lúc vận hành.
  const rootUser = process.env.E2E_DB_ROOT_USER || 'root'
  const rootPassword = process.env.E2E_DB_ROOT_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || 'root'

  let conn: mysql.Connection
  try {
    conn = await mysql.createConnection({
      host,
      port,
      user: rootUser,
      password: rootPassword,
      multipleStatements: true,
    })
  } catch (e) {
    throw new Error(
      `Không kết nối được MySQL tại ${host}:${port} bằng tài khoản quản trị "${rootUser}" — ` +
        `kiểm thử tích hợp cần MySQL đang chạy.\n` +
        `Khởi động bằng: docker compose up -d mysql\n` +
        `Lỗi gốc: ${(e as Error).message}`,
    )
  }

  await conn.query(`DROP DATABASE IF EXISTS \`${database}\``)
  await conn.query(
    `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await conn.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO ?@'%'`, [user])
  await conn.query('FLUSH PRIVILEGES')
  await conn.end()

  // eslint-disable-next-line no-console
  console.log(`\n[e2e] Đã dựng lại database sạch "${database}" tại ${host}:${port}\n`)
}
