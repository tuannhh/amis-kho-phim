import { apiFetch } from '@/lib/http'
import { useAuthStore } from '@/features/auth/authStore'

export interface ReportFilmRow {
  id: number
  slug: string
  title: string
  uploaderId: number
  uploaderName: string
  categoryName: string | null
  createdAt: string
  viewCount: number
}

export interface ReportSummaryRow {
  uploaderId: number
  uploaderName: string
  count: number
}

export interface FilmsReport {
  summary: ReportSummaryRow[]
  films: ReportFilmRow[]
}

/** uploaderId/from/to undefined = không lọc (quy ước FE: undefined, KHÔNG dùng null). */
export interface ReportQuery {
  uploaderId?: number
  from?: string
  to?: string
}

function buildQuery(q: ReportQuery, extra?: Record<string, string>): string {
  const params = new URLSearchParams()
  if (q.uploaderId != null) params.set('uploaderId', String(q.uploaderId))
  if (q.from) params.set('from', q.from)
  if (q.to) params.set('to', q.to)
  if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v)
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const reportsApi = {
  getFilms: (q: ReportQuery) => apiFetch<FilmsReport>(`/reports/films${buildQuery(q)}`),

  /**
   * Tải CSV: không dùng apiFetch (luôn parse JSON) — gọi fetch thẳng kèm Bearer
   * token, nhận blob rồi trigger download qua thẻ <a> tạm (ADR mới GĐ5).
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
    a.download = 'bao-cao-upload-phim.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
