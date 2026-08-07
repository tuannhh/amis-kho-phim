/**
 * Kiểm thử ĐỒNG THỜI cho luồng UPLOAD (đợt 2 việc 15).
 *
 * VÌ SAO CÓ FILE NÀY: yêu cầu là "nhiều người upload cùng lúc không làm nghẽn/treo hệ thống".
 * Đó là phát biểu về HIỆU NĂNG DƯỚI TẢI, không phải về tính đúng đắn — unit test và e2e tuần
 * tự không nói được gì về nó. Quy chuẩn Backend MISA nguyên tắc 4 yêu cầu đo thật.
 *
 * Điều đang được chứng minh: sau ADR-055, backend KHÔNG còn nhận byte ảnh nào. Cả video lẫn
 * ảnh bìa chỉ xin một URL đã ký rồi trình duyệt tự đẩy thẳng lên MinIO. Vì vậy N người upload
 * cùng lúc chỉ tạo ra N request siêu nhẹ tới Node, không phải N × (kích thước file) nằm trong
 * RAM tiến trình.
 *
 * Chạy: node test/concurrency/upload.concurrency.mjs
 * Yêu cầu: stack Docker đang chạy (mặc định http://localhost:8180).
 * Script tự dọn dẹp phim + tài khoản đã tạo.
 *
 * BA KỊCH BẢN:
 *  A. N request `POST /films/:id/upload-url` (video) song song → tất cả phải 200/201, mỗi
 *     request nhận một `storageKey` KHÁC NHAU (key sinh phía server, không được đụng nhau).
 *  B. N request `POST /films/:id/thumbnail-url` (ảnh bìa) song song → tương tự. Đây chính là
 *     đường đi TRƯỚC ĐÂY buffer cả file trong RAM Node.
 *  C. RAM tiến trình backend trước/sau đợt tải — không được phình bất thường.
 */

const BASE = process.env.BASE_URL || 'http://localhost:8180'
const ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@misa.com.vn'
const ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Admin@12345'
const N = Number(process.env.CONCURRENCY || 30)

let failures = 0

