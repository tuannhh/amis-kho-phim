import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { UsersService, creatableRoles } from './users.service'
import type { AuthUser } from '../../common/auth/auth-user'
import type { RoleCode } from './entities/role.entity'
import type { User } from './entities/user.entity'

/**
 * GĐ7 — ma trận quản trị người dùng (01-architecture.md §5). Sai ở đây nghĩa là
 * admin tự nâng quyền hoặc khoá được cả super_admin.
 */

const actor = (id: number, roleCode: RoleCode): AuthUser => ({ id, email: `u${id}@misa.com.vn`, roleCode })

const target = (id: number, roleCode: RoleCode): User =>
  ({ id, email: `t${id}@misa.com.vn`, fullName: 'T', roleCode, isActive: true } as User)

function setup(found: User | null) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(found),
    save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
    remove: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((u) => u),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(),
  }
  return { service: new UsersService(repo as never), repo }
}

describe('creatableRoles — ai tạo được vai trò nào', () => {
  it('super_admin tạo được admin và nhân viên, KHÔNG tạo được super_admin khác', () => {
    expect(creatableRoles('super_admin')).toEqual(['admin', 'employee'])
  })
  it('admin CHỈ tạo được nhân viên', () => {
    expect(creatableRoles('admin')).toEqual(['employee'])
  })
  it('nhân viên không tạo được ai', () => {
    expect(creatableRoles('employee')).toEqual([])
  })
})

describe('UsersService.create', () => {
  it('admin cố tạo tài khoản admin khác → 403 (dù FE có gửi payload gì)', async () => {
    const { service } = setup(null)
    await expect(
      service.create(actor(2, 'admin'), { email: 'x@misa.com.vn', fullName: 'X', roleCode: 'admin' } as never),
    ).rejects.toThrow(ForbiddenException)
  })

  it('nhân viên cố tạo tài khoản → 403', async () => {
    const { service } = setup(null)
    await expect(
      service.create(actor(3, 'employee'), { email: 'x@misa.com.vn', fullName: 'X', roleCode: 'employee' } as never),
    ).rejects.toThrow(ForbiddenException)
  })

  it('email trùng → 409', async () => {
    const { service } = setup(target(9, 'employee'))
    await expect(
      service.create(actor(1, 'super_admin'), { email: 't9@misa.com.vn', fullName: 'X', roleCode: 'employee' } as never),
    ).rejects.toThrow(ConflictException)
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

describe('UsersService.setActive / remove — ai quản lý được ai', () => {
  it('không ai được tự khoá chính mình', async () => {
    const { service } = setup(target(1, 'super_admin'))
    await expect(service.setActive(actor(1, 'super_admin'), 1, false)).rejects.toThrow(/chính mình/)
  })

  it('super_admin KHÔNG tác động được super_admin khác', async () => {
    const { service } = setup(target(2, 'super_admin'))
    await expect(service.setActive(actor(1, 'super_admin'), 2, false)).rejects.toThrow(ForbiddenException)
  })

  it('super_admin khoá được admin', async () => {
    const { service, repo } = setup(target(2, 'admin'))
    const result = await service.setActive(actor(1, 'super_admin'), 2, false)
    expect(result.isActive).toBe(false)
    expect(repo.save).toHaveBeenCalled()
  })

  it('admin KHÔNG khoá được admin khác (chỉ quản lý nhân viên)', async () => {
    const { service } = setup(target(3, 'admin'))
    await expect(service.setActive(actor(2, 'admin'), 3, false)).rejects.toThrow(/chỉ quản lý được/)
  })

  it('admin KHÔNG khoá được super_admin', async () => {
    const { service } = setup(target(1, 'super_admin'))
    await expect(service.setActive(actor(2, 'admin'), 1, false)).rejects.toThrow(ForbiddenException)
  })

  it('admin khoá được nhân viên', async () => {
    const { service } = setup(target(5, 'employee'))
    await expect(service.setActive(actor(2, 'admin'), 5, false)).resolves.toBeDefined()
  })

  it('nhân viên không quản lý được ai', async () => {
    const { service } = setup(target(6, 'employee'))
    await expect(service.remove(actor(5, 'employee'), 6)).rejects.toThrow(ForbiddenException)
  })

  it('người dùng không tồn tại → 404', async () => {
    const { service } = setup(null)
    await expect(service.remove(actor(1, 'super_admin'), 404)).rejects.toThrow(NotFoundException)
  })

  it('xoá: cùng ma trận quyền như khoá (nhân viên bị admin xoá được)', async () => {
    const { service, repo } = setup(target(7, 'employee'))
    await service.remove(actor(2, 'admin'), 7)
    expect(repo.remove).toHaveBeenCalled()
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
    return { service: new UsersService(repo as never), repo, user }
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
