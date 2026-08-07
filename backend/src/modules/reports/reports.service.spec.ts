import { ReportsService } from './reports.service'
import type { FilmsReport } from './reports.service'

/**
 * GĐ7 — báo cáo CSV được mở bằng Excel trên máy quản trị viên. Tên phim là dữ liệu do
 * người dùng tự nhập, nên file CSV là đường đi từ "nhân viên nhập liệu" tới "máy admin".
 * Test tập trung vào CSV injection + escape đúng RFC4180 + BOM cho tiếng Việt.
 */

const service = new ReportsService({} as never, {} as never, {} as never, {} as never)

/** Khối `totals`/`scope` tối thiểu — các ca test CSV không quan tâm hai khối này. */
const EMPTY_META: Pick<FilmsReport, 'totals' | 'scope'> = {
  totals: { films: 0, views: 0, downloads: 0, uploaders: 0 },
  scope: { departmentId: null, departmentName: null, locked: false },
}

function reportWithTitle(title: string): FilmsReport {
  return {
    ...EMPTY_META,
    summary: [],
    films: [
      {
        id: 1,
        slug: 's',
        title,
        uploaderId: 1,
        uploaderName: 'Nguyễn Văn A',
        categoryName: 'Đào tạo',
        departmentId: 1,
        createdAt: '2026-07-27T03:00:00.000Z',
        publishedAt: '2026-07-27',
        viewCount: 12,
        downloadCount: 3,
      },
    ],
  }
}

const dataLine = (csv: string) => csv.split('\r\n')[1]

