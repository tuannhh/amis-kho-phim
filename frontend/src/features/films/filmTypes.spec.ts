import { describe, expect, it } from 'vitest'
import {
  categoryColorFor,
  formatVNDate,
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


describe('formatVNDate', () => {
  it('ngày hợp lệ → chuỗi không rỗng theo locale vi-VN', () => {
    expect(formatVNDate('2026-07-27')).not.toBe('')
  })

  it('chuỗi rác → trả rỗng, KHÔNG in "Invalid Date" ra giao diện', () => {
    expect(formatVNDate('khong-phai-ngay')).toBe('')
    expect(formatVNDate('')).toBe('')
  })
})
