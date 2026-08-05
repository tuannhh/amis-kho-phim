import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { UsersService, creatableRoles } from './users.service'
import type { AuthUser } from '../../common/auth/auth-user'
import type { RoleCode } from './entities/role.entity'
import type { User } from './entities/user.entity'

/**
 * Ma trận quản trị người dùng — RBAC 4 CẤP (ADR-040). Sai ở đây nghĩa là một cấp thấp tự nâng
 * quyền, hoặc gán được phòng ban không tồn tại (làm lệch scope quyền của Cấp 3).
 *
 * Cập nhật từ bộ test GĐ7: vai trò `admin` cũ KHÔNG CÒN TỒN TẠI (đã migrate sang Cấp 4), nên
 * các ca "admin quản lý được employee" được thay bằng "chỉ Cấp 4 quản lý được người dùng" —
 * đây là hành vi MỚI đã xác nhận theo đặc tả, không phải nới assertion cho test chạy qua.
 */

const actor = (id: number, roleCode: RoleCode): AuthUser => ({ id, email: `u${id}@misa.com.vn`, roleCode })

const target = (id: number, roleCode: RoleCode, departmentId: number | null = null): User =>
  ({ id, email: `t${id}@misa.com.vn`, fullName: 'T', roleCode, departmentId, isActive: true } as User)

function setup(found: User | null, departmentExists = true) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(found),
    save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
    remove: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((u) => u),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(),
  }
  const departments = { exists: jest.fn().mockResolvedValue(departmentExists) }
  return { service: new UsersService(repo as never, departments as never), repo, departments }
}

describe('creatableRoles — ai gán được vai trò nào (RBAC 4 cấp)', () => {
  it('Cấp 4 gán được Cấp 1/2/3, KHÔNG gán được Cấp 4 khác', () => {
    expect(creatableRoles('super_admin')).toEqual(['viewer', 'employee', 'dept_manager'])
  })
  it('Cấp 3 (Trưởng phòng) KHÔNG quản lý người dùng', () => {
    expect(creatableRoles('dept_manager')).toEqual([])
  })
  it('Cấp 2 (Nhân viên) không tạo được ai', () => {
    expect(creatableRoles('employee')).toEqual([])
  })
  it('Cấp 1 (Người xem) không tạo được ai', () => {
    expect(creatableRoles('viewer')).toEqual([])
  })
})

describe('UsersService.create', () => {
  it('Cấp 3 cố tạo tài khoản → 403 (dù FE gửi payload gì)', async () => {
    const { service } = setup(null)
    await expect(
      service.create(actor(2, 'dept_manager'), {
        email: 'x@misa.com.vn',
        fullName: 'X',
        roleCode: 'employee',
      } as never),
    ).rejects.toThrow(ForbiddenException)
  })

  it('Cấp 2 cố tạo tài khoản → 403', async () => {
    const { service } = setup(null)
    await expect(
      service.create(actor(3, 'employee'), { email: 'x@misa.com.vn', fullName: 'X', roleCode: 'employee' } as never),
    ).rejects.toThrow(ForbiddenException)
  })

  it('Cấp 1 cố tạo tài khoản → 403', async () => {
    const { service } = setup(null)
    await expect(
      service.create(actor(4, 'viewer'), { email: 'x@misa.com.vn', fullName: 'X', roleCode: 'viewer' } as never),
    ).rejects.toThrow(ForbiddenException)
  })

  it('KHÔNG ai gán được vai trò Cấp 4 (kể cả chính Cấp 4)', async () => {
    const { service } = setup(null)
    await expect(
      service.create(actor(1, 'super_admin'), {
        email: 'x@misa.com.vn',
        fullName: 'X',
        roleCode: 'super_admin',
      } as never),
    ).rejects.toThrow(ForbiddenException)
  })

  it('email trùng → 409', async () => {
    const { service } = setup(target(9, 'employee'))
    await expect(
      service.create(actor(1, 'super_admin'), { email: 't9@misa.com.vn', fullName: 'X', roleCode: 'employee' } as never),
    ).rejects.toThrow(ConflictException)
  })

  it('phòng ban không tồn tại → 400 (không tin id client gửi lên)', async () => {
    const { service } = setup(null, false)
    await expect(
      service.create(actor(1, 'super_admin'), {
        email: 'x@misa.com.vn',
        fullName: 'X',
        roleCode: 'employee',
        departmentId: 999,
      } as never),
    ).rejects.toThrow(BadRequestException)
  })

  it('gán phòng ban hợp lệ → lưu đúng department_id', async () => {
    const { service, repo, departments } = setup(null)
    await service.create(actor(1, 'super_admin'), {
      email: 'x@misa.com.vn',
      fullName: 'X',
      roleCode: 'dept_manager',
      departmentId: 7,
    } as never)
    expect(departments.exists).toHaveBeenCalledWith(7)
    expect(repo.save.mock.calls[0][0].departmentId).toBe(7)
  })

  it('không truyền phòng ban → department_id = null (không gọi kiểm tra vô ích)', async () => {
    const { service, repo, departments } = setup(null)
    await service.create(actor(1, 'super_admin'), {
      email: 'x@misa.com.vn',
      fullName: 'X',
      roleCode: 'viewer',
    } as never)
    expect(departments.exists).not.toHaveBeenCalled()
    expect(repo.save.mock.calls[0][0].departmentId).toBeNull()
  })

  it('tạo thành công: mật khẩu được HASH (không lưu thô) và buộc đổi lần đầu', async () => {
    const { service, repo } = setup(null)
    const { user, generatedPassword } = await service.create(actor(1, 'super_admin'), {
      email: 'Moi@MISA.com.vn',
      fullName: '  Người Mới  ',
      roleCode: 'employee',
    } as never)

    const saved = repo.save.mock.calls[0][0]
    expect(saved.passwordHash).not.toBe(generatedPassword)
    expect(saved.passwordHash.startsWith('$2')).toBe(true)
    expect(saved.mustChangePassword).toBe(true)
    expect(saved.email).toBe('moi@misa.com.vn') // chuẩn hoá thường
    expect(user.fullName).toBe('Người Mới')
  })

  it('mật khẩu tự sinh đủ dài và mỗi lần một khác (dùng randomBytes, không Math.random)', async () => {
    const { service } = setup(null)
    const make = () =>
      service.create(actor(1, 'super_admin'), {
        email: `a${Math.random()}@misa.com.vn`,
        fullName: 'A',
        roleCode: 'employee',
      } as never)
    const a = await make()
    const b = await make()
    expect(a.generatedPassword).toHaveLength(12)
    expect(a.generatedPassword).not.toBe(b.generatedPassword)
  })

  it('PublicUser trả ra API KHÔNG bao giờ chứa password_hash', async () => {
    const { service } = setup(null)
    const { user } = await service.create(actor(1, 'super_admin'), {
      email: 'k@misa.com.vn',
      fullName: 'K',
      roleCode: 'employee',
    } as never)
    expect(Object.keys(user)).not.toContain('passwordHash')
  })
})

