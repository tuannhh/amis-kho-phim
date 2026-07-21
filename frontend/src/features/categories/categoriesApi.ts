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

export const categoriesApi = {
  tree: () => apiFetch<ApiCategoryNode[]>('/categories'),
  create: (payload: CreateCategoryPayload) =>
    apiFetch<ApiCategoryNode>('/categories', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: UpdateCategoryPayload) =>
    apiFetch<ApiCategoryNode>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: number) => apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }),
}
