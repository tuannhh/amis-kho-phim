import { describe, expect, it } from 'vitest'
import { buildRangeText, filterFilms } from './useFilmListFilters'
import type { ApiFilm } from './filmsApi'

/**
 * GĐ8 — bộ lọc Kho phim giờ chạy cho CẢ hai view (desktop + mobile). Test ở tầng logic dùng
 * chung để một lần sửa quy tắc là cả hai màn cùng đúng hoặc cùng sai — không còn khả năng
 * hai màn lọc ra hai kết quả khác nhau.
 */
function film(over: Partial<ApiFilm>): ApiFilm {
  return {
    id: 1,
    slug: 'phim',
    title: 'Phim',
    description: '',
    duration: '10:00',
    hashtags: [],
    links: {},
    categoryId: null,
    categoryName: null,
    isNew: false,
    viewCount: 0,
    downloadCount: 0,
    uploaderName: 'A',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  } as ApiFilm
}

describe('filterFilms', () => {
  const films = [
    film({ id: 1, title: 'Hội nghị 2026', publishedAt: '2026-01-01T00:00:00.000Z', categoryId: 10 }),
    film({ id: 2, title: 'Đào tạo nội bộ', publishedAt: '2026-03-01T00:00:00.000Z', categoryId: 11, isNew: true }),
    film({ id: 3, title: 'Phóng sự', hashtags: ['misa', 'ky-niem'], publishedAt: '2026-02-01T00:00:00.000Z', categoryId: null }),
  ]
  const all = { query: '', categoryIds: null, onlyNew: false }

  it('không lọc gì thì giữ đủ phim, sắp xếp MỚI NHẤT trước', () => {
    expect(filterFilms(films, all).map((f) => f.id)).toEqual([2, 3, 1])
  })

  it('tìm theo tên phim, không phân biệt hoa thường', () => {
    expect(filterFilms(films, { ...all, query: 'ĐÀO TẠO' }).map((f) => f.id)).toEqual([2])
  })

  it('tìm theo hashtag', () => {
    expect(filterFilms(films, { ...all, query: 'ky-niem' }).map((f) => f.id)).toEqual([3])
  })

  it('lọc theo tập chuyên mục (đã gồm nhánh con) — phim không có chuyên mục bị loại', () => {
    expect(filterFilms(films, { ...all, categoryIds: new Set([10, 11]) }).map((f) => f.id)).toEqual([2, 1])
  })

  it('"chỉ phim mới" chỉ giữ phim có nhãn từ backend', () => {
    expect(filterFilms(films, { ...all, onlyNew: true }).map((f) => f.id)).toEqual([2])
  })

  it('các bộ lọc cộng dồn với nhau', () => {
    expect(
      filterFilms(films, { query: 'đào', categoryIds: new Set([11]), onlyNew: true }).map((f) => f.id),
    ).toEqual([2])
  })

  it('không làm thay đổi mảng gốc (sort trên bản sao)', () => {
    const original = films.map((f) => f.id)
    filterFilms(films, all)
    expect(films.map((f) => f.id)).toEqual(original)
  })
})

describe('buildRangeText', () => {
  it('không có phim nào', () => {
    expect(buildRangeText(0, 1, 20)).toBe('0 phim')
  })

  it('trang đầu', () => {
    expect(buildRangeText(137, 1, 20)).toBe('1–20 / 137 phim')
  })

  it('trang cuối cắt đúng theo tổng số, không vượt quá', () => {
    expect(buildRangeText(137, 7, 20)).toBe('121–137 / 137 phim')
  })
})
