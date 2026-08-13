import { apiFetch } from '@/lib/http'
import type { FilmSource } from './filmTypes'
import type { UserRole } from '@/features/auth/authStore'

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
  /**
   * Snapshot phòng ban lúc tạo phim + vai trò hiện tại của người tạo (ADR-042). FE dùng để ẩn
   * /hiện nút Sửa/Xoá cho Cấp 3; chốt chặn thật vẫn ở backend `assertCanManage`.
   */
  departmentId: number | null
  uploaderRoleCode: UserRole | null
  viewCount: number
  downloadCount: number
  duration: string
  hashtags: string[]
  links: Partial<Record<FilmSource, string>>
  thumbnailUrl: string | null
  publishedAt: string
  /**
   * URL công khai HIỆN TẠI của phim (2026-08-13) — ghép router-link dạng
   * `{ name: 'film-detail', params: { categorySlug: urlCategorySlug, filmSlug: urlFilmSlug } }`.
   * LUÔN là bản canonical mới nhất kể cả khi phim này được tải qua 1 alias URL cũ hơn.
   */
  urlCategorySlug: string
  urlFilmSlug: string
  /**
   * Có gắn nhãn "Phim mới" hay không — TÍNH Ở BACKEND (ADR-052), FE chỉ hiển thị.
   *
   * ĐỪNG thay bằng `isFilmNew(publishedAt)` ở FE cho "gọn": nhãn còn phụ thuộc phim này có
   * phải bản mới nhất trong nhóm TRÙNG TIÊU ĐỀ hay không, mà trang chi tiết chỉ tải đúng một
   * phim nên FE không thể biết điều đó.
   */
  isNew: boolean
}

export interface CreateUploadUrlResponse {
  storageKey: string
  uploadUrl: string
  expiresIn: number
}

export interface CreateThumbnailUploadUrlResponse {
  thumbnailKey: string
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
  /** Phim người dùng hiện tại có quyền sửa/xoá — màn "Phim tôi quản lý" (đợt 2 việc 6). */
  listManaged: () => apiFetch<ApiFilm[]>('/films?scope=managed'),
  getBySlug: (slug: string) => apiFetch<ApiFilm>(`/films/${slug}`),
  /** Tra theo URL công khai `ten-chuyen-muc/ten-phim-ngay-phat-hanh-version` (2026-08-13). */
  getByPath: (categorySlug: string, filmSlug: string) =>
    apiFetch<ApiFilm>(`/films/by-path/${categorySlug}/${filmSlug}`),
  create: (payload: UpsertFilmPayload) =>
    apiFetch<ApiFilm>('/films', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: UpsertFilmPayload) =>
    apiFetch<ApiFilm>(`/films/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: number) => apiFetch<void>(`/films/${id}`, { method: 'DELETE' }),
  /** Ghi nhận 1 lượt xem khi vào trang xem phim — BE dedupe theo user trong 30' (GĐ4). */
  recordView: (id: number) => apiFetch<{ viewCount: number }>(`/films/${id}/view`, { method: 'POST' }),

  // ─── GĐ3: Storage (MinIO) ───────────────────────────────────────────────
  /** Xin presigned PUT URL cho file video (server sinh storage_key). */
  createUploadUrl: (id: number, contentType: string, size: number) =>
    apiFetch<CreateUploadUrlResponse>(`/films/${id}/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ contentType, size }),
    }),
  /**
   * Xin presigned PUT URL cho ẢNH BÌA (ADR-055) — thay cho luồng multipart cũ.
   * Ảnh nay đi thẳng trình duyệt → MinIO, backend không nhận byte nào.
   */
  createThumbnailUploadUrl: (id: number, contentType: string, size: number) =>
    apiFetch<CreateThumbnailUploadUrlResponse>(`/films/${id}/thumbnail-url`, {
      method: 'POST',
      body: JSON.stringify({ contentType, size }),
    }),
  /** Xác nhận tạo bản mới sau khi upload xong file/ảnh. */
  confirmVersion: (id: number, payload: ConfirmVersionPayload) =>
    apiFetch<ApiFilm>(`/films/${id}/versions`, { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * Ghi nhận 1 lượt tải về (đợt 2 việc 8). KHÔNG dedupe — mỗi lần bấm là một lượt.
   * Việc tải file thật vẫn do link `/media/:key` đảm nhiệm, hàm này chỉ đếm.
   */
  recordDownload: (id: number) =>
    apiFetch<{ downloadCount: number }>(`/films/${id}/download`, { method: 'POST' }),
}

/** Nguồn thật sự có link (loại trừ 'storage' vì backend GĐ2 không trả). */
export function filmSources(film: Pick<ApiFilm, 'links'>): FilmSource[] {
  return Object.keys(film.links) as FilmSource[]
}
