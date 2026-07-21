import { reactive } from 'vue'

export interface CategoryNode {
  id: string
  label: string
  description?: string
  parentId?: string | null
  children?: CategoryNode[]
}

/** Mock chuyên mục GĐ 0.5 — thay bằng API thật ở GĐ 2 (categories module). */
export const categoryTree: CategoryNode[] = reactive([
  {
    id: 'gioi-thieu-san-pham',
    label: 'Giới thiệu sản phẩm',
    description: 'Phim giới thiệu tính năng, sản phẩm mới của MISA',
    parentId: null,
  },
  {
    id: 'gioi-thieu-cong-ty',
    label: 'Giới thiệu công ty',
    description: 'Phim giới thiệu tổng quan về MISA',
    parentId: null,
  },
  {
    id: 'phim-su-kien',
    label: 'Phim sự kiện',
    description: 'Ghi hình các sự kiện nội bộ, lễ kỷ niệm',
    parentId: null,
    children: [
      {
        id: 'le-ky-niem-tri-an',
        label: 'Lễ kỷ niệm & tri ân',
        description: 'Các sự kiện kỷ niệm thành lập, tri ân khách hàng',
        parentId: 'phim-su-kien',
      },
      {
        id: 'gala-vinh-danh',
        label: 'Gala & vinh danh',
        description: 'Chương trình gala, vinh danh nhân viên xuất sắc',
        parentId: 'phim-su-kien',
      },
    ],
  },
  {
    id: 'phim-dao-tao',
    label: 'Phim đào tạo',
    description: 'Video đào tạo nội bộ, hướng dẫn sử dụng sản phẩm',
    parentId: null,
  },
  {
    id: 'van-the-my',
    label: 'Văn thể mỹ',
    description: 'Hoạt động văn hoá, thể thao, phong trào nội bộ',
    parentId: null,
  },
  {
    id: 'tu-lieu-lich-su',
    label: 'Tư liệu lịch sử',
    description: 'Phim tư liệu về lịch sử hình thành và phát triển MISA',
    parentId: null,
  },
])

export function flattenCategories(nodes: CategoryNode[] = categoryTree): CategoryNode[] {
  return nodes.flatMap((n) => [n, ...(n.children ? flattenCategories(n.children) : [])])
}

function findParentArray(nodes: CategoryNode[], id: string): CategoryNode[] | null {
  const idx = nodes.findIndex((n) => n.id === id)
  if (idx !== -1) return nodes
  for (const n of nodes) {
    if (n.children) {
      const found = findParentArray(n.children, id)
      if (found) return found
    }
  }
  return null
}

export function removeCategory(id: string) {
  const arr = findParentArray(categoryTree, id)
  if (!arr) return
  const idx = arr.findIndex((n) => n.id === id)
  if (idx !== -1) arr.splice(idx, 1)
}
