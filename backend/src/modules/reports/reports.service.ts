import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm'
import { Film } from '../films/entities/film.entity'
import { CategoriesService } from '../categories/categories.service'
import { UsersService } from '../users/users.service'
import { DepartmentsService } from '../departments/departments.service'
import type { ReportQueryDto } from './dto/report-query.dto'
import type { AuthUser } from '../../common/auth/auth-user'

/** Một dòng "theo từng phim" (nhóm dữ liệu 3). */
export interface ReportFilmRow {
  id: number
  slug: string
  title: string
  uploaderId: number
  uploaderName: string
  categoryName: string | null
  departmentId: number | null
  /** Ngày phim được TẠO trong hệ thống. */
  createdAt: string
  /** Ngày đăng hiển thị cho người dùng (`published_at`, bị đẩy lại khi cập nhật bản mới). */
  publishedAt: string
  viewCount: number
  downloadCount: number
}

/** Một dòng "theo từng nhân viên" (nhóm dữ liệu 2). */
export interface ReportSummaryRow {
  uploaderId: number
  uploaderName: string
  /** Số phim đã đăng (trong phạm vi bộ lọc). */
  count: number
  /** Tổng lượt xem cộng dồn của các phim đó. */
  viewCount: number
  downloadCount: number
}

export interface FilmsReport {
  /** Nhóm dữ liệu 1 — tổng hợp toàn bộ kết quả sau khi lọc. */
  totals: {
    films: number
    views: number
    downloads: number
    uploaders: number
  }
  /** Phạm vi dữ liệu ĐANG được xem — FE hiển thị để người dùng biết mình thấy tới đâu. */
  scope: {
    /** null = toàn công ty (chỉ Cấp 4 mới có thể nhận giá trị này). */
    departmentId: number | null
    departmentName: string | null
    /** true nếu phạm vi bị hệ thống ép theo phòng ban của chính người xem (Cấp 3). */
    locked: boolean
  }
  summary: ReportSummaryRow[]
  films: ReportFilmRow[]
}