describe('UsersService.update — gán lại vai trò / phòng ban (chỉ Cấp 4)', () => {
  it('Cấp 3 cố đổi vai trò người khác → 403', async () => {
    const { service } = setup(target(5, 'employee'))
    await expect(
      service.update(actor(2, 'dept_manager'), 5, { roleCode: 'dept_manager' }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('Cấp 4 nâng Cấp 2 lên Cấp 3 và gán phòng ban', async () => {
    const { service, repo } = setup(target(5, 'employee'))
    const result = await service.update(actor(1, 'super_admin'), 5, { roleCode: 'dept_manager', departmentId: 3 })
    expect(result.roleCode).toBe('dept_manager')
    expect(result.departmentId).toBe(3)
    expect(repo.save).toHaveBeenCalled()
  })

  it('Cấp 4 hạ tài khoản xuống Cấp 1', async () => {
    const { service } = setup(target(5, 'employee', 3))
    const result = await service.update(actor(1, 'super_admin'), 5, { roleCode: 'viewer' })
    expect(result.roleCode).toBe('viewer')
  })

  it('departmentId = null → BỎ gán phòng ban', async () => {
    const { service } = setup(target(5, 'dept_manager', 3))
    const result = await service.update(actor(1, 'super_admin'), 5, { departmentId: null })
    expect(result.departmentId).toBeNull()
  })

  it('thiếu trường departmentId → KHÔNG đổi phòng ban đang có', async () => {
    const { service } = setup(target(5, 'employee', 9))
    const result = await service.update(actor(1, 'super_admin'), 5, { roleCode: 'dept_manager' })
    expect(result.departmentId).toBe(9)
  })

  it('KHÔNG nâng được ai lên Cấp 4 qua API', async () => {
    const { service } = setup(target(5, 'employee'))
    await expect(
      service.update(actor(1, 'super_admin'), 5, { roleCode: 'super_admin' as never }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('Cấp 4 KHÔNG sửa được Cấp 4 khác', async () => {
    const { service } = setup(target(2, 'super_admin'))
    await expect(service.update(actor(1, 'super_admin'), 2, { roleCode: 'viewer' })).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('phòng ban không tồn tại → 400', async () => {
    const { service } = setup(target(5, 'employee'), false)
    await expect(service.update(actor(1, 'super_admin'), 5, { departmentId: 999 })).rejects.toThrow(
      BadRequestException,
    )
  })

  it('người dùng không tồn tại → 404', async () => {
    const { service } = setup(null)
    await expect(service.update(actor(1, 'super_admin'), 404, { roleCode: 'viewer' })).rejects.toThrow(
      NotFoundException,
    )
  })
})

describe('UsersService.setActive / remove — ai quản lý được ai (RBAC 4 cấp)', () => {
  it('không ai được tự khoá chính mình', async () => {
    const { service } = setup(target(1, 'super_admin'))
    await expect(service.setActive(actor(1, 'super_admin'), 1, false)).rejects.toThrow(/chính mình/)
  })

  it('Cấp 4 KHÔNG tác động được Cấp 4 khác', async () => {
    const { service } = setup(target(2, 'super_admin'))
    await expect(service.setActive(actor(1, 'super_admin'), 2, false)).rejects.toThrow(ForbiddenException)
  })

  it('Cấp 4 khoá được Cấp 3', async () => {
    const { service, repo } = setup(target(2, 'dept_manager'))
    const result = await service.setActive(actor(1, 'super_admin'), 2, false)
    expect(result.isActive).toBe(false)
    expect(repo.save).toHaveBeenCalled()
  })

  it('Cấp 4 khoá được Cấp 2 và Cấp 1', async () => {
    const { service: s2 } = setup(target(5, 'employee'))
    await expect(s2.setActive(actor(1, 'super_admin'), 5, false)).resolves.toBeDefined()
    const { service: s1 } = setup(target(6, 'viewer'))
    await expect(s1.setActive(actor(1, 'super_admin'), 6, false)).resolves.toBeDefined()
  })

  it('Cấp 3 KHÔNG khoá được ai (kể cả Cấp 2 cùng phòng ban)', async () => {
    const { service } = setup(target(5, 'employee', 3))
    await expect(service.setActive(actor(2, 'dept_manager'), 5, false)).rejects.toThrow(
      /không có quyền quản lý người dùng/,
    )
  })

  it('Cấp 2 không quản lý được ai', async () => {
    const { service } = setup(target(6, 'employee'))
    await expect(service.remove(actor(5, 'employee'), 6)).rejects.toThrow(ForbiddenException)
  })

  it('Cấp 1 không quản lý được ai', async () => {
    const { service } = setup(target(6, 'employee'))
    await expect(service.remove(actor(5, 'viewer'), 6)).rejects.toThrow(ForbiddenException)
  })

  it('người dùng không tồn tại → 404', async () => {
    const { service } = setup(null)
    await expect(service.remove(actor(1, 'super_admin'), 404)).rejects.toThrow(NotFoundException)
  })

  it('xoá: cùng ma trận quyền như khoá', async () => {
    const { service, repo } = setup(target(7, 'employee'))
    await service.remove(actor(1, 'super_admin'), 7)
    expect(repo.remove).toHaveBeenCalled()
  })
})

describe('UsersService.getDepartmentId / getRoleAndDepartment — nguồn scope quyền', () => {
  it('đọc phòng ban từ DB, không từ token', async () => {
    const { service, repo } = setup(target(5, 'dept_manager', 4))
    await expect(service.getDepartmentId(5)).resolves.toBe(4)
    expect(repo.findOne).toHaveBeenCalled()
  })

  it('người dùng không tồn tại → null (mặc định từ chối, không mặc định cho phép)', async () => {
    const { service } = setup(null)
    await expect(service.getDepartmentId(404)).resolves.toBeNull()
    await expect(service.getRoleAndDepartment(404)).resolves.toBeNull()
  })

  it('trả về đúng cặp vai trò + phòng ban của người tạo phim', async () => {
    const { service } = setup(target(8, 'employee', 2))
    await expect(service.getRoleAndDepartment(8)).resolves.toEqual({ roleCode: 'employee', departmentId: 2 })
  })
})

describe('UsersService.changePassword', () => {
  function setupWithHash(hash: string) {
    const user = { id: 5, passwordHash: hash, mustChangePassword: true } as User
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      }),
      save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
    }
    const departments = { exists: jest.fn().mockResolvedValue(true) }
    return { service: new UsersService(repo as never, departments as never), repo, user }
  }

  it('sai mật khẩu hiện tại → từ chối, KHÔNG ghi mật khẩu mới', async () => {
    const hash = await bcrypt.hash('DungMatKhau@1', 10)
    const { service, repo } = setupWithHash(hash)
    await expect(service.changePassword(5, 'SaiMatKhau@1', 'MatKhauMoi@123')).rejects.toThrow(/không đúng/)
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('đổi thành công: hash mới khác hash cũ và tắt cờ buộc đổi mật khẩu', async () => {
    const hash = await bcrypt.hash('DungMatKhau@1', 10)
    const { service, repo } = setupWithHash(hash)
    await service.changePassword(5, 'DungMatKhau@1', 'MatKhauMoi@123')

    const saved = repo.save.mock.calls[0][0]
    expect(saved.passwordHash).not.toBe(hash)
    expect(await bcrypt.compare('MatKhauMoi@123', saved.passwordHash)).toBe(true)
    expect(saved.mustChangePassword).toBe(false)
  })

  it('mật khẩu mới quá ngắn → từ chối ở tầng service (không chỉ dựa vào DTO)', async () => {
    const hash = await bcrypt.hash('DungMatKhau@1', 10)
    const { service } = setupWithHash(hash)
    await expect(service.changePassword(5, 'DungMatKhau@1', 'ngan')).rejects.toThrow(/tối thiểu 8/)
  })
})
