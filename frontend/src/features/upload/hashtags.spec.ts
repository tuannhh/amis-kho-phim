import { describe, it, expect } from 'vitest'
import { parseHashtags } from './hashtags'

describe('parseHashtags', () => {
  it('tách theo dấu phẩy, KHÔNG tách theo khoảng trắng (ví dụ gốc của người dùng)', () => {
    expect(parseHashtags('MISA, Agentic AI')).toEqual(['MISA', 'Agentic AI'])
  })

  it('trim khoảng trắng thừa quanh từng hashtag', () => {
    expect(parseHashtags('   MISA   ,   Agentic AI   ')).toEqual(['MISA', 'Agentic AI'])
  })

  it('bỏ phần rỗng do phẩy thừa/liên tiếp', () => {
    expect(parseHashtags(',, MISA ,,, , Agentic AI ,,')).toEqual(['MISA', 'Agentic AI'])
  })

  it('loại trùng lặp trong chính chuỗi vừa gõ (không phân biệt hoa/thường)', () => {
    expect(parseHashtags('MISA, misa, MiSa, AMIS')).toEqual(['MISA', 'AMIS'])
  })

  it('loại trùng với hashtag đã chọn trước đó', () => {
    expect(parseHashtags('MISA, Agentic AI', ['misa'])).toEqual(['Agentic AI'])
  })

  it('bỏ ký tự # người dùng quen gõ kèm', () => {
    expect(parseHashtags('#MISA, ##Agentic AI')).toEqual(['MISA', 'Agentic AI'])
  })

  it('chuỗi rỗng / chỉ khoảng trắng / chỉ dấu phẩy → không thêm gì', () => {
    expect(parseHashtags('')).toEqual([])
    expect(parseHashtags('    ')).toEqual([])
    expect(parseHashtags(',,,')).toEqual([])
  })

  it('một hashtag duy nhất không có dấu phẩy vẫn nhận', () => {
    expect(parseHashtags('Chuyển đổi số')).toEqual(['Chuyển đổi số'])
  })

  it('giữ nguyên thứ tự người dùng gõ', () => {
    expect(parseHashtags('C, A, B')).toEqual(['C', 'A', 'B'])
  })
})
