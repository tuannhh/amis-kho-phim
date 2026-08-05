import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { FilmsService } from './films.service'
import type { StorageService } from '../storage/storage.service'
import type { NotificationsService } from '../notifications/notifications.service'
import type { AuthUser } from '../../common/auth/auth-user'
import type { Film } from './entities/film.entity'

/**
 * "OwnerGuard" của dự án nằm ở `FilmsService.assertCanManage` (ADR-014: kiểm ở tầng service,
 * không tách class guard). Đây là quy tắc nghiệp vụ quan trọng nhất của Kho phim, nay là
 * RBAC 4 CẤP CÓ SCOPE PHÒNG BAN (ADR-040):
 *
 *   Cấp 1 viewer       → không sửa/xoá gì
 *   Cấp 2 employee     → chỉ phim của chính mình
 *   Cấp 3 dept_manager → phim của mình + phim của employee CÙNG phòng ban
 *   Cấp 4 super_admin  → mọi phim
 *
 * Test qua các phương thức public (update/remove/createUploadUrl/saveThumbnail/confirmVersion)
 * — đúng cách người dùng thật chạm tới nó, thay vì gọi thẳng hàm private.
 */

const DEPT_A = 1
const DEPT_B = 2

/** Danh bạ người dùng dùng chung cho mọi ca test (id → vai trò + phòng ban thật trong DB). */
const EMP_A = 10 // Cấp 2, phòng A — chủ sở hữu phim mặc định trong test
const EMP_A2 = 11 // Cấp 2, phòng A
const EMP_B = 30 // Cấp 2, phòng B
const MGR_A = 20 // Cấp 3, phòng A
const MGR_A2 = 21 // Cấp 3, phòng A (trưởng phòng khác, cùng phòng)
const MGR_B = 25 // Cấp 3, phòng B
const SUPER = 40 // Cấp 4
const VIEWER = 50 // Cấp 1

const DIRECTORY: Record<number, { roleCode: AuthUser['roleCode']; departmentId: number | null }> = {
  [EMP_A]: { roleCode: 'employee', departmentId: DEPT_A },
  [EMP_A2]: { roleCode: 'employee', departmentId: DEPT_A },
  [EMP_B]: { roleCode: 'employee', departmentId: DEPT_B },
  [MGR_A]: { roleCode: 'dept_manager', departmentId: DEPT_A },
  [MGR_A2]: { roleCode: 'dept_manager', departmentId: DEPT_A },
  [MGR_B]: { roleCode: 'dept_manager', departmentId: DEPT_B },
  [SUPER]: { roleCode: 'super_admin', departmentId: null },
  [VIEWER]: { roleCode: 'viewer', departmentId: null },
}

const OWNER_ID = EMP_A
const OTHER_ID = EMP_A2

const actor = (id: number, roleCode: AuthUser['roleCode']): AuthUser => ({
  id,
  email: `u${id}@misa.com.vn`,
  roleCode,
})

/** Phim của EMP_A, snapshot phòng ban A — dùng làm phim mặc định cho phần lớn ca test. */
const filmOwnedByOwner = {
  id: 1,
  slug: 'phim-a',
  uploaderId: OWNER_ID,
  departmentId: DEPT_A,
  title: 'Phim A',
} as Film

/** Phim do người có `uploaderId` tạo, snapshot phòng ban `departmentId`. */
const filmBy = (uploaderId: number, departmentId: number | null): Film =>
  ({ id: 1, slug: 'phim-x', uploaderId, departmentId, title: 'Phim X' } as Film)

interface Mocks {
  service: FilmsService
  films: {
    create: jest.Mock
    findOne: jest.Mock
    save: jest.Mock
    remove: jest.Mock
    increment: jest.Mock
    find: jest.Mock
    manager: { transaction: jest.Mock }
    txEntityManager: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; increment: jest.Mock }
  }
  storage: { isAllowedVideoType: jest.Mock; isWithinLimit: jest.Mock; createVideoUploadUrl: jest.Mock; stat: jest.Mock; delete: jest.Mock; putThumbnail: jest.Mock }
  versions: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock }
  users: { getDepartmentId: jest.Mock; getRoleAndDepartment: jest.Mock }
}

