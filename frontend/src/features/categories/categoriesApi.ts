import { apiFetch } from '@/lib/http'

/** Cây chuyên mục trả từ API (khớp CategoryNode của backend). */
export interface ApiCategoryNode {
  id: number
  name: string
  slug: string
  description: string | null
  parentId: number | null
  children?: ApiCategoryNode[]
}

export interface CreateCategoryPayload {
  name: string
  description?: string
  parentId?: number
}

export interface UpdateCategoryPayload {
  name: string
  description?: string
}

export function flattenCategoryTree(nodes: ApiCategoryNode[]): ApiCategoryNode[] {
  return nodes.flatMap((n) => [n, ...(n.children ? flattenCategoryTree(n.children) : [])])
}

/** Một lựa chọn chuyên mục cho `MSelect`, kèm mức thụt lề để thấy rõ quan hệ cha-con. */
export interface CategoryOption {
  label: string
  value: number
  /** 0 = chuyên mục gốc, 1 = con, 2 = cháu... `MSelect` dùng để thụt lề. */
  depth: number
}

/**
 * Làm phẳng cây chuyên mục thành danh sách lựa chọn cho dropdown, GIỮ NGUYÊN thứ tự duyệt cây
 * (cha đứng ngay trên các con của nó) và gắn `depth` để thụt lề (đợt 2 việc 13).
 *
 * Trước đây dropdown lọc dùng `flattenCategoryTree` rồi map thẳng sang `{label, value}` — ra
 * một danh sách PHẲNG, người dùng không phân biệt được đâu là chuyên mục cha, đâu là con, và
 * hai chuyên mục con trùng tên ở hai nhánh khác nhau nhìn hệt nhau.
 *
 * Chuyên mục cha vẫn CHỌN ĐƯỢC (không phải tiêu đề nhóm chết) — chọn cha nghĩa là xem cả
 * nhánh, đúng như `idsWithDescendants` ở backend.
 */
export function categoryOptions(nodes: ApiCategoryNode[], depth = 0): CategoryOption[] {
  return nodes.flatMap((n) => [
    { label: n.name, value: n.id, depth },
    ...(n.children?.length ? categoryOptions(n.children, depth + 1) : []),
  ])
}

/** `categoryId` + toàn bộ chuyên mục con cháu — bản FE của `idsWithDescendants` ở backend. */
export function categoryIdsWithDescendants(
  nodes: ApiCategoryNode[],
  categoryId: number,
): number[] {
  const found = findCategory(nodes, categoryId)
  if (!found) return [categoryId]
  return flattenCategoryTree([found]).map((c) => c.id)
}

export function findCategory(
  nodes: ApiCategoryNode[],
  categoryId: number,
): ApiCategoryNode | undefined {
  for (const n of nodes) {
    if (n.id === categoryId) return n
    const inChild = n.children ? findCategory(n.children, categoryId) : undefined
    if (inChild) return inChild
  }
  return undefined
}

export const categoriesApi = {
  tree: () => apiFetch<ApiCategoryNode[]>('/categories'),
  create: (payload: CreateCategoryPayload) =>
    apiFetch<ApiCategoryNode>('/categories', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: UpdateCategoryPayload) =>
    apiFetch<ApiCategoryNode>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: number) => apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }),
}
