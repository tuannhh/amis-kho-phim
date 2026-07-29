import { ReportsService } from './reports.service'
import type { FilmsReport } from './reports.service'

/**
 * GĐ7 — báo cáo CSV được mở bằng Excel trên máy quản trị viên. Tên phim là dữ liệu do
 * người dùng tự nhập, nên file CSV là đường đi từ "nhân viên nhập liệu" tới "máy admin".
 * Test tập trung vào CSV injection + escape đúng RFC4180 + BOM cho tiếng Việt.
 */

const service = new ReportsService({} as never)

function reportWithTitle(title: string): FilmsReport {
  return {
    summary: [],
    films: [
      {
        id: 1,
        slug: 's',
        title,
        uploaderId: 1,
        uploaderName: 'Nguyễn Văn A',
        categoryName: 'Đào tạo',
        createdAt: '2026-07-27T03:00:00.000Z',
        viewCount: 12,
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
    const csv = service.toCsv({ summary: [], films: [] })
    expect(csv.split('\r\n')).toHaveLength(1)
  })
})
