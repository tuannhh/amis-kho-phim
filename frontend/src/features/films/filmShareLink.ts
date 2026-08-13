import type { ApiFilm } from './filmsApi'

/** URL chia sẻ canonical của phim; luôn dùng slug do backend cấp, không ghép từ title ở client. */
export function canonicalFilmPath(
  film: Pick<ApiFilm, 'urlCategorySlug' | 'urlFilmSlug'>,
): string {
  return `/${encodeURIComponent(film.urlCategorySlug)}/${encodeURIComponent(film.urlFilmSlug)}`
}

/** Hyperlink tuyệt đối để copy/chia sẻ qua app khác, email hoặc chat. */
export function canonicalFilmUrl(
  film: Pick<ApiFilm, 'urlCategorySlug' | 'urlFilmSlug'>,
  origin = window.location.origin,
): string {
  return new URL(canonicalFilmPath(film), origin).toString()
}
