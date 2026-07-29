/**
 * Kiểm thử ĐỒNG THỜI cho luồng đếm lượt xem (`POST /films/:id/view`).
 *
 * VÌ SAO BẮT BUỘC CÓ FILE NÀY (không thay được bằng unit test):
 * Quy chuẩn Backend MISA — nguyên tắc 4 (`01-core-principles.md`) và
 * `07-testing-strategy.md` §1 nói rõ: luồng có khả năng bị nhiều người dùng thao tác đồng
 * thời PHẢI được backtest dưới tải đồng thời thật bằng script gọi song song N request.
 * Race condition KHÔNG bao giờ lộ ra khi test tuần tự — unit test có mock luôn cho kết quả
 * đúng dù logic có lỗi.
 *
 * Chạy: node test/concurrency/record-view.concurrency.mjs
 * Yêu cầu: stack Docker đang chạy (mặc định http://localhost:8180).
 * Script tự dọn dẹp dữ liệu test (xoá phim + tài khoản đã tạo) ở bước cuối.
 *
 * HAI KỊCH BẢN — kiểm hai bất biến KHÁC NHAU của ADR-023:
 *  A. N người dùng KHÁC NHAU cùng xem 1 phim cùng lúc
 *     → `films.view_count` phải tăng ĐÚNG N.
 *     Bắt lỗi: mất lượt tăng (lost update) nếu dùng đọc-rồi-ghi thay vì `increment()`.
 *  B. CÙNG 1 người dùng gửi N request song song cho cùng 1 phim
 *     → chỉ được tính ĐÚNG 1 lượt (dedupe cửa sổ 30 phút).
 *     Bắt lỗi: check-then-act — nhiều request cùng vượt qua bước kiểm trùng trước khi
 *     bất kỳ request nào kịp ghi bản ghi đầu tiên.
 */

const BASE = process.env.BASE_URL || 'http://localhost:8180'
const ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@misa.com.vn'
const ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Admin@12345'
const N = Number(process.env.CONCURRENCY || 20)

let failures = 0

