// GĐ8 — logic lọc/phân trang Kho phim, DÙNG CHUNG giữa bản desktop (FilmListView) và bản
// mobile (FilmListMobileView).
//
// Trước GĐ8 khối này nằm thẳng trong FilmListView.vue. Khi thêm view mobile, chép nó sang
// file thứ hai là cách chắc chắn nhất để hai màn lệch nhau sau vài lần sửa (đúng bài học đã
// gặp với FilmCard ở đợt 2). Vì vậy tách ra composable: view chỉ còn phần TRÌNH BÀY, mọi quy
// tắc lọc — chọn chuyên mục cha thì lấy cả nhánh con, sắp xếp mới nhất trước, đổi bộ lọc thì
// về trang 1 — chỉ tồn tại đúng một chỗ.
import { computed, ref, watch, type Ref } from 'vue'
import {
  categoriesApi,
  categoryIdsWithDescendants,
  categoryOptions as buildCategoryOptions,
  type ApiCategoryNode,
} from '@/features/categories/categoriesApi'
import { publishedTime } from './filmTypes'
import { filmSearchQuery } from './searchState'
import type { ApiFilm } from './filmsApi'

export const PAGE_SIZE_OPTIONS = [
  { label: '20 / trang', value: 20 },
  { label: '30 / trang', value: 30 },
  { label: '50 / trang', value: 50 },
]

/**
 * Lọc danh sách phim theo từ khoá + chuyên mục + cờ "phim mới". Tách thành hàm THUẦN để
 * test được mà không cần dựng component hay gọi API.
 *
 * @param categoryIds `null` = không lọc chuyên mục; ngược lại là tập id gồm cả nhánh con.
 */
export function filterFilms(
  films: ApiFilm[],
  options: { query: string; categoryIds: Set<number> | null; onlyNew: boolean },
): ApiFilm[] {
  const q = options.query.trim().toLowerCase()
  return films
    .filter((f) => {
      if (options.onlyNew && !f.isNew) return false
      if (options.categoryIds && (f.categoryId == null || !options.categoryIds.has(f.categoryId)))
        return false
      if (!q) return true
      const inTitle = f.title.toLowerCase().includes(q)
      const inTags = f.hashtags.some((h) => h.toLowerCase().includes(q))
      return inTitle || inTags
    })
    .slice()
    .sort((a, b) => publishedTime(b.publishedAt) - publishedTime(a.publishedAt))
}

/** Chuỗi "1–20 / 137 phim" hiển thị ở cả hai view. */
export function buildRangeText(total: number, page: number, pageSize: number): string {
  if (!total) return '0 phim'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return `${start}–${end} / ${total} phim`
}

export function useFilmListFilters(films: Ref<ApiFilm[]>) {
  const categoriesTree = ref<ApiCategoryNode[]>([])

  // undefined = xem tất cả chuyên mục (MSelect không nhận null trong kiểu modelValue)
  const categoryFilter = ref<number | undefined>(undefined)
  const onlyNew = ref(false)
  const pageSize = ref(20)
  const page = ref(1)

  function loadCategories() {
    return categoriesApi.tree().then((t) => (categoriesTree.value = t))
  }

  /**
   * Lựa chọn chuyên mục cho bộ lọc: dựng từ CÂY chuyên mục thật (có `depth` để thụt lề), nên
   * chuyên mục chưa có phim nào vẫn hiện đúng vị trí trong cây.
   */
  const categoryFilterOptions = computed(() => [
    { label: 'Tất cả chuyên mục', value: undefined as number | undefined, depth: 0 },
    ...buildCategoryOptions(categoriesTree.value),
  ])

  /** Chọn chuyên mục cha = xem cả nhánh (khớp `idsWithDescendants` ở backend). */
  const selectedCategoryIds = computed(() =>
    categoryFilter.value == null
      ? null
      : new Set(categoryIdsWithDescendants(categoriesTree.value, categoryFilter.value)),
  )

  const hasActiveFilter = computed(
    () => categoryFilter.value != null || onlyNew.value || !!filmSearchQuery.value.trim(),
  )

  const filtered = computed(() =>
    filterFilms(films.value, {
      query: filmSearchQuery.value,
      categoryIds: selectedCategoryIds.value,
      onlyNew: onlyNew.value,
    }),
  )

  const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))

  const paged = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return filtered.value.slice(start, start + pageSize.value)
  })

  const rangeText = computed(() => buildRangeText(filtered.value.length, page.value, pageSize.value))

  /** Tên chuyên mục đang lọc — mobile hiện trên chip bộ lọc đang bật. */
  const selectedCategoryName = computed(
    () =>
      categoryFilterOptions.value.find((o) => o.value === categoryFilter.value)?.label ?? '',
  )

  watch([filtered, pageSize], () => {
    if (page.value > totalPages.value) page.value = totalPages.value
  })
  watch([categoryFilter, onlyNew, filmSearchQuery, pageSize], () => {
    page.value = 1
  })

  function prevPage() {
    if (page.value > 1) page.value--
  }
  function nextPage() {
    if (page.value < totalPages.value) page.value++
  }
  function clearSearch() {
    filmSearchQuery.value = ''
  }
  /** Bỏ toàn bộ bộ lọc đang bật (mobile: nút "Xoá lọc" trong bottom sheet). */
  function resetFilters() {
    categoryFilter.value = undefined
    onlyNew.value = false
    filmSearchQuery.value = ''
  }

  return {
    categoriesTree,
    categoryFilter,
    onlyNew,
    pageSize,
    page,
    loadCategories,
    categoryFilterOptions,
    selectedCategoryIds,
    selectedCategoryName,
    hasActiveFilter,
    filtered,
    totalPages,
    paged,
    rangeText,
    prevPage,
    nextPage,
    clearSearch,
    resetFilters,
  }
}
