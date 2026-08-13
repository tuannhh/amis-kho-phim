import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { filmsApi, type ApiFilm } from './filmsApi'

/**
 * Tải phim theo route hiện tại (2026-08-13) — DÙNG CHUNG cho `FilmDetailView`/
 * `FilmDetailMobileView` vì cả 2 phải xử lý giống hệt nhau 2 kiểu route:
 *
 *  - Route MỚI `/:categorySlug/:filmSlug` (tên `film-detail`) — tra qua `getByPath`, có thể
 *    là bản canonical HIỆN TẠI hoặc một alias lịch sử (phim đã sửa/thêm bản mới sau khi URL
 *    này được chia sẻ).
 *  - Route CŨ `/films/:slug` (tên `film-detail-legacy`, giữ cho link đã chia sẻ TRƯỚC
 *    2026-08-13) — tra qua `getBySlug` như trước giờ.
 *
 * Cả hai trường hợp, nếu route đang đứng KHÔNG PHẢI bản canonical mới nhất của phim, tự
 * `router.replace` sang canonical — địa chỉ trên thanh URL hội tụ dần về bản mới nhất (giống
 * Youtube), nhưng KHÔNG BAO GIỜ 404: link cũ luôn tải đúng phim trước khi (nếu có) điều
 * hướng tiếp.
 */
export async function loadFilmByRoute(
  route: RouteLocationNormalizedLoaded,
  router: Router,
): Promise<ApiFilm> {
  const legacySlug = route.params.slug as string | undefined
  const film = legacySlug
    ? await filmsApi.getBySlug(legacySlug)
    : await filmsApi.getByPath(route.params.categorySlug as string, route.params.filmSlug as string)

  const isCanonical =
    !legacySlug &&
    route.params.categorySlug === film.urlCategorySlug &&
    route.params.filmSlug === film.urlFilmSlug
  if (!isCanonical) {
    router.replace({
      name: 'film-detail',
      params: { categorySlug: film.urlCategorySlug, filmSlug: film.urlFilmSlug },
    })
  }
  return film
}
