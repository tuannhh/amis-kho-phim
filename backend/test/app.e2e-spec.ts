import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ThrottlerGuard } from '@nestjs/throttler'
import request from 'supertest'
import { createHmac } from 'crypto'
import { AppModule } from '../src/app.module'

/**
 * KIỂM THỬ TÍCH HỢP (e2e) — chạy trên MySQL THẬT, route THẬT, guard THẬT.
 *
 * Vì sao cần dù đã có 129 unit test (07-testing-strategy §1): unit test thay toàn bộ
 * repository bằng mock, nên chỉ chứng minh "logic đúng VỚI GIẢ ĐỊNH tầng dữ liệu hoạt động
 * như mock mô tả". Nó KHÔNG bắt được: câu truy vấn sai cú pháp thật, quan hệ entity khai
 * báo sai, migration không chạy được, guard toàn cục không được lắp đúng thứ tự, hay
 * `ValidationPipe` không thực sự loại bỏ field lạ. Đó là "lỗi ở ranh giới giữa các thành
 * phần" mà chuẩn nói chỉ kiểm thử tích hợp mới thấy.
 *
 * Phạm vi ưu tiên theo RỦI RO (11-phase-refactor-legacy §7): xác thực, phân quyền theo vai
 * trò, quyền sở hữu (IDOR), validate đầu vào, và endpoint công khai — không phủ cơ học CRUD.
 *
 * Dữ liệu: database RIÊNG `kho_phim_e2e`, dựng lại sạch mỗi lần chạy (xem global-setup.ts).
 */

const SUPER_EMAIL = 'e2e-super@misa.com.vn'
const SUPER_PASSWORD = 'E2eSuper@2026'

