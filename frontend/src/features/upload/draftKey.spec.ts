import { describe, it, expect } from 'vitest'
import { buildDraftKey, purgeLegacyDrafts } from './draftKey'

/**
 * Bảo vệ bản sửa lỗi rò nháp giữa hai tài khoản trên cùng máy (ADR-050).
 * Ca lỗi gốc người dùng gặp: nv2 gõ dở form "Thêm phim" → đăng xuất → superadmin đăng nhập vào
 * cùng màn đó và thấy nguyên nháp của nv2.
 */
describe('buildDraftKey — nháp phải tách theo từng người dùng', () => {
  it('hai người dùng khác nhau ở CÙNG form thêm mới không bao giờ trùng khoá', () => {
    const nv2 = buildDraftKey(79, '')
    const superadmin = buildDraftKey(1, '')
    expect(nv2).not.toBe(superadmin)
    expect(nv2).toBe('kho-phim:film-draft-v2:79:new')
    expect(superadmin).toBe('kho-phim:film-draft-v2:1:new')
  })

  it('cùng một người, form sửa của hai phim khác nhau cũng tách khoá', () => {
    expect(buildDraftKey(79, 'phim-a')).toBe('kho-phim:film-draft-v2:79:edit:phim-a')
    expect(buildDraftKey(79, 'phim-b')).toBe('kho-phim:film-draft-v2:79:edit:phim-b')
    expect(buildDraftKey(79, 'phim-a')).not.toBe(buildDraftKey(79, 'phim-b'))
  })

  it('cùng một phim nhưng hai người sửa thì vẫn tách khoá', () => {
    expect(buildDraftKey(79, 'phim-a')).not.toBe(buildDraftKey(80, 'phim-a'))
  })

  it('chưa xác định được người dùng thì KHÔNG trả về khoá dùng chung', () => {
    // Trả null để nơi gọi bỏ qua hẳn việc đọc/ghi nháp. Nếu ở đây lỡ trả về một khoá
    // không có userId thì lỗi rò cũ quay lại nguyên vẹn.
    expect(buildDraftKey(null, '')).toBeNull()
    expect(buildDraftKey(undefined, 'phim-a')).toBeNull()
  })

  it('khoá mới không mang định dạng cũ (không có userId)', () => {
    expect(buildDraftKey(79, '')).not.toBe('kho-phim:film-draft:new')
  })
})

/** localStorage giả lập tối thiểu, đủ cho `purgeLegacyDrafts`. */
function fakeStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries))
  return {
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    snapshot: () => [...map.keys()].sort(),
  }
}

describe('purgeLegacyDrafts — dọn nháp định dạng cũ không quy được về ai', () => {
  it('xoá khoá cũ, GIỮ khoá mới có userId và mọi khoá không liên quan', () => {
    const s = fakeStorage({
      'kho-phim:film-draft:new': '{}',
      'kho-phim:film-draft:edit:phim-a': '{}',
      'kho-phim:film-draft-v2:79:new': '{}',
      'kp.accessToken': 'xxx',
    })
    const removed = purgeLegacyDrafts(s)
    expect(removed).toBe(2)
    expect(s.snapshot()).toEqual(['kho-phim:film-draft-v2:79:new', 'kp.accessToken'])
  })

  it('không xoá nhầm khoá mới dù tiền tố cũ là tiền tố con của tiền tố mới', () => {
    const s = fakeStorage({ 'kho-phim:film-draft-v2:1:edit:phim-a': '{}' })
    expect(purgeLegacyDrafts(s)).toBe(0)
    expect(s.snapshot()).toEqual(['kho-phim:film-draft-v2:1:edit:phim-a'])
  })
})
