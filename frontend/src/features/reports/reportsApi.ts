import { apiFetch } from '@/lib/http'
import { useAuthStore } from '@/features/auth/authStore'

/** Một dòng "theo từng phim" (nhóm dữ liệu 3). */
export interface ReportFilmRow {
  id: number
  slug: string
  title: string
  uploaderId: number
  uploaderName: string
  categoryName: string | null
  departmentId: number | null
  createdAt: string
  publishedAt: string
  viewCount: number
  downloadCount: number
}

/** Một dòng "theo từng nhân viên" (nhóm dữ liệu 2). */
export interface ReportSummaryRow {
  uploaderId: number
  uploaderName: string
  count: number
  viewCount: number
  downloadCount: number
}

export interface FilmsReport {
  totals: { films: number; views: number; downloads: number; uploaders: number }
  /**
   * Phạm vi dữ liệu mà SERVER thực sự áp dụng. `locked = true` nghĩa là người xem là Trưởng
   * phòng và bị giới hạn trong phòng ban của mình — FE hiển thị rõ điều đó và KHÔNG cho chọn
   * phòng ban khác (backend cũng bỏ qua nếu cố gửi lên — ADR-053).
   */
  scope: { departmentId: number | null; departmentName: string | null; locked: boolean }
  summary: ReportSummaryRow[]
  films: ReportFilmRow[]
}

/** Trường undefined = không lọc (quy ước FE: undefined, KHÔNG dùng null). */
export interface ReportQuery {
  uploaderId?: number
  categoryId?: number
  /** Chỉ Cấp 4 dùng; Cấp 3 gửi lên cũng bị server bỏ qua. */
  departmentId?: number
  from?: string
  to?: string
  minViews?: number
  maxViews?: number
  sort?: 'newest' | 'views' | 'downloads'
}

function buildQuery(q: ReportQuery, extra?: Record<string, string>): string {
  const params = new URLSearchParams()
  const set = (k: string, v: number | string | undefined) => {
    if (v != null && v !== '') params.set(k, String(v))
  }
  set('uploaderId', q.uploaderId)
  set('categoryId', q.categoryId)
  set('departmentId', q.departmentId)
  set('from', q.from)
  set('to', q.to)
  set('minViews', q.minViews)
  set('maxViews', q.maxViews)
  set('sort', q.sort)
  if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v)
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const reportsApi = {
  getFilms: (q: ReportQuery) => apiFetch<FilmsReport>(`/reports/films${buildQuery(q)}`),

  /**
   * Tải CSV: không dùng apiFetch (luôn parse JSON) — gọi fetch thẳng kèm Bearer
   * token, nhận blob rồi trigger download qua thẻ <a> tạm (ADR-026).
   */
  async downloadCsv(q: ReportQuery): Promise<void> {
    const auth = useAuthStore()
    const API = (import.meta.env.VITE_API_BASE as string) || '/api'
    const res = await fetch(`${API}/reports/films${buildQuery(q, { format: 'csv' })}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
    if (!res.ok) throw new Error('Xuất CSV không thành công')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bao-cao-phim.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
