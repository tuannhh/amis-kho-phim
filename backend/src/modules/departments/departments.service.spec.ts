import { ConflictException, NotFoundException } from '@nestjs/common'
import { QueryFailedError } from 'typeorm'
import { DepartmentsService } from './departments.service'
import type { AuthUser } from '../../common/auth/auth-user'
import type { Department } from './entities/department.entity'

/**
 * Danh mục phòng ban quyết định phạm vi quyền của Cấp 3 (ADR-040/042), nên hai hành vi dưới
 * đây là hành vi BẢO MẬT, không chỉ là tiện dụng:
 *  - không cho tồn tại 2 phòng ban trùng tên (nhập nhằng khi gán quyền);
 *  - KHÔNG xoá âm thầm phòng ban đang được tham chiếu (sẽ làm phim mất snapshot phòng ban và
 *    Cấp 3 lặng lẽ mất quyền quản lý chúng).
 */

const actor: AuthUser = { id: 1, email: 'sa@misa.com.vn', roleCode: 'super_admin' }

const dept = (id: number, name: string): Department =>
  ({ id, name, createdAt: new Date('2026-01-01T00:00:00Z') } as Department)

function setup(found: Department | null, counts: { users?: number; films?: number; categories?: number } = {}) {
  const manager = {
    // remove() đếm 3 bảng theo thứ tự users → films → categories (Promise.all).
    count: jest
      .fn()
      .mockResolvedValueOnce(counts.users ?? 0)
      .mockResolvedValueOnce(counts.films ?? 0)
      .mockResolvedValueOnce(counts.categories ?? 0)
      .mockResolvedValue(0),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ departmentId: 1, total: '3' }]),
    }),
  }
  const repo = {
    find: jest.fn().mockResolvedValue(found ? [found] : []),
    findOne: jest.fn().mockResolvedValue(found),
    count: jest.fn().mockResolvedValue(found ? 1 : 0),
    create: jest.fn().mockImplementation((x) => ({ ...x, id: 99, createdAt: new Date() })),
    save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
    remove: jest.fn().mockResolvedValue(undefined),
    manager,
  }
  return { service: new DepartmentsService(repo as never), repo, manager }
}

/** Lỗi trùng khoá thật của driver mysql2 (không phải Error chung chung). */
function dupEntryError(): QueryFailedError {
  const driverError = Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' })
  return new QueryFailedError('INSERT', [], driverError)
}

describe('DepartmentsService.list', () => {
  it('trả về số người dùng của từng phòng ban (đếm 1 câu group-by, không N+1)', async () => {
    const { service, manager } = setup(dept(1, 'Phòng Marketing'))
    const rows = await service.list()
    expect(rows).toEqual([
      { id: 1, name: 'Phòng Marketing', createdAt: expect.any(Date), userCount: 3 },
    ])
    expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1)
  })

  it('danh sách rỗng → không chạy câu đếm nào', async () => {
    const { service, manager } = setup(null)
    await expect(service.list()).resolves.toEqual([])
    expect(manager.createQueryBuilder).not.toHaveBeenCalled()
  })
})

describe('DepartmentsService.create / update', () => {
  it('cắt khoảng trắng đầu cuối của tên', async () => {
    const { service, repo } = setup(null)
    await service.create(actor, { name: '  Phòng Kế toán  ' })
    expect(repo.create).toHaveBeenCalledWith({ name: 'Phòng Kế toán' })
  })

  it('trùng tên (lỗi unique từ DB) → 409, không phải 500', async () => {
    const { service, repo } = setup(null)
    repo.save.mockRejectedValueOnce(dupEntryError())
    await expect(service.create(actor, { name: 'Phòng A' })).rejects.toThrow(ConflictException)
  })

  it('lỗi DB KHÁC trùng khoá không bị hiểu nhầm thành 409', async () => {
    const { service, repo } = setup(null)
    repo.save.mockRejectedValueOnce(new Error('mất kết nối'))
    await expect(service.create(actor, { name: 'Phòng A' })).rejects.toThrow('mất kết nối')
  })

  it('sửa phòng ban không tồn tại → 404', async () => {
    const { service } = setup(null)
    await expect(service.update(actor, 404, { name: 'X' })).rejects.toThrow(NotFoundException)
  })

  it('sửa trùng tên phòng ban khác → 409', async () => {
    const { service, repo } = setup(dept(1, 'Phòng A'))
    repo.save.mockRejectedValueOnce(dupEntryError())
    await expect(service.update(actor, 1, { name: 'Phòng B' })).rejects.toThrow(ConflictException)
  })
})

describe('DepartmentsService.remove — chặn xoá khi còn tham chiếu', () => {
  it('không tồn tại → 404', async () => {
    const { service } = setup(null)
    await expect(service.remove(actor, 404)).rejects.toThrow(NotFoundException)
  })

  it('còn người dùng thuộc phòng ban → 409, KHÔNG xoá', async () => {
    const { service, repo } = setup(dept(1, 'Phòng A'), { users: 2 })
    await expect(service.remove(actor, 1)).rejects.toThrow(ConflictException)
    expect(repo.remove).not.toHaveBeenCalled()
  })

  it('còn phim mang snapshot phòng ban → 409 (không để phim mất ngữ cảnh phân quyền)', async () => {
    const { service, repo } = setup(dept(1, 'Phòng A'), { films: 5 })
    await expect(service.remove(actor, 1)).rejects.toThrow(/5 phim/)
    expect(repo.remove).not.toHaveBeenCalled()
  })

  it('còn chuyên mục tham chiếu → 409', async () => {
    const { service, repo } = setup(dept(1, 'Phòng A'), { categories: 1 })
    await expect(service.remove(actor, 1)).rejects.toThrow(ConflictException)
    expect(repo.remove).not.toHaveBeenCalled()
  })

  it('không còn tham chiếu nào → xoá được', async () => {
    const { service, repo } = setup(dept(1, 'Phòng A'))
    await service.remove(actor, 1)
    expect(repo.remove).toHaveBeenCalled()
  })
})

describe('DepartmentsService.exists — dùng để không tin id client gửi lên', () => {
  it('có thật → true', async () => {
    const { service } = setup(dept(3, 'Phòng C'))
    await expect(service.exists(3)).resolves.toBe(true)
  })
  it('không có → false', async () => {
    const { service } = setup(null)
    await expect(service.exists(999)).resolves.toBe(false)
  })
})