describe('AMIS Kho phim — kiểm thử tích hợp (DB thật)', () => {
  let app: INestApplication
  let http: () => request.Agent

  let superToken: string
  let adminToken: string
  let employeeAToken: string
  let employeeBToken: string
  let employeeAId: number
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

    // Đăng nhập bằng tài khoản seed do chính AppModule tạo lúc khởi động.
    const login = await http()
      .post('/api/auth/login')
      .send({ email: SUPER_EMAIL, password: SUPER_PASSWORD })
      .expect(200)
    superToken = login.body.accessToken

    // Dựng dữ liệu nền: 1 admin, 2 nhân viên, 1 chuyên mục.
    const mk = async (email: string, roleCode: string, password: string) => {
      const r = await http()
        .post('/api/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ email, fullName: email, roleCode, password })
        .expect(201)
      const t = await http().post('/api/auth/login').send({ email, password }).expect(200)
      return { id: r.body.user.id, token: t.body.accessToken }
    }
    adminToken = (await mk('e2e-admin@misa.com.vn', 'admin', 'E2eAdmin@2026')).token
    const empA = await mk('e2e-nv-a@misa.com.vn', 'employee', 'E2eNvA@2026')
    const empB = await mk('e2e-nv-b@misa.com.vn', 'employee', 'E2eNvB@2026')
    employeeAToken = empA.token
    employeeAId = empA.id
    employeeBToken = empB.token

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

  // ── Phân quyền theo vai trò ──────────────────────────────────────────────
  describe('Phân quyền theo vai trò (RolesGuard chạy thật)', () => {
    it('nhân viên KHÔNG xem được danh sách người dùng → 403', () =>
      http().get('/api/users').set('Authorization', `Bearer ${employeeAToken}`).expect(403))

    it('nhân viên KHÔNG xem được báo cáo → 403', () =>
      http().get('/api/reports/films').set('Authorization', `Bearer ${employeeAToken}`).expect(403))

    it('nhân viên KHÔNG tạo được chuyên mục → 403', () =>
      http()
        .post('/api/categories')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ name: 'Nhân viên cố tạo' })
        .expect(403))

    it('admin xem được danh sách người dùng và báo cáo', async () => {
      await http().get('/api/users').set('Authorization', `Bearer ${adminToken}`).expect(200)
      await http().get('/api/reports/films').set('Authorization', `Bearer ${adminToken}`).expect(200)
    })

    it('admin KHÔNG tạo được tài khoản admin khác → 403', () =>
      http()
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'e2e-admin2@misa.com.vn', fullName: 'Admin Hai', roleCode: 'admin', password: 'E2eX@20261' })
        .expect(403))

    it('KHÔNG ai tạo được tài khoản super_admin (DTO chặn giá trị vai trò)', () =>
      http()
        .post('/api/users')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ email: 'e2e-super2@misa.com.vn', fullName: 'Super Hai', roleCode: 'super_admin', password: 'E2eX@20261' })
        .expect(400))

    it('super_admin KHÔNG tự khoá được chính mình → 403', async () => {
      const me = await http().get('/api/auth/me').set('Authorization', `Bearer ${superToken}`).expect(200)
      await http()
        .patch(`/api/users/${me.body.id}/status`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ isActive: false })
        .expect(403)
    })

    it('admin KHÔNG khoá được super_admin → 403', async () => {
      const me = await http().get('/api/auth/me').set('Authorization', `Bearer ${superToken}`).expect(200)
      await http()
        .patch(`/api/users/${me.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(403)
    })

    it('danh sách người dùng trả về KHÔNG chứa password_hash ở bất kỳ bản ghi nào', async () => {
      const r = await http().get('/api/users').set('Authorization', `Bearer ${superToken}`).expect(200)
      expect(r.body.length).toBeGreaterThan(0)
      for (const u of r.body) {
        expect(u).not.toHaveProperty('passwordHash')
        expect(u).not.toHaveProperty('password_hash')
      }
    })
  })

  // ── Quyền sở hữu (IDOR) ──────────────────────────────────────────────────
  describe('Quyền sở hữu phim — chống IDOR', () => {
    let filmOfA: number
    let slugOfA: string

    beforeAll(async () => {
      const r = await http()
        .post('/api/films')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ title: 'Phim của nhân viên A', categoryId, youtubeUrl: 'https://youtu.be/a' })
        .expect(201)
      filmOfA = r.body.id
      slugOfA = r.body.slug
    })

    it('uploaderId lấy từ token, KHÔNG nhận từ body (chống giả mạo chủ sở hữu)', async () => {
      const r = await http()
        .post('/api/films')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ title: 'Phim thử giả mạo chủ sở hữu', categoryId, uploaderId: 99999, youtubeUrl: 'https://youtu.be/x' })
        .expect(201)
      expect(r.body.uploaderId).toBe(employeeAId)
    })

    it('nhân viên B KHÔNG sửa được phim của A → 403', () =>
      http()
        .patch(`/api/films/${filmOfA}`)
        .set('Authorization', `Bearer ${employeeBToken}`)
        .send({ title: 'B chiếm phim của A', categoryId })
        .expect(403))

    it('nhân viên B KHÔNG xoá được phim của A → 403', () =>
      http().delete(`/api/films/${filmOfA}`).set('Authorization', `Bearer ${employeeBToken}`).expect(403))

    it('nhân viên B KHÔNG xin được presigned URL cho phim của A → 403', () =>
      http()
        .post(`/api/films/${filmOfA}/upload-url`)
        .set('Authorization', `Bearer ${employeeBToken}`)
        .send({ contentType: 'video/mp4', size: 1024 })
        .expect(403))

    it('nhân viên B KHÔNG tạo được version mới cho phim của A → 403', () =>
      http()
        .post(`/api/films/${filmOfA}/versions`)
        .set('Authorization', `Bearer ${employeeBToken}`)
        .send({ storageKey: `video-${'0'.repeat(8)}-0000-0000-0000-000000000000.mp4` })
        .expect(403))

    it('chính chủ (A) sửa được phim của mình', async () => {
      const r = await http()
        .patch(`/api/films/${filmOfA}`)
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ title: 'A tự sửa phim của mình', categoryId })
        .expect(200)
      expect(r.body.title).toBe('A tự sửa phim của mình')
    })

    it('admin sửa được phim của người khác', () =>
      http()
        .patch(`/api/films/${filmOfA}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin sửa phim của A', categoryId })
        .expect(200))

    it('phim không tồn tại → 404', () =>
      http()
        .patch('/api/films/999999')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ title: 'Không tồn tại', categoryId })
        .expect(404))

    it('mọi người đã đăng nhập đều XEM được phim của người khác (đúng thiết kế)', () =>
      http().get(`/api/films/${slugOfA}`).set('Authorization', `Bearer ${employeeBToken}`).expect(200))
  })

  // ── Validate đầu vào chạy thật ───────────────────────────────────────────
  describe('Validate đầu vào ở server', () => {
    it('thiếu trường bắt buộc → 400', () =>
      http().post('/api/films').set('Authorization', `Bearer ${employeeAToken}`).send({}).expect(400))

    it('tên phim quá ngắn → 400', () =>
      http()
        .post('/api/films')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ title: 'A', categoryId })
        .expect(400))

    it('field lạ bị ValidationPipe loại bỏ (chống mass assignment) — không lưu vào bản ghi', async () => {
      const r = await http()
        .post('/api/films')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ title: 'Phim thử field lạ', categoryId, viewCount: 999999, truongLa: 'xxx' })
        .expect(201)
      expect(r.body.viewCount).toBe(0)
      expect(r.body).not.toHaveProperty('truongLa')
    })

    it('định dạng video không hỗ trợ → 400', async () => {
      const f = await http()
        .post('/api/films')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ title: 'Phim kiểm MIME', categoryId })
        .expect(201)
      await http()
        .post(`/api/films/${f.body.id}/upload-url`)
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ contentType: 'application/x-msdownload', size: 1024 })
        .expect(400)
    })

    it('storageKey sai định dạng bị regex DTO chặn → 400 (không chạm tới storage)', async () => {
      const f = await http()
        .post('/api/films')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ title: 'Phim kiểm storageKey', categoryId })
        .expect(201)
      await http()
        .post(`/api/films/${f.body.id}/versions`)
        .set('Authorization', `Bearer ${employeeAToken}`)
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
      const f = await http()
        .post('/api/films')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ title: 'Phim đếm lượt xem', categoryId })
        .expect(201)

      const first = await http()
        .post(`/api/films/${f.body.id}/view`)
        .set('Authorization', `Bearer ${employeeBToken}`)
        .expect(201)
      expect(first.body.viewCount).toBe(1)

      const second = await http()
        .post(`/api/films/${f.body.id}/view`)
        .set('Authorization', `Bearer ${employeeBToken}`)
        .expect(201)
      expect(second.body.viewCount).toBe(1)

      const detail = await http()
        .get(`/api/films/${f.body.slug}`)
        .set('Authorization', `Bearer ${employeeBToken}`)
        .expect(200)
      expect(detail.body.viewCount).toBe(1)
    })

    it('hai người dùng khác nhau → tính 2 lượt', async () => {
      const f = await http()
        .post('/api/films')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ title: 'Phim đếm lượt xem 2 người', categoryId })
        .expect(201)
      await http().post(`/api/films/${f.body.id}/view`).set('Authorization', `Bearer ${employeeAToken}`).expect(201)
      const r = await http()
        .post(`/api/films/${f.body.id}/view`)
        .set('Authorization', `Bearer ${employeeBToken}`)
        .expect(201)
      expect(r.body.viewCount).toBe(2)
    })
  })

  // ── Báo cáo & CSV ────────────────────────────────────────────────────────
  describe('Báo cáo CSV', () => {
    it('xuất CSV có BOM UTF-8 và vô hiệu hoá công thức Excel (CSV injection)', async () => {
      await http()
        .post('/api/films')
        .set('Authorization', `Bearer ${employeeAToken}`)
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
