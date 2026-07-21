import { apiFetch } from '@/lib/http'
import type { FilmSource } from './filmTypes'

/** Phim trả từ API (khớp PublicFilm của backend). GĐ3: có 'storage' + thumbnailUrl thật (MinIO). */
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
  thumbnailUrl: string | null
  publishedAt: string
}

export interface CreateUploadUrlResponse {
  storageKey: string
  uploadUrl: string
  expiresIn: number
}

export interface ConfirmVersionPayload {
  storageKey?: string
  thumbnailKey?: string
  duration?: string
  note?: string
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

  // ─── GĐ3: Storage (MinIO) ───────────────────────────────────────────────
  /** Xin presigned PUT URL cho file video (server sinh storage_key). */
  createUploadUrl: (id: number, contentType: string, size: number) =>
    apiFetch<CreateUploadUrlResponse>(`/films/${id}/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ contentType, size }),
    }),
  /** Upload ảnh bìa 16:9 qua backend (multipart) → trả thumbnailKey. */
  uploadThumbnail: (id: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiFetch<{ thumbnailKey: string }>(`/films/${id}/thumbnail`, { method: 'POST', body: fd })
  },
  /** Xác nhận tạo bản mới sau khi upload xong file/ảnh. */
  confirmVersion: (id: number, payload: ConfirmVersionPayload) =>
    apiFetch<ApiFilm>(`/films/${id}/versions`, { method: 'POST', body: JSON.stringify(payload) }),
}

/** Nguồn thật sự có link (loại trừ 'storage' vì backend GĐ2 không trả). */
export function filmSources(film: Pick<ApiFilm, 'links'>): FilmSource[] {
  return Object.keys(film.links) as FilmSource[]
}