function check(name, actual, expected) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}: nhận ${actual}, mong đợi ${expected}`)
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * GIÃN NHỊP ĐĂNG NHẬP — CỐ Ý tôn trọng rate limit thật (10 lần/phút/IP) thay vì nới lỏng
 * nó để test chạy nhanh. Nới ngưỡng chỉ vì test bất tiện là đúng loại đánh đổi "bảo mật
 * lấy tiện lợi" mà nguyên tắc 1 của quy chuẩn cấm.
 *
 * Lưu ý: phần ĐANG ĐO (`POST /films/:id/view`) KHÔNG hề bị rate limit (ADR-033 chỉ áp
 * throttle cho AuthController), nên việc giãn nhịp ở bước dựng dữ liệu không ảnh hưởng
 * tính đúng đắn của phép đo đồng thời.
 */
const LOGINS_PER_WINDOW = 9 // ngưỡng thật là 10/phút, chừa 1 slot an toàn
let loginsInWindow = 0

async function login(email, password) {
  if (loginsInWindow >= LOGINS_PER_WINDOW) {
    console.log('    (đang chờ 61s cho hết cửa sổ rate limit đăng nhập...)')
    await sleep(61_000)
    loginsInWindow = 0
  }
  loginsInWindow++
  const r = await api('/api/auth/login', { method: 'POST', body: { email, password } })
  if (r.status !== 200) throw new Error(`Đăng nhập thất bại (${email}): ${r.status} ${JSON.stringify(r.data)}`)
  return r.data.accessToken
}

async function main() {
  console.log(`\n=== Test đồng thời recordView — ${N} request song song, BASE=${BASE} ===\n`)

  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD)

  // Cần một chuyên mục bất kỳ để tạo phim
  const cats = await api('/api/categories', { token: adminToken })
  if (!Array.isArray(cats.data) || !cats.data.length) {
    throw new Error('Chưa có chuyên mục nào — tạo 1 chuyên mục trước khi chạy test này.')
  }
  const categoryId = cats.data[0].id

  // ── Chuẩn bị: 1 phim test + N tài khoản nhân viên test ─────────────────
  const stamp = Date.now()
  const film = await api('/api/films', {
    method: 'POST',
    token: adminToken,
    body: {
      title: `[TEST-ĐỒNG-THỜI] ${stamp}`,
      categoryId,
      youtubeUrl: 'https://youtu.be/concurrency-test',
    },
  })
  if (film.status !== 201 && film.status !== 200) {
    throw new Error(`Không tạo được phim test: ${film.status} ${JSON.stringify(film.data)}`)
  }
  const filmId = film.data.id
  const filmSlug = film.data.slug
  console.log(`Đã tạo phim test id=${filmId} (view_count ban đầu = ${film.data.viewCount})`)

  const createdUserIds = []
  const tokens = []
  console.log(`Đang tạo ${N} tài khoản nhân viên test...`)
  for (let i = 0; i < N; i++) {
    const email = `concurrency-${stamp}-${i}@misa.com.vn`
    const password = 'TestDongThoi@2026'
    const created = await api('/api/users', {
      method: 'POST',
      token: adminToken,
      body: { email, fullName: `Test đồng thời ${i}`, roleCode: 'employee', password },
    })
    if (created.status !== 201 && created.status !== 200) {
      throw new Error(`Không tạo được user ${email}: ${created.status} ${JSON.stringify(created.data)}`)
    }
    createdUserIds.push(created.data.user.id)
    tokens.push(await login(email, password))
  }
  console.log(`Đã tạo & đăng nhập ${tokens.length} tài khoản.\n`)

  const viewCountOf = async (slug) => (await api(`/api/films/${slug}`, { token: adminToken })).data.viewCount

  try {
    // ── KỊCH BẢN A: N user khác nhau, song song ───────────────────────────
    console.log(`[A] ${N} người dùng KHÁC NHAU cùng xem 1 phim, song song:`)
    const before = await viewCountOf(filmSlug)
    const resA = await Promise.all(
      tokens.map((t) => api(`/api/films/${filmId}/view`, { method: 'POST', token: t })),
    )
    const okA = resA.filter((r) => r.status === 200 || r.status === 201).length
    const afterA = await viewCountOf(filmSlug)
    console.log(`    request thành công: ${okA}/${N} · view_count: ${before} → ${afterA}`)
    check('view_count tăng đúng N (không mất lượt tăng)', afterA - before, N)

    // ── KỊCH BẢN B: cùng 1 user, N request song song ──────────────────────
    console.log(`\n[B] CÙNG 1 người dùng gửi ${N} request song song (kiểm dedupe 30'):`)
    const beforeB = await viewCountOf(filmSlug)
    const solo = tokens[0] // user này đã xem ở kịch bản A → phải bị dedupe hoàn toàn
    const resB = await Promise.all(
      Array.from({ length: N }, () => api(`/api/films/${filmId}/view`, { method: 'POST', token: solo })),
    )
    const okB = resB.filter((r) => r.status === 200 || r.status === 201).length
    const afterB = await viewCountOf(filmSlug)
    console.log(`    request thành công: ${okB}/${N} · view_count: ${beforeB} → ${afterB}`)
    check('user đã xem trong cửa sổ 30 phút → KHÔNG tăng thêm lượt nào', afterB - beforeB, 0)

    // ── KỊCH BẢN C: user HOÀN TOÀN MỚI, N request song song ───────────────
    // Đây là ca khắc nghiệt nhất của dedupe: chưa có bản ghi nào, N request cùng lúc
    // đều có thể vượt qua bước kiểm trùng trước khi request đầu tiên kịp ghi.
    console.log(`\n[C] 1 người dùng CHƯA TỪNG XEM gửi ${N} request song song (ca khắc nghiệt nhất):`)
    const freshEmail = `concurrency-fresh-${stamp}@misa.com.vn`
    const freshPass = 'TestDongThoi@2026'
    const freshCreated = await api('/api/users', {
      method: 'POST',
      token: adminToken,
      body: { email: freshEmail, fullName: 'Test đồng thời fresh', roleCode: 'employee', password: freshPass },
    })
    createdUserIds.push(freshCreated.data.user.id)
    const freshToken = await login(freshEmail, freshPass)

    const beforeC = await viewCountOf(filmSlug)
    const resC = await Promise.all(
      Array.from({ length: N }, () => api(`/api/films/${filmId}/view`, { method: 'POST', token: freshToken })),
    )
    const okC = resC.filter((r) => r.status === 200 || r.status === 201).length
    const afterC = await viewCountOf(filmSlug)
    console.log(`    request thành công: ${okC}/${N} · view_count: ${beforeC} → ${afterC}`)
    check('1 người dùng mới xem lần đầu → chỉ tính ĐÚNG 1 lượt', afterC - beforeC, 1)
  } finally {
    // ── Dọn dẹp ────────────────────────────────────────────────────────────
    console.log('\nDọn dẹp dữ liệu test...')
    await api(`/api/films/${filmId}`, { method: 'DELETE', token: adminToken })
    for (const id of createdUserIds) {
      await api(`/api/users/${id}`, { method: 'DELETE', token: adminToken })
    }
    console.log(`Đã xoá phim test và ${createdUserIds.length} tài khoản test.`)
  }

  console.log(`\n=== KẾT QUẢ: ${failures === 0 ? 'TẤT CẢ ĐẠT ✅' : `${failures} KIỂM TRA THẤT BẠI ❌`} ===\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n❌ Script lỗi:', e.message)
  process.exit(1)
})
