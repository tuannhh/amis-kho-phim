/**
 * Kiểu & helper dùng chung cho phim (thay `mockFilms.ts` — GĐ2 dữ liệu là API thật).
 * 'storage' vẫn nằm trong FilmSource để VideoPlayer/GĐ3 dùng tiếp khi có MinIO thật;
 * backend GĐ2 chưa bao giờ trả link 'storage'.
 */
export type FilmSource = 'storage' | 'youtube' | 'vimeo' | 'gdrive' | 'misadrive'

export const SOURCE_LABEL: Record<FilmSource, string> = {
  storage: 'Nội bộ',
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  gdrive: 'Google Drive',
  misadrive: 'MISA Drive',
}

export const SOURCE_ICON: Record<FilmSource, string> = {
  storage: 'cloud-download',
  youtube: 'external-link',
  vimeo: 'external-link',
  gdrive: 'external-link',
  misadrive: 'external-link',
}

export type CategoryColor = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
const CATEGORY_COLORS: CategoryColor[] = ['brand', 'success', 'warning', 'danger', 'info', 'neutral']

/** Màu tag chuyên mục — quyết định bởi category id (ổn định, không phụ thuộc thứ tự danh sách). */
export function categoryColorFor(categoryId: number | null): CategoryColor {
  if (categoryId == null) return 'neutral'
  return CATEGORY_COLORS[categoryId % CATEGORY_COLORS.length]
}

const GRADIENTS: Array<[string, string]> = [
  ['#245FDF', '#4584EC'],
  ['#F79009', '#FDB022'],
  ['#2E90FA', '#84CAFF'],
  ['#12B76A', '#32D583'],
  ['#667085', '#98A2B3'],
  ['#9E77ED', '#B692F6'],
]

/** Gradient thumbnail — GĐ2 chưa có ảnh bìa thật trên server (đó là GĐ3/MinIO). */
export function thumbnailGradient(categoryId: number | null): [string, string] {
  if (categoryId == null) return GRADIENTS[0]
  return GRADIENTS[categoryId % GRADIENTS.length]
}

/**
 * publishedAt là ISO date 'YYYY-MM-DD' từ backend — dùng để SẮP XẾP "mới trước".
 *
 * ⚠️ ĐỪNG thêm lại một hàm `isFilmNew(publishedAt)` ở FE. Từ ADR-052, nhãn "Phim mới" không
 * còn suy được từ mình ngày đăng: nó còn phụ thuộc phim có phải bản mới nhất trong nhóm TRÙNG
 * TIÊU ĐỀ hay không — điều mà trang chi tiết (chỉ tải một phim) không thể biết. Backend tính
 * sẵn và trả về `ApiFilm.isNew`; hằng số TTL nay chỉ còn ở backend + `.env`
 * (`NEW_FILM_TTL_DAYS`), một nguồn duy nhất.
 */
export function publishedTime(publishedAt: string): number {
  return new Date(publishedAt).getTime()
}

export function formatVNDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN')
}
