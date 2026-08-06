import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ThrottlerGuard } from '@nestjs/throttler'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { createHmac } from 'crypto'
import { AppModule } from '../src/app.module'
import {
  LEGACY_ROLE_MAP,
  RBAC4_ROLES,
  migrateLegacyRoles,
} from '../src/database/migrations/1722000000000-AddDepartmentsAndRbac4Levels'

/**
 * KIỂM THỬ TÍCH HỢP (e2e) — chạy trên MySQL THẬT, route THẬT, guard THẬT.
 *
 * Vì sao cần dù đã có unit test (07-testing-strategy §1): unit test thay toàn bộ repository
 * bằng mock, nên chỉ chứng minh "logic đúng VỚI GIẢ ĐỊNH tầng dữ liệu hoạt động như mock mô
 * tả". Nó KHÔNG bắt được: câu truy vấn sai cú pháp thật, quan hệ entity khai báo sai, migration
 * không chạy được, guard toàn cục không được lắp đúng thứ tự, hay `ValidationPipe` không thực
 * sự loại bỏ field lạ. Đó là "lỗi ở ranh giới giữa các thành phần" mà chuẩn nói chỉ kiểm thử
 * tích hợp mới thấy.
 *
 * Phạm vi ưu tiên theo RỦI RO (11-phase-refactor-legacy §7): xác thực, phân quyền theo vai trò,
 * SCOPE PHÒNG BAN của RBAC 4 cấp (ADR-040), quyền sở hữu (IDOR), validate đầu vào, endpoint
 * công khai — không phủ cơ học CRUD.
 *
 * Dữ liệu: database RIÊNG `kho_phim_e2e`, dựng lại sạch mỗi lần chạy (xem global-setup.ts).
 */

const SUPER_EMAIL = 'e2e-super@misa.com.vn'
const SUPER_PASSWORD = 'E2eSuper@2026'

