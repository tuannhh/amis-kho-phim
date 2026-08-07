import { describe, expect, it } from 'vitest'
import { pickView } from './responsiveView'

/**
 * GĐ8 — quyết định "dùng view nào" là điểm dễ hỏng nhất của kiến trúc 1 route 2 view: chọn sai
 * thì người dùng mobile thấy giao diện desktop (hoặc ngược lại) mà không có lỗi nào báo ra.
 * Tách thành hàm thuần nên test được thẳng, không cần mount component có router/pinia/API.
 */
describe('pickView', () => {
  const desktop = { name: 'desktop' }
  const mobile = { name: 'mobile' }

  it('Compact (<600px) dùng view mobile', () => {
    expect(pickView(true, desktop, mobile)).toBe(mobile)
  })

  it('Medium/Expanded/Large dùng view desktop', () => {
    expect(pickView(false, desktop, mobile)).toBe(desktop)
  })

  it('trả về đúng tham chiếu truyền vào, không sao chép', () => {
    // Quan trọng vì giá trị trả về được đưa thẳng vào h() — nếu bị bọc/clone, Vue sẽ coi là
    // component khác nhau sau mỗi lần render và unmount/mount lại view liên tục.
    expect(pickView(true, desktop, mobile)).toBe(mobile)
    expect(pickView(true, desktop, mobile)).toBe(mobile)
  })
})
