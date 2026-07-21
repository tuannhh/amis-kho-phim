import { apiFetch } from '@/lib/http'
import type { FilmSource } from './filmTypes'

/** Phim trả từ API (khớp PublicFilm của backend). GĐ2: chưa có 'storage' thật. */
export interface ApiFilm {
  id: number
  slug: string
  title: string
  description: string | null
  categoryId: number | null
  categoryName: string | null
  uploaderId: number
  uploaderName: string
  viewCount: number
  duration: string
  hashtags: string[]
  links: Partial<Record<FilmSource, string>>
  publishedAt: string
}

export interface UpsertFilmPayload {
  title: string
  categoryId: number
  description?: string
  hashtags?: string[]
  youtubeUrl?: string
  vimeoUrl?: string
  gdriveUrl?: string
  misadriveUrl?: string
}

export const filmsApi = {
  list: () => apiFetch<ApiFilm[]>('/films'),
  getBySlug: (slug: string) => apiFetch<ApiFilm>(`/films/${slug}`),
  create: (payload: UpsertFilmPayload) =>
    apiFetch<ApiFilm>('/films', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: UpsertFilmPayload) =>
    apiFetch<ApiFilm>(`/films/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: number) => apiFetch<void>(`/films/${id}`, { method: 'DELETE' }),
}

/** Nguồn thật sự có link (loại trừ 'storage' vì backend GĐ2 không trả). */
export function filmSources(film: Pick<ApiFilm, 'links'>): FilmSource[] {
  return Object.keys(film.links) as FilmSource[]
}