/**
 * Báo cáo phim. Từ đợt 2 (ADR-053) mở cho CẢ Cấp 3 (`dept_manager`), nhưng phạm vi dữ liệu
 * của Cấp 3 bị ép cứng theo phòng ban thật của họ đọc từ DB.
 *
 * Ba nhóm dữ liệu trả về trong MỘT lần gọi (`totals` / `summary` / `films`) thay vì ba endpoint
 * riêng: cả ba đều suy ra từ đúng một tập phim đã lọc, tách ra sẽ phải lặp lại y hệt bộ lọc ba
 * lần và dễ lệch nhau khi sửa. FE chia tab để hiển thị, dữ liệu thì lấy một lượt.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Film) private readonly films: Repository<Film>,
    private readonly categories: CategoriesService,
    private readonly users: UsersService,
    private readonly departments: DepartmentsService,
  ) {}

  /**
   * Phạm vi phòng ban THẬT SỰ được áp dụng, quyết định 100% ở server.
   *
   *  - Cấp 4: tôn trọng `query.departmentId` nếu có, không có thì xem toàn công ty.
   *  - Cấp 3: LUÔN là phòng ban đọc từ DB, `query.departmentId` client gửi lên bị bỏ qua
   *    hoàn toàn. Đọc từ DB chứ không từ JWT (ADR-043) — Trưởng phòng vừa bị chuyển phòng
   *    phải đổi phạm vi báo cáo ngay, không chờ token hết hạn.
   *
   * Cấp 3 chưa được gán phòng ban → trả về `NO_SCOPE`, người gọi hiểu là "không quản lý phòng
   * nào" và trả báo cáo RỖNG. Cố ý không mặc định thành "xem tất cả": đây đúng chỗ mà một
   * giá trị `null` bị hiểu nhầm thành "không lọc" sẽ rò toàn bộ dữ liệu công ty (11-coding-rules §3b).
   */
  private static readonly NO_SCOPE = Symbol('no-scope')

  private async resolveDepartmentScope(
    actor: AuthUser,
    query: ReportQueryDto,
  ): Promise<{ departmentId: number | null | typeof ReportsService.NO_SCOPE; locked: boolean }> {
    if (actor.roleCode === 'super_admin') {
      return { departmentId: query.departmentId ?? null, locked: false }
    }
    const own = await this.users.getDepartmentId(actor.id)
    if (own == null) return { departmentId: ReportsService.NO_SCOPE, locked: true }
    return { departmentId: own, locked: true }
  }

  private emptyReport(scope: FilmsReport['scope']): FilmsReport {
    return { totals: { films: 0, views: 0, downloads: 0, uploaders: 0 }, scope, summary: [], films: [] }
  }

  async getReport(actor: AuthUser, query: ReportQueryDto): Promise<FilmsReport> {
    const resolved = await this.resolveDepartmentScope(actor, query)

    if (resolved.departmentId === ReportsService.NO_SCOPE) {
      return this.emptyReport({ departmentId: null, departmentName: null, locked: true })
    }
    const departmentId = resolved.departmentId as number | null

    const where: Record<string, unknown> = {}
    if (departmentId != null) where.departmentId = departmentId
    if (query.uploaderId) where.uploaderId = query.uploaderId

    if (query.categoryId) {
      // Chọn chuyên mục CHA phải gồm cả phim ở chuyên mục CON.
      where.categoryId = In(await this.categories.idsWithDescendants(query.categoryId))
    }

    if (query.from && query.to) {
      where.createdAt = Between(
        new Date(`${query.from}T00:00:00.000Z`),
        new Date(`${query.to}T23:59:59.999Z`),
      )
    } else if (query.from) {
      where.createdAt = MoreThanOrEqual(new Date(`${query.from}T00:00:00.000Z`))
    } else if (query.to) {
      where.createdAt = LessThanOrEqual(new Date(`${query.to}T23:59:59.999Z`))
    }

    if (query.minViews != null && query.maxViews != null) {
      where.viewCount = Between(query.minViews, query.maxViews)
    } else if (query.minViews != null) {
      where.viewCount = MoreThanOrEqual(query.minViews)
    } else if (query.maxViews != null) {
      where.viewCount = LessThanOrEqual(query.maxViews)
    }

    const order =
      query.sort === 'views'
        ? ({ viewCount: 'DESC' } as const)
        : query.sort === 'downloads'
          ? ({ downloadCount: 'DESC' } as const)
          : ({ createdAt: 'DESC' } as const)

    const rows = await this.films.find({ where, relations: ['uploader', 'category'], order })

    const films: ReportFilmRow[] = rows.map((f) => ({
      id: f.id,
      slug: f.slug,
      title: f.title,
      uploaderId: f.uploaderId,
      uploaderName: f.uploader?.fullName ?? '—',
      categoryName: f.category?.name ?? null,
      departmentId: f.departmentId,
      createdAt: f.createdAt.toISOString(),
      publishedAt: f.publishedAt,
      viewCount: f.viewCount,
      downloadCount: f.downloadCount,
    }))

    const summaryMap = new Map<number, ReportSummaryRow>()
    for (const f of films) {
      const existed = summaryMap.get(f.uploaderId)
      if (existed) {
        existed.count++
        existed.viewCount += f.viewCount
        existed.downloadCount += f.downloadCount
      } else {
        summaryMap.set(f.uploaderId, {
          uploaderId: f.uploaderId,
          uploaderName: f.uploaderName,
          count: 1,
          viewCount: f.viewCount,
          downloadCount: f.downloadCount,
        })
      }
    }
    // Xếp theo tổng lượt xem giảm dần — câu hỏi thường gặp nhất của báo cáo này là "phim của
    // ai được xem nhiều nhất", không phải "ai đăng nhiều nhất".
    const summary = Array.from(summaryMap.values()).sort(
      (a, b) => b.viewCount - a.viewCount || b.count - a.count,
    )

    return {
      totals: {
        films: films.length,
        views: films.reduce((s, f) => s + f.viewCount, 0),
        downloads: films.reduce((s, f) => s + f.downloadCount, 0),
        uploaders: summary.length,
      },
      scope: {
        departmentId,
        departmentName: departmentId != null ? await this.departmentName(departmentId) : null,
        locked: resolved.locked,
      },
      summary,
      films,
    }
  }

  /** Tên phòng ban để hiển thị trên đầu báo cáo; lỗi tra cứu không được làm hỏng cả báo cáo. */
  private async departmentName(departmentId: number): Promise<string | null> {
    try {
      return await this.departments.nameOf(departmentId)
    } catch {
      return null
    }
  }

  /**
   * UTF-8 BOM để Excel mở tiếng Việt đúng; header tiếng Việt (ADR-026).
   *
   * GĐ7 — chống CSV/Formula Injection: tên phim do người dùng tự nhập. Nếu ai đó đặt tên
   * phim là `=cmd|'/c calc'!A1` hay `@SUM(...)`, Excel/LibreOffice sẽ coi ô đó là CÔNG THỨC
   * và thực thi khi người quản trị mở file báo cáo — biến báo cáo nội bộ thành đường tấn
   * công vào máy admin. Cách chuẩn: thêm dấu nháy đơn dẫn đầu để ép về dạng text.
   */
  toCsv(report: FilmsReport): string {
    const header = [
      'Tên phim',
      'Người upload',
      'Chuyên mục',
      'Ngày upload',
      'Ngày đăng',
      'Lượt xem',
      'Lượt tải',
    ]
    const escape = (v: string) => {
      const neutralized = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
      return `"${neutralized.replace(/"/g, '""')}"`
    }
    const lines = [header.map(escape).join(',')]
    for (const f of report.films) {
      const date = new Date(f.createdAt)
      const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
      const published = new Date(f.publishedAt)
      const publishedStr = isNaN(published.getTime())
        ? ''
        : `${String(published.getDate()).padStart(2, '0')}/${String(published.getMonth() + 1).padStart(2, '0')}/${published.getFullYear()}`
      lines.push(
        [
          f.title,
          f.uploaderName,
          f.categoryName ?? '',
          dateStr,
          publishedStr,
          String(f.viewCount),
          String(f.downloadCount),
        ]
          .map(escape)
          .join(','),
      )
    }
    return '﻿' + lines.join('\r\n')
  }
}