describe('ReportsService.toCsv', () => {
  it('có BOM UTF-8 để Excel Windows hiện tiếng Việt đúng (ADR-026)', () => {
    const csv = service.toCsv(reportWithTitle('Phim đào tạo'))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('giữ nguyên tiếng Việt có dấu', () => {
    expect(service.toCsv(reportWithTitle('Hướng dẫn nghiệp vụ'))).toContain('Hướng dẫn nghiệp vụ')
  })

  it('escape dấu nháy kép theo RFC4180 (nhân đôi)', () => {
    expect(dataLine(service.toCsv(reportWithTitle('Phim "đặc biệt"')))).toContain('"Phim ""đặc biệt"""')
  })

  it('tên phim chứa dấu phẩy không làm lệch cột', () => {
    const csv = service.toCsv(reportWithTitle('Phim A, phần 2'))
    expect(dataLine(csv).startsWith('"Phim A, phần 2",')).toBe(true)
  })

  it('tên phim chứa xuống dòng vẫn nằm trong cặp nháy kép', () => {
    expect(dataLine(service.toCsv(reportWithTitle('Dòng 1\nDòng 2')))).toContain('"Dòng 1\nDòng 2"')
  })

  // ── CSV / Formula injection ──────────────────────────────────────────────
  it.each([
    ['=cmd|\'/c calc\'!A1', '='],
    ['+1+1', '+'],
    ['-2+3', '-'],
    ['@SUM(1:9)', '@'],
  ])('vô hiệu hoá công thức Excel bắt đầu bằng "%s"', (title, _prefix) => {
    const line = dataLine(service.toCsv(reportWithTitle(title)))
    // Ô phải mở đầu bằng dấu nháy đơn → Excel coi là text, không thực thi.
    expect(line.startsWith(`"'${title}`)).toBe(true)
  })

  it('tên phim bình thường KHÔNG bị thêm dấu nháy đơn thừa', () => {
    expect(dataLine(service.toCsv(reportWithTitle('Phim bình thường'))).startsWith('"Phim bình thường"')).toBe(true)
  })

  it('ngày hiển thị theo định dạng dd/mm/yyyy', () => {
    expect(dataLine(service.toCsv(reportWithTitle('X')))).toMatch(/"\d{2}\/\d{2}\/\d{4}"/)
  })

  it('dòng đầu là header tiếng Việt, phân tách bằng CRLF', () => {
    const csv = service.toCsv(reportWithTitle('X'))
    expect(csv.split('\r\n')[0]).toContain('"Tên phim"')
    expect(csv).toContain('\r\n')
  })

  it('báo cáo rỗng vẫn trả header hợp lệ (không crash)', () => {
    const csv = service.toCsv({ ...EMPTY_META, summary: [], films: [] })
    expect(csv.split('\r\n')).toHaveLength(1)
  })
})

/**
 * ADR-053 — phạm vi phòng ban của báo cáo. Đây là ranh giới BẢO MẬT: Trưởng phòng phòng A
 * không được thấy một dòng dữ liệu nào của phòng B, kể cả khi tự tay gửi `departmentId=B`
 * lên. Test canh đúng điều kiện `where` mà service dựng ra, vì đó là thứ quyết định dữ liệu
 * nào rời khỏi cơ sở dữ liệu.
 */
describe('ReportsService.getReport — phạm vi phòng ban (ADR-053)', () => {
  const DEPT_A = 1
  const DEPT_B = 2

  function setupReports(ownDepartmentId: number | null) {
    const find = jest.fn().mockResolvedValue([])
    const films = { find } as never
    const categories = { idsWithDescendants: jest.fn().mockResolvedValue([9, 10]) } as never
    const users = { getDepartmentId: jest.fn().mockResolvedValue(ownDepartmentId) } as never
    const departments = { nameOf: jest.fn().mockResolvedValue('Phòng Truyền thông') } as never
    return { service: new ReportsService(films, categories, users, departments), find }
  }

  const actor = (id: number, roleCode: 'super_admin' | 'dept_manager') =>
    ({ id, email: `u${id}@misa.com.vn`, roleCode }) as never

  const whereOf = (find: jest.Mock) => find.mock.calls[0][0].where as Record<string, unknown>

  it('Cấp 3 luôn bị ép về phòng ban của chính mình', async () => {
    const { service, find } = setupReports(DEPT_A)
    await service.getReport(actor(20, 'dept_manager'), {})
    expect(whereOf(find).departmentId).toBe(DEPT_A)
  })

  it('Cấp 3 gửi departmentId của PHÒNG KHÁC lên → bị bỏ qua, vẫn chỉ thấy phòng mình', async () => {
    const { service, find } = setupReports(DEPT_A)
    await service.getReport(actor(20, 'dept_manager'), { departmentId: DEPT_B })
    expect(whereOf(find).departmentId).toBe(DEPT_A)
  })

  it('Cấp 3 CHƯA được gán phòng ban → báo cáo RỖNG, KHÔNG truy vấn dữ liệu nào', async () => {
    const { service, find } = setupReports(null)
    const report = await service.getReport(actor(20, 'dept_manager'), {})
    expect(report.films).toEqual([])
    expect(report.totals.films).toBe(0)
    // Điểm mấu chốt: không được biến thành "không lọc phòng ban" rồi trả cả công ty.
    expect(find).not.toHaveBeenCalled()
  })

  it('Cấp 3 đọc phòng ban từ DB chứ không từ token', async () => {
    const find = jest.fn().mockResolvedValue([])
    const getDepartmentId = jest.fn().mockResolvedValue(DEPT_B)
    const service = new ReportsService(
      { find } as never,
      { idsWithDescendants: jest.fn() } as never,
      { getDepartmentId } as never,
      { nameOf: jest.fn().mockResolvedValue('Phòng Kinh doanh') } as never,
    )
    await service.getReport(actor(20, 'dept_manager'), {})
    expect(getDepartmentId).toHaveBeenCalledWith(20)
    expect((find.mock.calls[0][0].where as Record<string, unknown>).departmentId).toBe(DEPT_B)
  })

  it('Cấp 4 không truyền departmentId → xem toàn công ty (không lọc phòng ban)', async () => {
    const { service, find } = setupReports(null)
    const report = await service.getReport(actor(40, 'super_admin'), {})
    expect(whereOf(find).departmentId).toBeUndefined()
    expect(report.scope.departmentId).toBeNull()
    expect(report.scope.locked).toBe(false)
  })

  it('Cấp 4 chọn một phòng ban cụ thể → lọc đúng phòng đó', async () => {
    const { service, find } = setupReports(null)
    await service.getReport(actor(40, 'super_admin'), { departmentId: DEPT_B })
    expect(whereOf(find).departmentId).toBe(DEPT_B)
  })

  it('phạm vi của Cấp 3 được đánh dấu locked → FE biết là không cho đổi', async () => {
    const { service } = setupReports(DEPT_A)
    const report = await service.getReport(actor(20, 'dept_manager'), {})
    expect(report.scope.locked).toBe(true)
    expect(report.scope.departmentName).toBe('Phòng Truyền thông')
  })

  it('lọc theo chuyên mục CHA gồm cả chuyên mục con', async () => {
    const { service, find } = setupReports(DEPT_A)
    await service.getReport(actor(20, 'dept_manager'), { categoryId: 9 })
    // `In([9, 10])` — 10 là chuyên mục con do idsWithDescendants trả về.
    expect(JSON.stringify(whereOf(find).categoryId)).toContain('10')
  })
})

describe('ReportsService.getReport — tổng hợp theo nhân viên', () => {
  const filmRow = (uploaderId: number, name: string, views: number, downloads: number) =>
    ({
      id: Math.random(),
      slug: 's',
      title: 't',
      uploaderId,
      uploader: { fullName: name },
      category: null,
      categoryId: null,
      departmentId: 1,
      createdAt: new Date('2026-07-27T03:00:00.000Z'),
      publishedAt: '2026-07-27',
      viewCount: views,
      downloadCount: downloads,
    }) as never

  function setupWith(rows: unknown[]) {
    const find = jest.fn().mockResolvedValue(rows)
    return new ReportsService(
      { find } as never,
      { idsWithDescendants: jest.fn() } as never,
      { getDepartmentId: jest.fn().mockResolvedValue(1) } as never,
      { nameOf: jest.fn().mockResolvedValue('Phòng Truyền thông') } as never,
    )
  }

  const actor = { id: 40, email: 'a@misa.com.vn', roleCode: 'super_admin' } as never

  it('cộng dồn ĐÚNG lượt xem, lượt tải và số phim của từng nhân viên', async () => {
    const service = setupWith([
      filmRow(1, 'Nguyễn Văn A', 10, 2),
      filmRow(1, 'Nguyễn Văn A', 5, 1),
      filmRow(2, 'Trần Thị B', 100, 0),
    ])
    const report = await service.getReport(actor, {})

    const a = report.summary.find((r) => r.uploaderId === 1)!
    expect(a).toMatchObject({ count: 2, viewCount: 15, downloadCount: 3 })
    const b = report.summary.find((r) => r.uploaderId === 2)!
    expect(b).toMatchObject({ count: 1, viewCount: 100, downloadCount: 0 })
  })

  it('tổng toàn báo cáo khớp với tổng từng dòng', async () => {
    const service = setupWith([filmRow(1, 'A', 10, 2), filmRow(2, 'B', 5, 3)])
    const report = await service.getReport(actor, {})
    expect(report.totals).toMatchObject({ films: 2, views: 15, downloads: 5, uploaders: 2 })
  })

  it('xếp nhân viên theo tổng lượt xem giảm dần', async () => {
    const service = setupWith([filmRow(1, 'A', 10, 0), filmRow(2, 'B', 999, 0)])
    const report = await service.getReport(actor, {})
    expect(report.summary[0].uploaderId).toBe(2)
  })
})