function setup(film: Film | null = filmOwnedByOwner): Mocks {
  // `recordView` chạy trong giao dịch có khoá dòng (GĐ7 — sửa race condition, xem
  // films.service.ts). Giả lập `manager.transaction` bằng cách gọi thẳng callback với
  // một EntityManager giả: đủ để kiểm logic nghiệp vụ ở tầng unit test. Tính đúng đắn
  // của phần KHOÁ chỉ chứng minh được dưới tải đồng thời thật — xem
  // `test/concurrency/record-view.concurrency.mjs`.
  const txEntityManager = {
    findOne: jest.fn().mockImplementation((entity: unknown) => {
      const name = (entity as { name?: string })?.name
      // Film → trả phim đang test; FilmView → không có bản ghi trùng.
      return Promise.resolve(name === 'Film' ? film : null)
    }),
    create: jest.fn().mockImplementation((_e: unknown, x: unknown) => x),
    save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
    increment: jest.fn().mockResolvedValue(undefined),
  }
  const films = {
    findOne: jest.fn().mockResolvedValue(film),
    save: jest.fn().mockImplementation((f) => Promise.resolve(f)),
    create: jest.fn().mockImplementation((f) => f),
    remove: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
    manager: {
      transaction: jest.fn().mockImplementation((cb: (em: unknown) => unknown) => cb(txEntityManager)),
    },
    txEntityManager,
  }
  const repo = () => ({
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
    create: jest.fn().mockImplementation((x) => x),
    delete: jest.fn().mockResolvedValue(undefined),
  })
  const versions = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
    create: jest.fn().mockImplementation((x) => x),
  }
  const storage = {
    isAllowedVideoType: jest.fn().mockReturnValue(true),
    isWithinLimit: jest.fn().mockReturnValue(true),
    createVideoUploadUrl: jest.fn().mockResolvedValue({ storageKey: 'video-x.mp4', uploadUrl: 'http://x', expiresIn: 600 }),
    stat: jest.fn().mockResolvedValue({ size: 1024, contentType: 'video/mp4' }),
    delete: jest.fn().mockResolvedValue(undefined),
    putThumbnail: jest.fn().mockResolvedValue('thumb-x.jpg'),
  }
  const notifications = { notify: jest.fn() }
  // UsersService giả lập DANH BẠ THẬT trong DB. Quan trọng: `assertCanManage` phải đọc vai
  // trò/phòng ban từ đây (DB) chứ không từ token — nên test cố tình cho `AuthUser.roleCode`
  // và danh bạ khớp nhau, và có riêng một ca kiểm chứng service thực sự gọi vào danh bạ.
  const users = {
    getDepartmentId: jest.fn().mockImplementation((id: number) =>
      Promise.resolve(DIRECTORY[id]?.departmentId ?? null),
    ),
    getRoleAndDepartment: jest.fn().mockImplementation((id: number) =>
      Promise.resolve(DIRECTORY[id] ?? null),
    ),
  }

  const service = new FilmsService(
    films as never,
    repo() as never,
    repo() as never,
    versions as never,
    repo() as never,
    storage as unknown as StorageService,
    notifications as unknown as NotificationsService,
    users as never,
  )
  return { service, films, storage, versions, users }
}

const dto = { title: 'Phim A sửa', categoryId: 1 }

