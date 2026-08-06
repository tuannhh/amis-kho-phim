import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import type { UsersService } from '../users/users.service'
import type { AuthUser } from '../../common/auth/auth-user'
import type { Category } from './entities/category.entity'

/**
 * Quyền ghi chuyên mục phân theo TẦNG của bản ghi (ADR-051):
 *
 *   chuyên mục GỐC (parentId == null)  → CHỈ Cấp 4 super_admin
 *   chuyên mục CON (parentId != null)  → Cấp 2 trở lên (employee/dept_manager/super_admin)
 *   Cấp 1 viewer                        → không tạo/sửa/xoá gì
 *
 * Phủ đủ ma trận 4 vai trò × 2 loại tầng cho cả create/update/remove. Quy tắc này thay
 * ADR-044 (trước đây mọi thao tác ghi chuyên mục đều khoá ở Cấp 4).
 */

const ROOT_ID = 100 // chuyên mục gốc có sẵn trong "DB"
const CHILD_ID = 101 // chuyên mục con của ROOT_ID

const ROLES: AuthUser['roleCode'][] = ['viewer', 'employee', 'dept_manager', 'super_admin']

const actor = (roleCode: AuthUser['roleCode']): AuthUser => ({
  id: 1,
  email: `${roleCode}@misa.com.vn`,
  roleCode,
})

function makeService() {
  const rows = new Map<number, Category>([
    [ROOT_ID, { id: ROOT_ID, name: 'Gốc', slug: 'goc', description: null, parentId: null } as Category],
    [CHILD_ID, { id: CHILD_ID, name: 'Con', slug: 'con', description: null, parentId: ROOT_ID } as Category],
  ])

  const repo = {
    find: jest.fn(async () => [...rows.values()]),
    findOne: jest.fn(async ({ where }: { where: { id?: number; slug?: string } }) => {
      if (where.id != null) return rows.get(where.id) ?? null
      // uniqueSlug() dò trùng slug — luôn trả null để nhánh "slug chưa dùng" chạy thẳng.
      return null
    }),
    create: jest.fn((data: Partial<Category>) => ({ ...data }) as Category),
    save: jest.fn(async (e: Category) => ({ ...e, id: e.id ?? 999 })),
    remove: jest.fn(async (e: Category) => void rows.delete(e.id)),
  }

  const users = { getDepartmentId: jest.fn(async () => 1) } as unknown as UsersService

  return new CategoriesService(repo as never, users)
}

describe('CategoriesService.create — tạo chuyên mục theo tầng', () => {
  it('CHỈ Cấp 4 tạo được chuyên mục GỐC (parentId không truyền)', async () => {
    for (const role of ROLES) {
      const svc = makeService()
      const call = svc.create(actor(role), { name: 'Chuyên mục gốc mới' })
      if (role === 'super_admin') {
        await expect(call).resolves.toMatchObject({ parentId: null })
      } else {
        await expect(call).rejects.toBeInstanceOf(ForbiddenException)
      }
    }
  })

  it('Cấp 2 trở lên tạo được chuyên mục CON; Cấp 1 thì không', async () => {
    for (const role of ROLES) {
      const svc = makeService()
      const call = svc.create(actor(role), { name: 'Chuyên mục con mới', parentId: ROOT_ID })
      if (role === 'viewer') {
        await expect(call).rejects.toBeInstanceOf(ForbiddenException)
      } else {
        await expect(call).resolves.toMatchObject({ parentId: ROOT_ID })
      }
    }
  })

  it('thông báo từ chối tạo chuyên mục gốc chỉ đường sang tạo chuyên mục con', async () => {
    const svc = makeService()
    await expect(svc.create(actor('employee'), { name: 'Gốc lén' })).rejects.toThrow(
      /chuyên mục con/i,
    )
  })
})

describe('CategoriesService.update — sửa theo tầng của BẢN GHI đã lưu', () => {
  it('CHỈ Cấp 4 sửa được chuyên mục GỐC', async () => {
    for (const role of ROLES) {
      const svc = makeService()
      const call = svc.update(actor(role), ROOT_ID, { name: 'Tên gốc mới' })
      if (role === 'super_admin') {
        await expect(call).resolves.toMatchObject({ name: 'Tên gốc mới' })
      } else {
        await expect(call).rejects.toBeInstanceOf(ForbiddenException)
      }
    }
  })

  it('Cấp 2 trở lên sửa được chuyên mục CON; Cấp 1 thì không', async () => {
    for (const role of ROLES) {
      const svc = makeService()
      const call = svc.update(actor(role), CHILD_ID, { name: 'Tên con mới' })
      if (role === 'viewer') {
        await expect(call).rejects.toBeInstanceOf(ForbiddenException)
      } else {
        await expect(call).resolves.toMatchObject({ name: 'Tên con mới' })
      }
    }
  })
})

describe('CategoriesService.remove — xoá theo tầng của BẢN GHI đã lưu', () => {
  it('CHỈ Cấp 4 xoá được chuyên mục GỐC (xoá gốc là cascade cả cây con)', async () => {
    for (const role of ROLES) {
      const svc = makeService()
      const call = svc.remove(actor(role), ROOT_ID)
      if (role === 'super_admin') {
        await expect(call).resolves.toBeUndefined()
      } else {
        await expect(call).rejects.toBeInstanceOf(ForbiddenException)
      }
    }
  })

  it('Cấp 2 trở lên xoá được chuyên mục CON; Cấp 1 thì không', async () => {
    for (const role of ROLES) {
      const svc = makeService()
      const call = svc.remove(actor(role), CHILD_ID)
      if (role === 'viewer') {
        await expect(call).rejects.toBeInstanceOf(ForbiddenException)
      } else {
        await expect(call).resolves.toBeUndefined()
      }
    }
  })

  it('chuyên mục không tồn tại → 404, không phải 403 (không rò sự tồn tại qua mã lỗi)', async () => {
    const svc = makeService()
    await expect(svc.remove(actor('super_admin'), 12345)).rejects.toBeInstanceOf(NotFoundException)
  })
})