describe('AMIS Kho phim — kiểm thử tích hợp (DB thật)', () => {
  let app: INestApplication
  let http: () => request.Agent
  let dataSource: DataSource

  let superToken: string
  let superId: number

  // ── Danh bạ tài khoản test, mỗi cấp/mỗi phòng ban một tài khoản ─────────────
  let viewerToken: string
  let empA1Token: string
  let empA1Id: number
  let empA2Token: string
  let empB1Token: string
  let mgrA1Token: string
  let mgrA1Id: number
  let mgrA2Token: string
  let mgrB1Token: string

  let deptAId: number
  let deptBId: number
  let categoryId: number

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Vô hiệu hoá rate limit cho phần lớn bài test (nếu không, hàng chục lần đăng nhập
      // trong bộ test sẽ tự đâm vào ngưỡng 10/phút). Có một describe riêng ở cuối bật lại
      // guard thật để xác minh chính cơ chế rate limit — không bỏ qua nó.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile()

    app = moduleRef.createNestApplication()
    // Lặp lại đúng cấu hình bootstrap thật (main.ts) — nếu không, e2e sẽ kiểm một ứng dụng
    // khác với ứng dụng đang chạy production.
    app.setGlobalPrefix('api', {
      exclude: [
        { path: 'media/:key', method: RequestMethod.GET },
        { path: 'media/:key', method: RequestMethod.HEAD },
      ],
    })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    http = () => request(app.getHttpServer())
    dataSource = app.get(DataSource)

    // Đăng nhập bằng tài khoản seed do chính AppModule tạo lúc khởi động.
    const login = await http()
      .post('/api/auth/login')
      .send({ email: SUPER_EMAIL, password: SUPER_PASSWORD })
      .expect(200)
    superToken = login.body.accessToken
    superId = login.body.user.id

    // Hai phòng ban thật để kiểm scope quyền Cấp 3.
    const mkDept = async (name: string) => {
      const r = await http()
        .post('/api/departments')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ name })
        .expect(201)
      return r.body.id as number
    }
    deptAId = await mkDept('Phòng E2E A')
    deptBId = await mkDept('Phòng E2E B')

    const mk = async (email: string, roleCode: string, password: string, departmentId?: number) => {
      const body: Record<string, unknown> = { email, fullName: email, roleCode, password }
      if (departmentId !== undefined) body.departmentId = departmentId
      const r = await http()
        .post('/api/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send(body)
        .expect(201)
      const t = await http().post('/api/auth/login').send({ email, password }).expect(200)
      return { id: r.body.user.id as number, token: t.body.accessToken as string }
    }

    viewerToken = (await mk('e2e-xem@misa.com.vn', 'viewer', 'E2eXem@2026')).token
    const empA1 = await mk('e2e-nv-a1@misa.com.vn', 'employee', 'E2eNvA1@2026', deptAId)
    empA1Token = empA1.token
    empA1Id = empA1.id
    empA2Token = (await mk('e2e-nv-a2@misa.com.vn', 'employee', 'E2eNvA2@2026', deptAId)).token
    empB1Token = (await mk('e2e-nv-b1@misa.com.vn', 'employee', 'E2eNvB1@2026', deptBId)).token
    const mgrA1 = await mk('e2e-tp-a1@misa.com.vn', 'dept_manager', 'E2eTpA1@2026', deptAId)
    mgrA1Token = mgrA1.token
    mgrA1Id = mgrA1.id
    mgrA2Token = (await mk('e2e-tp-a2@misa.com.vn', 'dept_manager', 'E2eTpA2@2026', deptAId)).token
    mgrB1Token = (await mk('e2e-tp-b1@misa.com.vn', 'dept_manager', 'E2eTpB1@2026', deptBId)).token

    const cat = await http()
      .post('/api/categories')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ name: 'Chuyên mục E2E' })
      .expect(201)
    categoryId = cat.body.id
  })

  afterAll(async () => {
    await app?.close()
  })

  /** Tạo 1 phim bằng token cho trước, trả về {id, slug, departmentId}. */
  const createFilm = async (token: string, title: string) => {
    const r = await http()
      .post('/api/films')
      .set('Authorization', `Bearer ${token}`)
      .send({ title, categoryId })
      .expect(201)
    return r.body as { id: number; slug: string; departmentId: number | null }
  }

  // ── Sức khoẻ & migration ────────────────────────────────────────────────
  describe('Health & migration', () => {
    it('liveness trả ok', async () => {
      const r = await http().get('/api/health').expect(200)
      expect(r.body.status).toBe('ok')
    })

    it('readiness kết nối được MySQL thật (chứng tỏ migration đã chạy từ DB trống)', async () => {
      const r = await http().get('/api/health/ready').expect(200)
      expect(r.body.database).toBe('ok')
    })
  })

  // ── Migration RBAC 4 cấp trên MySQL thật (ADR-040/041) ───────────────────
  describe('Migration RBAC 4 cấp — lược đồ + dữ liệu vai trò cũ → mới', () => {
    it('bảng `roles` chứa ĐÚNG 4 vai trò mới, KHÔNG còn `admin`', async () => {
      const rows: Array<{ code: string; name: string }> = await dataSource.query(
        'SELECT `code`, `name` FROM `roles` ORDER BY `code`',
      )
      expect(rows.map((r) => r.code).sort()).toEqual(['dept_manager', 'employee', 'super_admin', 'viewer'])
      for (const expected of RBAC4_ROLES) {
        expect(rows.find((r) => r.code === expected.code)?.name).toBe(expected.name)
      }
    })

    it('bảng `departments` và các cột phòng ban/truy vết đã tồn tại thật', async () => {
      const cols: Array<{ TABLE_NAME: string; COLUMN_NAME: string; IS_NULLABLE: string }> =
        await dataSource.query(
          'SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS ' +
            'WHERE TABLE_SCHEMA = DATABASE() AND ' +
            "((TABLE_NAME = 'users' AND COLUMN_NAME = 'department_id') OR " +
            "(TABLE_NAME = 'films' AND COLUMN_NAME = 'department_id') OR " +
            "(TABLE_NAME = 'categories' AND COLUMN_NAME IN ('created_by', 'department_id')) OR " +
            "(TABLE_NAME = 'departments' AND COLUMN_NAME = 'name'))",
        )
      const found = cols.map((c) => `${c.TABLE_NAME}.${c.COLUMN_NAME}`).sort()
      expect(found).toEqual([
        'categories.created_by',
        'categories.department_id',
        'departments.name',
        'films.department_id',
        'users.department_id',
      ])
      // Mọi cột phòng ban đều NULLABLE (Cấp 1/Cấp 4 không cần thuộc phòng ban nào).
      for (const c of cols.filter((x) => x.COLUMN_NAME !== 'name')) {
        expect(c.IS_NULLABLE).toBe('YES')
      }
    })

    it('MAP vai trò cũ → mới đúng như ADR-041 (admin → super_admin, KHÔNG phải dept_manager)', () => {
      expect(LEGACY_ROLE_MAP).toEqual({
        super_admin: 'super_admin',
        admin: 'super_admin',
        employee: 'employee',
      })
    })

    it('tài khoản `admin` cũ trong DB được migrate thành `super_admin` (chạy SQL THẬT)', async () => {
      // Chèn trực tiếp một tài khoản mang vai trò CŨ để mô phỏng DB trước migration —
      // migration đã chạy lúc khởi động nên không còn dòng `admin` nào để quan sát tự nhiên.
      await dataSource.query(
        'INSERT INTO `users` (`email`, `full_name`, `password_hash`, `role_code`, `is_active`, `must_change_password`) ' +
          "VALUES ('e2e-admin-cu@misa.com.vn', 'Admin cũ', 'x', 'admin', 1, 0)",
      )
      const queryRunner = dataSource.createQueryRunner()
      try {
        await migrateLegacyRoles(queryRunner)
      } finally {
        await queryRunner.release()
      }

      const rows: Array<{ role_code: string }> = await dataSource.query(
        "SELECT `role_code` FROM `users` WHERE `email` = 'e2e-admin-cu@misa.com.vn'",
      )
      expect(rows[0].role_code).toBe('super_admin')

      // Chạy lại lần nữa: idempotent, không lỗi, không đổi thêm gì.
      const qr2 = dataSource.createQueryRunner()
      try {
        await migrateLegacyRoles(qr2)
      } finally {
        await qr2.release()
      }
      const again: Array<{ role_code: string }> = await dataSource.query(
        "SELECT `role_code` FROM `users` WHERE `email` = 'e2e-admin-cu@misa.com.vn'",
      )
      expect(again[0].role_code).toBe('super_admin')

      await dataSource.query("DELETE FROM `users` WHERE `email` = 'e2e-admin-cu@misa.com.vn'")
    })
  })

  // ── Xác thực ─────────────────────────────────────────────────────────────
  describe('Xác thực', () => {
    it('sai mật khẩu → 401', () =>
      http().post('/api/auth/login').send({ email: SUPER_EMAIL, password: 'sai' }).expect(401))

    it('email không tồn tại → 401 cùng thông điệp (không lộ email nào có thật)', async () => {
      const a = await http().post('/api/auth/login').send({ email: SUPER_EMAIL, password: 'sai' })
      const b = await http()
        .post('/api/auth/login')
        .send({ email: 'khong-ton-tai@misa.com.vn', password: 'sai' })
      expect(a.body.message).toBe(b.body.message)
    })

    it('email sai định dạng bị ValidationPipe chặn → 400', () =>
      http().post('/api/auth/login').send({ email: 'khong-phai-email', password: 'x' }).expect(400))

    it('không có token → 401', () => http().get('/api/films').expect(401))

    it('token rác → 401', () =>
      http().get('/api/films').set('Authorization', 'Bearer rac').expect(401))

    it('/auth/me trả đúng danh tính đang đăng nhập, KHÔNG kèm password_hash', async () => {
      const r = await http().get('/api/auth/me').set('Authorization', `Bearer ${superToken}`).expect(200)
      expect(r.body.email).toBe(SUPER_EMAIL)
      expect(r.body.roleCode).toBe('super_admin')
      expect(r.body).not.toHaveProperty('passwordHash')
      expect(r.body).not.toHaveProperty('password_hash')
    })

    it('/auth/me trả kèm departmentId để FE ẩn/hiện nút đúng cấp', async () => {
      const r = await http().get('/api/auth/me').set('Authorization', `Bearer ${mgrA1Token}`).expect(200)
      expect(r.body.roleCode).toBe('dept_manager')
      expect(r.body.departmentId).toBe(deptAId)
    })

    it('refresh token đổi được cặp token mới, và access token cũ vẫn dùng được', async () => {
      const login = await http()
        .post('/api/auth/login')
        .send({ email: SUPER_EMAIL, password: SUPER_PASSWORD })
        .expect(200)
      const r = await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(200)
      expect(r.body.accessToken).toBeTruthy()
      await http().get('/api/auth/me').set('Authorization', `Bearer ${r.body.accessToken}`).expect(200)
    })

    it('KHÔNG cho dùng access token thay refresh token ở /auth/refresh', async () => {
      const login = await http()
        .post('/api/auth/login')
        .send({ email: SUPER_EMAIL, password: SUPER_PASSWORD })
        .expect(200)
      await http().post('/api/auth/refresh').send({ refreshToken: login.body.accessToken }).expect(401)
    })

    it('KHÔNG cho dùng refresh token để gọi API thường', async () => {
      const login = await http()
        .post('/api/auth/login')
        .send({ email: SUPER_EMAIL, password: SUPER_PASSWORD })
        .expect(200)
      await http().get('/api/films').set('Authorization', `Bearer ${login.body.refreshToken}`).expect(401)
    })
  })

  // ── SSO AMIS Mobile (GĐ6.1) ──────────────────────────────────────────────
  describe('SSO AMIS Mobile', () => {
    const makeToken = (payload: object, secret: string) => {
      const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
      return `${b64}.${createHmac('sha256', secret).update(b64).digest('hex')}`
    }
    const exp = () => Math.floor(Date.now() / 1000) + 60

    afterEach(() => {
      process.env.AMIS_SSO_SHARED_SECRET = ''
    })

    it('chưa cấu hình secret → 501 (TẮT an toàn mặc định), không phải 500', () =>
      http()
        .post('/api/auth/sso/amis-mobile')
        .send({ token: makeToken({ email: SUPER_EMAIL, exp: exp() }, 'bat-ky') })
        .expect(501))

    it('secret quá ngắn → 501, từ chối bật với secret yếu', () => {
      process.env.AMIS_SSO_SHARED_SECRET = 'ngan'
      return http()
        .post('/api/auth/sso/amis-mobile')
        .send({ token: makeToken({ email: SUPER_EMAIL, exp: exp() }, 'ngan') })
        .expect(501)
    })

    it('secret hợp lệ + token đúng → cấp JWT dùng được thật', async () => {
      const secret = 'e2e-sso-secret-'.padEnd(40, 'z')
      process.env.AMIS_SSO_SHARED_SECRET = secret
      const r = await http()
        .post('/api/auth/sso/amis-mobile')
        .send({ token: makeToken({ email: SUPER_EMAIL, exp: exp() }, secret) })
        .expect(200)
      await http().get('/api/auth/me').set('Authorization', `Bearer ${r.body.accessToken}`).expect(200)
    })

    it('chữ ký sai → 401', () => {
      const secret = 'e2e-sso-secret-'.padEnd(40, 'z')
      process.env.AMIS_SSO_SHARED_SECRET = secret
      return http()
        .post('/api/auth/sso/amis-mobile')
        .send({ token: makeToken({ email: SUPER_EMAIL, exp: exp() }, 'secret-cua-ke-tan-cong-abcdefgh') })
        .expect(401)
    })

    it('token có hạn quá dài → 401 (giới hạn cửa sổ replay)', () => {
      const secret = 'e2e-sso-secret-'.padEnd(40, 'z')
      process.env.AMIS_SSO_SHARED_SECRET = secret
      const farFuture = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
      return http()
        .post('/api/auth/sso/amis-mobile')
        .send({ token: makeToken({ email: SUPER_EMAIL, exp: farFuture }, secret) })
        .expect(401)
    })
  })

  // ── CẤP 1 (viewer) — chốt chặn quan trọng nhất của đợt này ────────────────
  describe('CẤP 1 (viewer) — chỉ XEM, mọi route ghi đều 403', () => {
    let filmOfEmpA1: { id: number; slug: string }

    beforeAll(async () => {
      filmOfEmpA1 = await createFilm(empA1Token, 'Phim cho ca kiểm Cấp 1')
    })

    it('XEM được danh sách phim và chi tiết phim', async () => {
      await http().get('/api/films').set('Authorization', `Bearer ${viewerToken}`).expect(200)
      await http()
        .get(`/api/films/${filmOfEmpA1.slug}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200)
    })

    it('ghi nhận được lượt xem (Cấp 1 vẫn là người xem hợp lệ)', () =>
      http()
        .post(`/api/films/${filmOfEmpA1.id}/view`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(201))

    it('KHÔNG TẠO được phim → 403 (khoảng trống phân quyền cũ đã bịt)', () =>
      http()
        .post('/api/films')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'Cấp 1 cố tạo phim', categoryId })
        .expect(403))

    it('KHÔNG sửa được phim của người khác → 403', () =>
      http()
        .patch(`/api/films/${filmOfEmpA1.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'Cấp 1 cố sửa', categoryId })
        .expect(403))

    it('KHÔNG xoá được phim → 403', () =>
      http()
        .delete(`/api/films/${filmOfEmpA1.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403))

    it('KHÔNG xin được presigned upload URL → 403 (không rò URL ghi vào storage)', () =>
      http()
        .post(`/api/films/${filmOfEmpA1.id}/upload-url`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ contentType: 'video/mp4', size: 1024 })
        .expect(403))

    it('KHÔNG upload được ảnh bìa → 403', () =>
      http()
        .post(`/api/films/${filmOfEmpA1.id}/thumbnail`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403))

    it('KHÔNG tạo được version mới → 403', () =>
      http()
        .post(`/api/films/${filmOfEmpA1.id}/versions`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ storageKey: `video-${'0'.repeat(8)}-0000-0000-0000-000000000000.mp4` })
        .expect(403))

    it('KHÔNG vào được /users, /reports, /departments, /categories(ghi) → 403', async () => {
      await http().get('/api/users').set('Authorization', `Bearer ${viewerToken}`).expect(403)
      await http().get('/api/reports/films').set('Authorization', `Bearer ${viewerToken}`).expect(403)
      await http().get('/api/departments').set('Authorization', `Bearer ${viewerToken}`).expect(403)
      await http()
        .post('/api/categories')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Cấp 1 cố tạo chuyên mục' })
        .expect(403)
    })
  })

  // ── Phân quyền theo vai trò ──────────────────────────────────────────────
  describe('Phân quyền theo vai trò (RolesGuard chạy thật)', () => {
    it('CẤP 2 KHÔNG xem được danh sách người dùng / báo cáo / phòng ban → 403', async () => {
      await http().get('/api/users').set('Authorization', `Bearer ${empA1Token}`).expect(403)
      await http().get('/api/reports/films').set('Authorization', `Bearer ${empA1Token}`).expect(403)
      await http().get('/api/departments').set('Authorization', `Bearer ${empA1Token}`).expect(403)
    })

    it('CẤP 3 KHÔNG xem được danh sách người dùng / báo cáo / phòng ban → 403', async () => {
      await http().get('/api/users').set('Authorization', `Bearer ${mgrA1Token}`).expect(403)
      await http().get('/api/reports/films').set('Authorization', `Bearer ${mgrA1Token}`).expect(403)
      await http().get('/api/departments').set('Authorization', `Bearer ${mgrA1Token}`).expect(403)
    })

    it('CẤP 3 KHÔNG tạo được tài khoản → 403 (khác hẳn `admin` cũ)', () =>
      http()
        .post('/api/users')
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .send({ email: 'e2e-tp-tao@misa.com.vn', fullName: 'TP tạo', roleCode: 'employee', password: 'E2eX@20261' })
        .expect(403))

    // Quyền ghi chuyên mục phân theo TẦNG (ADR-051): gốc = Cấp 4, con = Cấp 2 trở lên.
    it('CẤP 2 và CẤP 3 KHÔNG tạo được chuyên mục GỐC → 403', async () => {
      await http()
        .post('/api/categories')
        .set('Authorization', `Bearer ${empA1Token}`)
        .send({ name: 'Cấp 2 cố tạo gốc' })
        .expect(403)
      await http()
        .post('/api/categories')
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .send({ name: 'Cấp 3 cố tạo gốc' })
        .expect(403)
    })

    it('CẤP 2 và CẤP 3 TẠO ĐƯỢC chuyên mục CON bên trong chuyên mục gốc có sẵn', async () => {
      const child2 = await http()
        .post('/api/categories')
        .set('Authorization', `Bearer ${empA1Token}`)
        .send({ name: 'Cấp 2 tạo con', parentId: categoryId })
        .expect(201)
      expect(child2.body.parentId).toBe(categoryId)

      const child3 = await http()
        .post('/api/categories')
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .send({ name: 'Cấp 3 tạo con', parentId: categoryId })
        .expect(201)
      expect(child3.body.parentId).toBe(categoryId)

      // …và sửa/xoá được chuyên mục con đó
      await http()
        .patch(`/api/categories/${child2.body.id}`)
        .set('Authorization', `Bearer ${empA1Token}`)
        .send({ name: 'Cấp 2 sửa con' })
        .expect(200)
      await http()
        .delete(`/api/categories/${child3.body.id}`)
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .expect(204)
    })

    it('CẤP 2/CẤP 3 KHÔNG sửa/xoá được chuyên mục GỐC → 403', async () => {
      await http()
        .patch(`/api/categories/${categoryId}`)
        .set('Authorization', `Bearer ${empA1Token}`)
        .send({ name: 'Cấp 2 cố sửa gốc' })
        .expect(403)
      await http()
        .delete(`/api/categories/${categoryId}`)
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .expect(403)
    })

    it('CẤP 1 KHÔNG tạo được chuyên mục con (bị guard chặn từ vòng ngoài) → 403', () =>
      http()
        .post('/api/categories')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Cấp 1 cố tạo con', parentId: categoryId })
        .expect(403))

    it('CẤP 4 xem được danh sách người dùng, báo cáo và phòng ban', async () => {
      await http().get('/api/users').set('Authorization', `Bearer ${superToken}`).expect(200)
      await http().get('/api/reports/films').set('Authorization', `Bearer ${superToken}`).expect(200)
      await http().get('/api/departments').set('Authorization', `Bearer ${superToken}`).expect(200)
    })

    it('KHÔNG ai tạo được tài khoản Cấp 4 (DTO chặn giá trị vai trò)', () =>
      http()
        .post('/api/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ email: 'e2e-super2@misa.com.vn', fullName: 'Super Hai', roleCode: 'super_admin', password: 'E2eX@20261' })
        .expect(400))

    it('vai trò `admin` cũ KHÔNG còn được DTO chấp nhận → 400', () =>
      http()
        .post('/api/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ email: 'e2e-admin-moi@misa.com.vn', fullName: 'Admin', roleCode: 'admin', password: 'E2eX@20261' })
        .expect(400))

    it('CẤP 4 KHÔNG tự khoá được chính mình → 403', () =>
      http()
        .patch(`/api/users/${superId}/status`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ isActive: false })
        .expect(403))

    it('danh sách người dùng trả về KHÔNG chứa password_hash ở bất kỳ bản ghi nào', async () => {
      const r = await http().get('/api/users').set('Authorization', `Bearer ${superToken}`).expect(200)
      expect(r.body.length).toBeGreaterThan(0)
      for (const u of r.body) {
        expect(u).not.toHaveProperty('passwordHash')
        expect(u).not.toHaveProperty('password_hash')
      }
    })
  })

  // ── Danh mục phòng ban (Cấp 4) ───────────────────────────────────────────
  describe('Danh mục phòng ban — chỉ Cấp 4, chặn xoá khi còn tham chiếu', () => {
    it('tạo trùng tên → 409 (ràng buộc unique thật ở DB)', () =>
      http()
        .post('/api/departments')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ name: 'Phòng E2E A' })
        .expect(409))

    it('tên quá ngắn → 400', () =>
      http()
        .post('/api/departments')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ name: 'A' })
        .expect(400))

    it('danh sách kèm số người dùng thật của từng phòng ban', async () => {
      const r = await http().get('/api/departments').set('Authorization', `Bearer ${superToken}`).expect(200)
      const a = r.body.find((d: { id: number }) => d.id === deptAId)
      // Phòng A có 2 nhân viên + 2 trưởng phòng đã tạo ở beforeAll.
      expect(a.userCount).toBe(4)
    })

    it('KHÔNG xoá được phòng ban đang có người dùng → 409', () =>
      http().delete(`/api/departments/${deptAId}`).set('Authorization', `Bearer ${superToken}`).expect(409))

    it('sửa tên và xoá phòng ban trống thì được', async () => {
      const created = await http()
        .post('/api/departments')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ name: 'Phòng E2E tạm' })
        .expect(201)
      const renamed = await http()
        .patch(`/api/departments/${created.body.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ name: 'Phòng E2E tạm đã đổi tên' })
        .expect(200)
      expect(renamed.body.name).toBe('Phòng E2E tạm đã đổi tên')
      await http()
        .delete(`/api/departments/${created.body.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .expect(204)
    })

    it('xoá phòng ban không tồn tại → 404', () =>
      http().delete('/api/departments/999999').set('Authorization', `Bearer ${superToken}`).expect(404))
  })

  // ── Gán vai trò / phòng ban cho tài khoản (Cấp 4) ─────────────────────────
  describe('Sửa tài khoản — gán lại Cấp 1/Cấp 3 và phòng ban', () => {
    let tempId: number

    beforeAll(async () => {
      const r = await http()
        .post('/api/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          email: 'e2e-gan-lai@misa.com.vn',
          fullName: 'Gán lại',
          roleCode: 'viewer',
          password: 'E2eGan@2026',
        })
        .expect(201)
      tempId = r.body.user.id
    })

    it('tài khoản mới không gán phòng ban → departmentId null', async () => {
      const r = await http().get('/api/users').set('Authorization', `Bearer ${superToken}`).expect(200)
      expect(r.body.find((u: { id: number }) => u.id === tempId).departmentId).toBeNull()
    })

    it('nâng Cấp 1 → Cấp 3 kèm phòng ban', async () => {
      const r = await http()
        .patch(`/api/users/${tempId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ roleCode: 'dept_manager', departmentId: deptBId })
        .expect(200)
      expect(r.body.roleCode).toBe('dept_manager')
      expect(r.body.departmentId).toBe(deptBId)
    })

    it('phòng ban không tồn tại → 400 (không tin id client gửi lên)', () =>
      http()
        .patch(`/api/users/${tempId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ departmentId: 999999 })
        .expect(400))

    it('departmentId = null → bỏ gán phòng ban', async () => {
      const r = await http()
        .patch(`/api/users/${tempId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ departmentId: null })
        .expect(200)
      expect(r.body.departmentId).toBeNull()
    })

    it('KHÔNG nâng được ai lên Cấp 4 → 400', () =>
      http()
        .patch(`/api/users/${tempId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ roleCode: 'super_admin' })
        .expect(400))

    it('Cấp 3 KHÔNG sửa được tài khoản người khác → 403', () =>
      http()
        .patch(`/api/users/${tempId}`)
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .send({ roleCode: 'viewer' })
        .expect(403))
  })

  // ── SCOPE PHÒNG BAN — trái tim của đợt thay đổi này ───────────────────────
  describe('Scope phòng ban (RBAC 4 cấp) — ai sửa/xoá được phim của ai', () => {
    let filmEmpA1: { id: number; slug: string; departmentId: number | null }
    let filmEmpB1: { id: number; slug: string }
    let filmMgrA2: { id: number; slug: string }
    let filmSuper: { id: number; slug: string }

    beforeAll(async () => {
      filmEmpA1 = await createFilm(empA1Token, 'Phim của nhân viên A1')
      filmEmpB1 = await createFilm(empB1Token, 'Phim của nhân viên B1')
      filmMgrA2 = await createFilm(mgrA2Token, 'Phim của trưởng phòng A2')
      filmSuper = await createFilm(superToken, 'Phim của quản trị cao nhất')
    })

    it('SNAPSHOT: phim mới mang department_id của người tạo lúc tạo', () => {
      expect(filmEmpA1.departmentId).toBe(deptAId)
    })

    it('uploaderId + departmentId lấy từ token/DB, KHÔNG nhận từ body (chống giả mạo scope)', async () => {
      const r = await http()
        .post('/api/films')
        .set('Authorization', `Bearer ${empB1Token}`)
        .send({
          title: 'Phim thử giả mạo chủ sở hữu và phòng ban',
          categoryId,
          uploaderId: 99999,
          departmentId: deptAId, // cố khai phòng A dù mình thuộc phòng B
        })
        .expect(201)
      expect(r.body.departmentId).toBe(deptBId)
      expect(r.body.uploaderId).not.toBe(99999)
    })

    it('CẤP 2 sửa được phim CỦA CHÍNH MÌNH', async () => {
      const r = await http()
        .patch(`/api/films/${filmEmpA1.id}`)
        .set('Authorization', `Bearer ${empA1Token}`)
        .send({ title: 'A1 tự sửa phim của mình', categoryId })
        .expect(200)
      expect(r.body.title).toBe('A1 tự sửa phim của mình')
    })

    it('CẤP 2 KHÔNG sửa được phim của Cấp 2 khác DÙ CÙNG PHÒNG BAN → 403', () =>
      http()
        .patch(`/api/films/${filmEmpA1.id}`)
        .set('Authorization', `Bearer ${empA2Token}`)
        .send({ title: 'A2 chiếm phim của A1', categoryId })
        .expect(403))

    it('CẤP 2 KHÔNG xoá được phim của Cấp 2 khác cùng phòng ban → 403', () =>
      http().delete(`/api/films/${filmEmpA1.id}`).set('Authorization', `Bearer ${empA2Token}`).expect(403))

    it('CẤP 2 KHÔNG xin được presigned URL cho phim người khác → 403', () =>
      http()
        .post(`/api/films/${filmEmpA1.id}/upload-url`)
        .set('Authorization', `Bearer ${empA2Token}`)
        .send({ contentType: 'video/mp4', size: 1024 })
        .expect(403))

    it('CẤP 2 KHÔNG tạo được version mới cho phim người khác → 403', () =>
      http()
        .post(`/api/films/${filmEmpA1.id}/versions`)
        .set('Authorization', `Bearer ${empA2Token}`)
        .send({ storageKey: `video-${'0'.repeat(8)}-0000-0000-0000-000000000000.mp4` })
        .expect(403))

    it('CẤP 3 SỬA ĐƯỢC phim của Cấp 2 CÙNG phòng ban', async () => {
      const r = await http()
        .patch(`/api/films/${filmEmpA1.id}`)
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .send({ title: 'Trưởng phòng A1 sửa phim của nhân viên cùng phòng', categoryId })
        .expect(200)
      expect(r.body.title).toBe('Trưởng phòng A1 sửa phim của nhân viên cùng phòng')
    })

    it('CẤP 3 KHÔNG sửa được phim của Cấp 2 ở PHÒNG BAN KHÁC → 403', () =>
      http()
        .patch(`/api/films/${filmEmpB1.id}`)
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .send({ title: 'Trưởng phòng A cố sửa phim phòng B', categoryId })
        .expect(403))

    it('CẤP 3 KHÔNG sửa được phim của CẤP 3 KHÁC cùng phòng ban → 403', () =>
      http()
        .patch(`/api/films/${filmMgrA2.id}`)
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .send({ title: 'TP A1 cố sửa phim TP A2', categoryId })
        .expect(403))

    it('CẤP 3 KHÔNG sửa được phim của CẤP 4 → 403', () =>
      http()
        .patch(`/api/films/${filmSuper.id}`)
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .send({ title: 'TP cố sửa phim quản trị', categoryId })
        .expect(403))

    it('CẤP 3 sửa được phim CỦA CHÍNH MÌNH', () =>
      http()
        .patch(`/api/films/${filmMgrA2.id}`)
        .set('Authorization', `Bearer ${mgrA2Token}`)
        .send({ title: 'TP A2 tự sửa phim của mình', categoryId })
        .expect(200))

    it('CẤP 3 ở phòng khác KHÔNG xoá được phim phòng A → 403', () =>
      http().delete(`/api/films/${filmEmpA1.id}`).set('Authorization', `Bearer ${mgrB1Token}`).expect(403))

    it('CẤP 4 sửa được phim của mọi phòng ban', async () => {
      await http()
        .patch(`/api/films/${filmEmpA1.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ title: 'Quản trị sửa phim phòng A', categoryId })
        .expect(200)
      await http()
        .patch(`/api/films/${filmEmpB1.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ title: 'Quản trị sửa phim phòng B', categoryId })
        .expect(200)
    })

    it('phim không tồn tại → 404 (không lộ thành 403 hay ngược lại)', () =>
      http()
        .patch('/api/films/999999')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ title: 'Không tồn tại', categoryId })
        .expect(404))

    it('mọi người đã đăng nhập đều XEM được phim của người khác (đúng thiết kế)', () =>
      http().get(`/api/films/${filmEmpA1.slug}`).set('Authorization', `Bearer ${empB1Token}`).expect(200))

    /**
     * Ca then chốt của ADR-043: phòng ban dùng để phân quyền phải đọc từ DB mỗi lần, không lấy
     * từ JWT. Nếu lấy từ token, Trưởng phòng vừa bị chuyển sang phòng khác vẫn giữ quyền cũ
     * suốt 15 phút cho tới khi access token hết hạn.
     */
    it('CẤP 3 bị chuyển phòng ban → MẤT QUYỀN NGAY, dù access token cũ vẫn còn hiệu lực', async () => {
      const filmA = await createFilm(empA1Token, 'Phim kiểm đổi phòng ban')

      // Token cũ đang quản được phim phòng A.
      await http()
        .patch(`/api/films/${filmA.id}`)
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .send({ title: 'TP A1 sửa trước khi bị chuyển phòng', categoryId })
        .expect(200)

      // Cấp 4 chuyển TP A1 sang phòng B.
      await http()
        .patch(`/api/users/${mgrA1Id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ departmentId: deptBId })
        .expect(200)

      // CÙNG access token cũ → giờ phải bị từ chối.
      await http()
        .patch(`/api/films/${filmA.id}`)
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .send({ title: 'TP A1 cố sửa sau khi bị chuyển phòng', categoryId })
        .expect(403)

      // Trả lại trạng thái ban đầu để không ảnh hưởng bài test khác.
      await http()
        .patch(`/api/users/${mgrA1Id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ departmentId: deptAId })
        .expect(200)
      await http()
        .patch(`/api/films/${filmA.id}`)
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .send({ title: 'TP A1 sửa lại được sau khi về phòng cũ', categoryId })
        .expect(200)
    })

    it('phim chưa có phòng ban (department_id NULL) → Cấp 3 KHÔNG quản lý được', async () => {
      // Phim do Cấp 4 (không thuộc phòng ban nào) tạo → department_id NULL.
      expect(filmSuper).toBeDefined()
      const detail = await http()
        .get(`/api/films/${filmSuper.slug}`)
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200)
      expect(detail.body.departmentId).toBeNull()
      await http()
        .delete(`/api/films/${filmSuper.id}`)
        .set('Authorization', `Bearer ${mgrA1Token}`)
        .expect(403)
    })
  })

  // ── Truy vết chuyên mục (ADR-042) ────────────────────────────────────────
  describe('Chuyên mục — cột truy vết created_by / department_id', () => {
    it('ghi lại người tạo, KHÔNG dùng để scope quyền', async () => {
      const r = await http()
        .post('/api/categories')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ name: 'Chuyên mục kiểm truy vết' })
        .expect(201)
      const rows: Array<{ created_by: number | null; department_id: number | null }> =
        await dataSource.query('SELECT `created_by`, `department_id` FROM `categories` WHERE `id` = ?', [
          r.body.id,
        ])
      expect(rows[0].created_by).toBe(superId)
      // Cấp 4 không thuộc phòng ban nào → NULL, không bịa giá trị.
      expect(rows[0].department_id).toBeNull()
    })
  })

  // ── Validate đầu vào chạy thật ───────────────────────────────────────────
  describe('Validate đầu vào ở server', () => {
    it('thiếu trường bắt buộc → 400', () =>
      http().post('/api/films').set('Authorization', `Bearer ${empA1Token}`).send({}).expect(400))

    it('tên phim quá ngắn → 400', () =>
      http()
        .post('/api/films')
        .set('Authorization', `Bearer ${empA1Token}`)
        .send({ title: 'A', categoryId })
        .expect(400))

    it('field lạ bị ValidationPipe loại bỏ (chống mass assignment) — không lưu vào bản ghi', async () => {
      const r = await http()
        .post('/api/films')
        .set('Authorization', `Bearer ${empA1Token}`)
        .send({ title: 'Phim thử field lạ', categoryId, viewCount: 999999, truongLa: 'xxx' })
        .expect(201)
      expect(r.body.viewCount).toBe(0)
      expect(r.body).not.toHaveProperty('truongLa')
    })

    it('định dạng video không hỗ trợ → 400', async () => {
      const f = await createFilm(empA1Token, 'Phim kiểm MIME')
      await http()
        .post(`/api/films/${f.id}/upload-url`)
        .set('Authorization', `Bearer ${empA1Token}`)
        .send({ contentType: 'application/x-msdownload', size: 1024 })
        .expect(400)
    })

    it('storageKey sai định dạng bị regex DTO chặn → 400 (không chạm tới storage)', async () => {
      const f = await createFilm(empA1Token, 'Phim kiểm storageKey')
      await http()
        .post(`/api/films/${f.id}/versions`)
        .set('Authorization', `Bearer ${empA1Token}`)
        .send({ storageKey: '../../etc/passwd' })
        .expect(400)
    })

    it('query báo cáo sai định dạng ngày → 400', () =>
      http()
        .get('/api/reports/films?from=27-07-2026')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(400))
  })

  // ── Đếm lượt xem (tuần tự — ca đồng thời ở script riêng) ─────────────────
  describe('Đếm lượt xem', () => {
    it('lần đầu +1, gọi lại ngay trong cửa sổ 30 phút KHÔNG tăng thêm', async () => {
      const f = await createFilm(empA1Token, 'Phim đếm lượt xem')

      const first = await http()
        .post(`/api/films/${f.id}/view`)
        .set('Authorization', `Bearer ${empB1Token}`)
        .expect(201)
      expect(first.body.viewCount).toBe(1)

      const second = await http()
        .post(`/api/films/${f.id}/view`)
        .set('Authorization', `Bearer ${empB1Token}`)
        .expect(201)
      expect(second.body.viewCount).toBe(1)

      const detail = await http()
        .get(`/api/films/${f.slug}`)
        .set('Authorization', `Bearer ${empB1Token}`)
        .expect(200)
      expect(detail.body.viewCount).toBe(1)
    })

    it('hai người dùng khác nhau → tính 2 lượt', async () => {
      const f = await createFilm(empA1Token, 'Phim đếm lượt xem 2 người')
      await http().post(`/api/films/${f.id}/view`).set('Authorization', `Bearer ${empA1Token}`).expect(201)
      const r = await http()
        .post(`/api/films/${f.id}/view`)
        .set('Authorization', `Bearer ${empB1Token}`)
        .expect(201)
      expect(r.body.viewCount).toBe(2)
    })
  })

  // ── Báo cáo & CSV ────────────────────────────────────────────────────────
  describe('Báo cáo CSV', () => {
    it('xuất CSV có BOM UTF-8 và vô hiệu hoá công thức Excel (CSV injection)', async () => {
      await http()
        .post('/api/films')
        .set('Authorization', `Bearer ${empA1Token}`)
        .send({ title: "=cmd|'/c calc'!A1", categoryId })
        .expect(201)

      const r = await http()
        .get('/api/reports/films?format=csv')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200)

      expect(r.headers['content-type']).toContain('text/csv')
      expect(r.text.charCodeAt(0)).toBe(0xfeff)
      expect(r.text).toContain('"\'=cmd')
      expect(r.text).not.toMatch(/\n"=cmd/)
    })
  })

  // ── Endpoint công khai ───────────────────────────────────────────────────
  describe('Endpoint công khai', () => {
    it('/media/:key nằm NGOÀI prefix /api và không cần đăng nhập (404 vì key không tồn tại, KHÔNG phải 401)', () =>
      http().get('/media/video-khong-ton-tai.mp4').expect(404))

    it('/api/health không cần đăng nhập', () => http().get('/api/health').expect(200))
  })
})

/**
 * Rate limit kiểm trong describe RIÊNG với guard THẬT (không override) — nếu gộp chung
 * với bộ test trên thì hàng chục lần đăng nhập ở phần dựng dữ liệu sẽ tự đâm vào ngưỡng.
 */
describe('Rate limit endpoint xác thực (ThrottlerGuard thật)', () => {
  let app2: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app2 = moduleRef.createNestApplication()
    app2.setGlobalPrefix('api', {
      exclude: [
        { path: 'media/:key', method: RequestMethod.GET },
        { path: 'media/:key', method: RequestMethod.HEAD },
      ],
    })
    app2.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app2.init()
  })

  afterAll(async () => {
    await app2?.close()
  })

  it('gọi /auth/login quá ngưỡng 10 lần/phút → trả 429', async () => {
    const codes: number[] = []
    for (let i = 0; i < 14; i++) {
      const r = await request(app2.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'e2e-brute@misa.com.vn', password: 'sai-mat-khau' })
      codes.push(r.status)
    }
    expect(codes).toContain(429)
    // Những lần đầu phải là 401 (xử lý bình thường), không phải 429 ngay từ đầu.
    expect(codes[0]).toBe(401)
  })
})