describe('FilmsService — owner policy (assertCanManage)', () => {
  // ── Cấp 1 (viewer) ────────────────────────────────────────────────────────
  it('CẤP 1 không sửa được phim nào (kể cả nếu là người tạo — lớp phòng thủ sau @Roles)', async () => {
    const { service } = setup(filmBy(VIEWER, null))
    await expect(service.update(actor(VIEWER, 'viewer'), 1, dto as never)).rejects.toThrow(
      /chỉ có quyền xem/,
    )
  })

  it('CẤP 1 không xoá được phim nào', async () => {
    const { service, films } = setup()
    await expect(service.remove(actor(VIEWER, 'viewer'), 1)).rejects.toThrow(ForbiddenException)
    expect(films.remove).not.toHaveBeenCalled()
  })

  // ── Cấp 2 (employee) ──────────────────────────────────────────────────────
  it('CẤP 2 xoá được phim CỦA CHÍNH MÌNH', async () => {
    const { service, films } = setup()
    await service.remove(actor(OWNER_ID, 'employee'), 1)
    expect(films.remove).toHaveBeenCalledWith(filmOwnedByOwner)
  })

  it('CẤP 2 KHÔNG sửa được phim của người khác DÙ CÙNG PHÒNG BAN', async () => {
    const { service } = setup()
    await expect(service.update(actor(OTHER_ID, 'employee'), 1, dto as never)).rejects.toThrow(
      /phim của chính mình/,
    )
  })

  it('CẤP 2 KHÔNG xoá được phim của người khác cùng phòng ban', async () => {
    const { service, films } = setup()
    await expect(service.remove(actor(OTHER_ID, 'employee'), 1)).rejects.toThrow(ForbiddenException)
    expect(films.remove).not.toHaveBeenCalled()
  })

  // ── Cấp 3 (dept_manager) ──────────────────────────────────────────────────
  it('CẤP 3 sửa/xoá được phim của CẤP 2 CÙNG phòng ban', async () => {
    const { service, films } = setup()
    await service.remove(actor(MGR_A, 'dept_manager'), 1)
    expect(films.remove).toHaveBeenCalled()
  })

  it('CẤP 3 KHÔNG sửa được phim của Cấp 2 ở PHÒNG BAN KHÁC', async () => {
    const { service } = setup(filmBy(EMP_B, DEPT_B))
    await expect(service.update(actor(MGR_A, 'dept_manager'), 1, dto as never)).rejects.toThrow(
      /cùng phòng ban/,
    )
  })

  it('CẤP 3 KHÔNG sửa được phim của CẤP 3 KHÁC cùng phòng ban', async () => {
    const { service } = setup(filmBy(MGR_A2, DEPT_A))
    await expect(service.update(actor(MGR_A, 'dept_manager'), 1, dto as never)).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('CẤP 3 KHÔNG sửa được phim của CẤP 4 (dù snapshot phòng ban trùng)', async () => {
    const { service } = setup(filmBy(SUPER, DEPT_A))
    await expect(service.update(actor(MGR_A, 'dept_manager'), 1, dto as never)).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('CẤP 3 sửa được phim CỦA CHÍNH MÌNH (kế thừa quyền Cấp 2)', async () => {
    const { service, films } = setup(filmBy(MGR_A, DEPT_A))
    await service.remove(actor(MGR_A, 'dept_manager'), 1)
    expect(films.remove).toHaveBeenCalled()
  })

  it('phim chưa có phòng ban (department_id NULL) → CẤP 3 KHÔNG quản lý được', async () => {
    const { service } = setup(filmBy(EMP_A, null))
    await expect(service.update(actor(MGR_A, 'dept_manager'), 1, dto as never)).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('CẤP 3 chưa được gán phòng ban → NULL không được coi là "trùng NULL"', async () => {
    const { service, users } = setup(filmBy(EMP_A, null))
    users.getDepartmentId.mockResolvedValue(null)
    await expect(service.update(actor(MGR_A, 'dept_manager'), 1, dto as never)).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('phòng ban của CẤP 3 được đọc từ DB, KHÔNG từ token (chống token cũ giữ quyền cũ)', async () => {
    const { service, users } = setup()
    await service.remove(actor(MGR_A, 'dept_manager'), 1)
    expect(users.getDepartmentId).toHaveBeenCalledWith(MGR_A)
    expect(users.getRoleAndDepartment).toHaveBeenCalledWith(OWNER_ID)
  })

  it('CẤP 3 bị chuyển sang phòng khác trong DB → mất quyền ngay, dù token chưa hết hạn', async () => {
    const { service, users } = setup()
    users.getDepartmentId.mockResolvedValue(DEPT_B) // DB nói: giờ thuộc phòng B
    await expect(service.update(actor(MGR_A, 'dept_manager'), 1, dto as never)).rejects.toThrow(
      ForbiddenException,
    )
  })

  // ── Cấp 4 (super_admin) ───────────────────────────────────────────────────
  it('CẤP 4 xoá được phim của mọi người, mọi phòng ban', async () => {
    for (const f of [filmBy(EMP_A, DEPT_A), filmBy(EMP_B, DEPT_B), filmBy(MGR_B, DEPT_B), filmBy(EMP_A, null)]) {
      const { service, films } = setup(f)
      await service.remove(actor(SUPER, 'super_admin'), 1)
      expect(films.remove).toHaveBeenCalled()
    }
  })

  it('phim không tồn tại → 404 (không lộ thành 403 hay ngược lại)', async () => {
    const { service } = setup(null)
    await expect(service.remove(actor(OWNER_ID, 'employee'), 404)).rejects.toThrow(NotFoundException)
  })

  it('quyền được kiểm TRƯỚC khi cấp presigned upload URL (không rò URL ghi vào storage)', async () => {
    const { service, storage } = setup()
    await expect(
      service.createUploadUrl(actor(OTHER_ID, 'employee'), 1, { contentType: 'video/mp4', size: 100 } as never),
    ).rejects.toThrow(ForbiddenException)
    expect(storage.createVideoUploadUrl).not.toHaveBeenCalled()
  })

  it('quyền được kiểm trước khi nhận ảnh bìa', async () => {
    const { service, storage } = setup()
    await expect(
      service.saveThumbnail(actor(OTHER_ID, 'employee'), 1, Buffer.from('x')),
    ).rejects.toThrow(ForbiddenException)
    expect(storage.putThumbnail).not.toHaveBeenCalled()
  })

  it('quyền được kiểm trước khi xác nhận version mới', async () => {
    const { service, versions } = setup()
    await expect(
      service.confirmVersion(actor(OTHER_ID, 'employee'), 1, { storageKey: 'video-abc.mp4' } as never),
    ).rejects.toThrow(ForbiddenException)
    expect(versions.save).not.toHaveBeenCalled()
  })
})

describe('FilmsService — validate upload ở SERVER (không tin FE)', () => {
  it('từ chối định dạng video không cho phép', async () => {
    const { service, storage } = setup()
    storage.isAllowedVideoType.mockReturnValue(false)
    await expect(
      service.createUploadUrl(actor(OWNER_ID, 'employee'), 1, { contentType: 'application/x-msdownload', size: 10 } as never),
    ).rejects.toThrow(BadRequestException)
  })

  it('từ chối kích thước vượt hạn ngay khi xin URL', async () => {
    const { service, storage } = setup()
    storage.isWithinLimit.mockReturnValue(false)
    await expect(
      service.createUploadUrl(actor(OWNER_ID, 'employee'), 1, { contentType: 'video/mp4', size: 99e9 } as never),
    ).rejects.toThrow(/vượt giới hạn/)
  })

  it('GĐ7: file đã upload vượt hạn (presigned PUT không ràng buộc size) bị từ chối VÀ bị xoá', async () => {
    const { service, storage, versions } = setup()
    storage.stat.mockResolvedValue({ size: 99e9, contentType: 'video/mp4' })
    storage.isWithinLimit.mockReturnValue(false)

    await expect(
      service.confirmVersion(actor(OWNER_ID, 'employee'), 1, { storageKey: 'video-abc.mp4' } as never),
    ).rejects.toThrow(/vượt giới hạn/)

    expect(storage.delete).toHaveBeenCalledWith('video-abc.mp4')
    expect(versions.save).not.toHaveBeenCalled()
  })

  it('key client khai nhưng không có thật trên storage → từ chối', async () => {
    const { service, storage } = setup()
    storage.stat.mockResolvedValue(null)
    await expect(
      service.confirmVersion(actor(OWNER_ID, 'employee'), 1, { storageKey: 'video-bia-dat.mp4' } as never),
    ).rejects.toThrow(/Không tìm thấy file/)
  })

  it('ảnh bìa không phải ảnh thật (magic bytes sai) → từ chối', async () => {
    const { service } = setup()
    await expect(
      service.saveThumbnail(actor(OWNER_ID, 'employee'), 1, Buffer.from('day khong phai anh')),
    ).rejects.toThrow(BadRequestException)
  })

  it('ảnh bìa rỗng → từ chối', async () => {
    const { service } = setup()
    await expect(service.saveThumbnail(actor(OWNER_ID, 'employee'), 1, Buffer.alloc(0))).rejects.toThrow(/rỗng/)
  })
})

describe('FilmsService — đếm lượt xem (ADR-023 + sửa race condition GĐ7)', () => {
  it('tăng view atomic bằng increment, không đọc-rồi-ghi', async () => {
    const { service, films } = setup({ ...filmOwnedByOwner, viewCount: 4 } as Film)
    const result = await service.recordView(actor(OWNER_ID, 'employee'), 1, 'hash')
    expect(films.txEntityManager.increment).toHaveBeenCalledWith(expect.anything(), { id: 1 }, 'viewCount', 1)
    expect(result.viewCount).toBe(5)
  })

  it('toàn bộ luồng chạy TRONG một giao dịch (không phải nhiều câu lệnh rời rạc)', async () => {
    const { service, films } = setup({ ...filmOwnedByOwner, viewCount: 0 } as Film)
    await service.recordView(actor(OWNER_ID, 'employee'), 1, 'hash')
    expect(films.manager.transaction).toHaveBeenCalledTimes(1)
  })

  it('đọc phim bằng KHOÁ GHI (pessimistic_write) — chốt chặn race condition đã đo được', async () => {
    const { service, films } = setup({ ...filmOwnedByOwner, viewCount: 0 } as Film)
    await service.recordView(actor(OWNER_ID, 'employee'), 1, 'hash')

    const filmRead = films.txEntityManager.findOne.mock.calls.find(
      (c: unknown[]) => (c[0] as { name?: string })?.name === 'Film',
    )
    expect(filmRead).toBeDefined()
    expect((filmRead as unknown[])[1]).toMatchObject({ lock: { mode: 'pessimistic_write' } })
  })

  it('phim không tồn tại → 404 ngay trong giao dịch', async () => {
    const { service } = setup(null)
    await expect(service.recordView(actor(OWNER_ID, 'employee'), 404, 'hash')).rejects.toThrow(NotFoundException)
  })

  it('session_hash suy ra từ IP + User-Agent và không lộ nguyên văn', () => {
    const hash = FilmsService.sessionHashOf('10.0.0.1', 'Mozilla/5.0')
    expect(hash).toHaveLength(64)
    expect(hash).not.toContain('10.0.0.1')
    expect(FilmsService.sessionHashOf('10.0.0.1', 'Mozilla/5.0')).toBe(hash)
    expect(FilmsService.sessionHashOf('10.0.0.2', 'Mozilla/5.0')).not.toBe(hash)
  })
})

describe('FilmsService.create — snapshot phòng ban của người tạo (ADR-042)', () => {
  /**
   * `uniqueSlug` lặp tới khi tìm được slug chưa dùng, nên lần `findOne` ĐẦU phải trả null
   * (slug còn trống); các lần sau trả phim để `getBySlug` cuối hàm có dữ liệu.
   */
  function setupForCreate() {
    const m = setup()
    m.films.findOne.mockReset()
    m.films.findOne.mockResolvedValueOnce(null).mockResolvedValue(filmOwnedByOwner)
    return m
  }

  it('department_id lấy từ DB của người tạo, KHÔNG nhận từ DTO client gửi', async () => {
    const { service, films, users } = setupForCreate()
    // Client cố khai một phòng ban khác để chiếm scope quyền — phải bị bỏ qua hoàn toàn.
    await service.create(actor(EMP_B, 'employee'), {
      title: 'Phim mới',
      categoryId: 1,
      departmentId: DEPT_A,
    } as never)

    expect(users.getDepartmentId).toHaveBeenCalledWith(EMP_B)
    expect(films.save.mock.calls[0][0].departmentId).toBe(DEPT_B)
  })

  it('người tạo chưa có phòng ban → department_id = null (không bịa giá trị)', async () => {
    const { service, films } = setupForCreate()
    await service.create(actor(SUPER, 'super_admin'), { title: 'Phim mới', categoryId: 1 } as never)
    expect(films.save.mock.calls[0][0].departmentId).toBeNull()
  })
})