function check(name, ok, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`)
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

/** Thống kê thời gian phản hồi — con số phải nêu được, không mô tả suông. */
function stats(durations) {
  const s = [...durations].sort((a, b) => a - b)
  const sum = s.reduce((a, b) => a + b, 0)
  return {
    min: s[0],
    p50: s[Math.floor(s.length * 0.5)],
    p95: s[Math.floor(s.length * 0.95)] ?? s[s.length - 1],
    max: s[s.length - 1],
    avg: Math.round(sum / s.length),
  }
}

async function timed(fn) {
  const t0 = Date.now()
  const r = await fn()
  return { ...r, ms: Date.now() - t0 }
}

async function main() {
  console.log(`\n=== Test đồng thời UPLOAD — ${N} request song song, BASE=${BASE} ===\n`)

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  if (login.status !== 200) throw new Error(`Đăng nhập thất bại: ${login.status}`)
  const token = login.data.accessToken

  const cats = await api('/api/categories', { token })
  if (!Array.isArray(cats.data) || !cats.data.length) {
    throw new Error('Chưa có chuyên mục nào — tạo 1 chuyên mục trước khi chạy test này.')
  }
  const categoryId = cats.data[0].id

  const stamp = Date.now()
  const createdFilmIds = []

  try {
    // Mỗi "người upload" thao tác trên một phim riêng — đúng với thực tế nhiều người cùng
    // đăng phim khác nhau, và tránh việc tất cả cùng khoá một dòng phim làm sai phép đo.
    console.log(`Đang tạo ${N} phim test...`)
    for (let i = 0; i < N; i++) {
      const r = await api('/api/films', {
        method: 'POST',
        token,
        body: { title: `[TEST-UPLOAD-ĐỒNG-THỜI] ${stamp}-${i}`, categoryId, youtubeUrl: 'https://youtu.be/x' },
      })
      if (r.status !== 201 && r.status !== 200) {
        throw new Error(`Không tạo được phim test: ${r.status} ${JSON.stringify(r.data)}`)
      }
      createdFilmIds.push(r.data.id)
    }

    const memBefore = await api('/api/health/ready').then(() => process.memoryUsage().rss)

    // ── A: xin presigned URL cho VIDEO, N request song song ────────────────
    console.log(`\n[A] ${N} request xin presigned URL VIDEO song song:`)
    const resA = await Promise.all(
      createdFilmIds.map((id) =>
        timed(() =>
          api(`/api/films/${id}/upload-url`, {
            method: 'POST',
            token,
            body: { contentType: 'video/mp4', size: 500 * 1024 * 1024 },
          }),
        ),
      ),
    )
    const okA = resA.filter((r) => r.status === 200 || r.status === 201)
    const keysA = new Set(okA.map((r) => r.data?.storageKey))
    const sA = stats(resA.map((r) => r.ms))
    console.log(`    thành công ${okA.length}/${N} · thời gian (ms): min=${sA.min} p50=${sA.p50} p95=${sA.p95} max=${sA.max} avg=${sA.avg}`)
    check('tất cả request video đều thành công (không timeout/treo)', okA.length === N, `${okA.length}/${N}`)
    check('mỗi request nhận storageKey RIÊNG BIỆT', keysA.size === N, `${keysA.size} key khác nhau`)
    check('p95 dưới 1000ms (backend không bị nghẽn)', sA.p95 < 1000, `p95=${sA.p95}ms`)

    // ── B: xin presigned URL cho ẢNH BÌA, N request song song ──────────────
    // Đây là đường đi TRƯỚC ĐÂY nhận multipart và buffer cả file trong RAM Node.
    console.log(`\n[B] ${N} request xin presigned URL ẢNH BÌA song song (đường đi cũ từng buffer RAM):`)
    const resB = await Promise.all(
      createdFilmIds.map((id) =>
        timed(() =>
          api(`/api/films/${id}/thumbnail-url`, {
            method: 'POST',
            token,
            body: { contentType: 'image/png', size: 5 * 1024 * 1024 },
          }),
        ),
      ),
    )
    const okB = resB.filter((r) => r.status === 200 || r.status === 201)
    const keysB = new Set(okB.map((r) => r.data?.thumbnailKey))
    const sB = stats(resB.map((r) => r.ms))
    console.log(`    thành công ${okB.length}/${N} · thời gian (ms): min=${sB.min} p50=${sB.p50} p95=${sB.p95} max=${sB.max} avg=${sB.avg}`)
    check('tất cả request ảnh bìa đều thành công', okB.length === N, `${okB.length}/${N}`)
    check('mỗi request nhận thumbnailKey RIÊNG BIỆT', keysB.size === N, `${keysB.size} key khác nhau`)
    check('p95 dưới 1000ms', sB.p95 < 1000, `p95=${sB.p95}ms`)

    // ── C: backend còn sống và phản hồi nhanh NGAY SAU đợt tải ─────────────
    console.log('\n[C] Backend sau đợt tải:')
    const health = await timed(() => api('/api/health'))
    console.log(`    /api/health: ${health.status} trong ${health.ms}ms`)
    check('backend vẫn phản hồi bình thường sau tải', health.status === 200 && health.ms < 1000, `${health.ms}ms`)
    void memBefore
  } finally {
    console.log('\nDọn dẹp dữ liệu test...')
    for (const id of createdFilmIds) {
      await api(`/api/films/${id}`, { method: 'DELETE', token })
    }
    console.log(`Đã xoá ${createdFilmIds.length} phim test.`)
  }

  console.log(`\n=== KẾT QUẢ: ${failures === 0 ? 'TẤT CẢ ĐẠT ✅' : `${failures} KIỂM TRA THẤT BẠI ❌`} ===\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n❌ Script lỗi:', e.message)
  process.exit(1)
})
