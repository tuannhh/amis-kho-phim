import { describe, expect, it } from 'vitest'
import {
  categoryIdsWithDescendants,
  categoryOptions,
  findCategory,
  flattenCategoryTree,
  type ApiCategoryNode,
} from './categoriesApi'

/**
 * Đợt 2 việc 13/14 — bộ lọc chuyên mục phải thể hiện đúng CÂY (cha, con thụt lề) và chọn
 * chuyên mục cha phải lấy được cả phim ở chuyên mục con. Hai hàm dưới đây là logic thuần
 * quyết định điều đó, nên test thẳng vào chúng.
 */

const node = (
  id: number,
  name: string,
  children?: ApiCategoryNode[],
  parentId: number | null = null,
): ApiCategoryNode => ({ id, name, slug: `c${id}`, description: null, parentId, children })

/** Cây 3 cấp để bắt được lỗi "chỉ xử lý đúng một cấp con". */
const TREE: ApiCategoryNode[] = [
  node(1, 'AMIS OneAI', [
    node(2, 'Hướng dẫn', [node(3, 'Hướng dẫn nâng cao', undefined, 2)], 1),
    node(4, 'Giới thiệu', undefined, 1),
  ]),
  node(5, 'Phim Giới thiệu công ty'),
]

describe('categoryOptions — lựa chọn chuyên mục cho dropdown', () => {
  it('giữ đúng thứ tự duyệt cây: cha đứng ngay trên các con của nó', () => {
    expect(categoryOptions(TREE).map((o) => o.value)).toEqual([1, 2, 3, 4, 5])
  })

  it('gắn depth đúng theo cấp để MSelect thụt lề', () => {
    const byId = new Map(categoryOptions(TREE).map((o) => [o.value, o.depth]))
    expect(byId.get(1)).toBe(0) // gốc
    expect(byId.get(2)).toBe(1) // con
    expect(byId.get(3)).toBe(2) // cháu
    expect(byId.get(5)).toBe(0) // gốc khác
  })

  it('chuyên mục cha KHÔNG bị vô hiệu hoá — chọn cha là lọc cả nhánh', () => {
    expect(categoryOptions(TREE).every((o) => !('disabled' in o && o.disabled))).toBe(true)
  })

  it('cây rỗng → danh sách rỗng, không crash', () => {
    expect(categoryOptions([])).toEqual([])
  })
})

describe('categoryIdsWithDescendants — chọn cha lấy cả con', () => {
  it('chuyên mục cha trả về chính nó + toàn bộ con cháu (nhiều cấp)', () => {
    expect(categoryIdsWithDescendants(TREE, 1).sort()).toEqual([1, 2, 3, 4])
  })

  it('chuyên mục giữa cây chỉ lấy nhánh của nó', () => {
    expect(categoryIdsWithDescendants(TREE, 2).sort()).toEqual([2, 3])
  })

  it('chuyên mục lá chỉ trả về chính nó', () => {
    expect(categoryIdsWithDescendants(TREE, 5)).toEqual([5])
  })

  it('id không có trong cây → vẫn trả về chính id đó (lọc ra rỗng, không ném lỗi)', () => {
    expect(categoryIdsWithDescendants(TREE, 999)).toEqual([999])
  })
})

describe('findCategory / flattenCategoryTree', () => {
  it('tìm được chuyên mục nằm sâu trong cây', () => {
    expect(findCategory(TREE, 3)?.name).toBe('Hướng dẫn nâng cao')
  })

  it('không tìm thấy → undefined', () => {
    expect(findCategory(TREE, 999)).toBeUndefined()
  })

  it('làm phẳng đủ mọi cấp', () => {
    expect(flattenCategoryTree(TREE)).toHaveLength(5)
  })
})
