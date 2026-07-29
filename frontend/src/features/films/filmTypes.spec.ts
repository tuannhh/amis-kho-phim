import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  categoryColorFor,
  formatVNDate,
  isFilmNew,
  NEW_FILM_TTL_DAYS,
  thumbnailGradient,
} from './filmTypes'

/**
 * GĐ7 — test logic thuần (không UI) của phần hiển thị phim. Đây là chỗ dễ sinh bug âm thầm:
 * màu chuyên mục phải ỔN ĐỊNH theo id (ADR-017) và tag "Phim mới" phải tắt đúng hạn.
 */

describe('categoryColorFor (ADR-017 — màu theo id, không theo vị trí danh sách)', () => {
  it('cùng một id luôn ra cùng một màu, không phụ thuộc tập dữ liệu đang tải', () => {
    expect(categoryColorFor(7)).toBe(categoryColorFor(7))
  })

  it('id khác nhau (không cùng lớp dư) cho màu khác nhau', () => {
    expect(categoryColorFor(1)).not.toBe(categoryColorFor(2))
  })

  it('không có chuyên mục → màu trung tính', () => {
    expect(categoryColorFor(null)).toBe('neutral')
  })

  it('id lớn vẫn nằm trong bảng màu hợp lệ (không undefined)', () => {
    const allowed = ['brand', 'success', 'warning', 'danger', 'info', 'neutral']
    for (const id of [0, 5, 6, 12, 999]) expect(allowed).toContain(categoryColorFor(id))
  })
})

describe('thumbnailGradient', () => {
  it('luôn trả về cặp mã màu hex hợp lệ', () => {
    for (const id of [null, 0, 3, 101]) {
      const [from, to] = thumbnailGradient(id)
      expect(from).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(to).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('ổn định theo id', () => {
    expect(thumbnailGradient(4)).toEqual(thumbnailGradient(4))
  })
})

describe('isFilmNew', () => {
  afterEach(() => vi.useRealTimers())

  const freezeAt = (iso: string) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(iso))
  }

  it('phim đăng hôm nay là phim mới', () => {
    freezeAt('2026-07-27T10:00:00Z')
    expect(isFilmNew('2026-07-27')).toBe(true)
  })

  it('phim vừa trong hạn TTL vẫn là mới', () => {
    freezeAt('2026-07-27T00:00:00Z')
    expect(isFilmNew('2026-07-13')).toBe(true) // đúng 14 ngày
  })

  it('phim quá hạn TTL thì hết "mới"', () => {
    freezeAt('2026-07-27T00:00:01Z')
    expect(isFilmNew('2026-07-12')).toBe(false) // 15 ngày
  })

  it('ngày xuất bản trong tương lai KHÔNG bị coi là mới (chặn dữ liệu lệch)', () => {
    freezeAt('2026-07-27T00:00:00Z')
    expect(isFilmNew('2026-08-01')).toBe(false)
  })

  it('hằng số TTL khớp mặc định NEW_FILM_TTL_DAYS ở .env', () => {
    expect(NEW_FILM_TTL_DAYS).toBe(14)
  })
})

describe('formatVNDate', () => {
  it('ngày hợp lệ → chuỗi không rỗng theo locale vi-VN', () => {
    expect(formatVNDate('2026-07-27')).not.toBe('')
  })

  it('chuỗi rác → trả rỗng, KHÔNG in "Invalid Date" ra giao diện', () => {
    expect(formatVNDate('khong-phai-ngay')).toBe('')
    expect(formatVNDate('')).toBe('')
  })
})
