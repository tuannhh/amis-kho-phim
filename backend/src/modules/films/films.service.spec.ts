import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { FilmsService } from './films.service'
import type { StorageService } from '../storage/storage.service'
import type { NotificationsService } from '../notifications/notifications.service'
import type { AuthUser } from '../../common/auth/auth-user'
import type { Film } from './entities/film.entity'

/**
 * GĐ7 — "OwnerGuard" của dự án nằm ở `FilmsService.assertCanManage` (ADR-014: kiểm ở tầng
 * service, không tách class guard). Đây là quy tắc nghiệp vụ quan trọng nhất của Kho phim:
 * NHÂN VIÊN CHỈ ĐƯỢC SỬA/XOÁ PHIM CỦA CHÍNH MÌNH. Test qua các phương thức public
 * (update/remove/createUploadUrl/saveThumbnail/confirmVersion) — đúng cách người dùng thật
 * chạm tới nó, thay vì gọi thẳng hàm private.
 */

const OWNER_ID = 10
const OTHER_ID = 99

const actor = (id: number, roleCode: AuthUser['roleCode']): AuthUser => ({
  id,
  email: `u${id}@misa.com.vn`,
  roleCode,
})

const filmOwnedByOwner = { id: 1, slug: 'phim-a', uploaderId: OWNER_ID, title: 'Phim A' } as Film

interface Mocks {
  service: FilmsService
  films: {
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

  const service = new FilmsService(
    films as never,
    repo() as never,
    repo() as never,
    versions as never,
    repo() as never,
    storage as unknown as StorageService,
    notifications as unknown as NotificationsService,
  )
  return { service, films, storage, versions }
}

const dto = { title: 'Phim A sửa', categoryId: 1 }

describe('FilmsService — owner policy (assertCanManage)', () => {
  it('nhân viên KHÔNG sửa được phim của người khác', async () => {
    const { service } = setup()
    await expect(service.update(actor(OTHER_ID, 'employee'), 1, dto as never)).rejects.toThrow(ForbiddenException)
  })

  it('nhân viên KHÔNG xoá được phim của người khác', async () => {
    const { service, films } = setup()
    await expect(service.remove(actor(OTHER_ID, 'employee'), 1)).rejects.toThrow(ForbiddenException)
    expect(films.remove).not.toHaveBeenCalled()
  })

  it('nhân viên xoá được phim CỦA CHÍNH MÌNH', async () => {
    const { service, films } = setup()
    await service.remove(actor(OWNER_ID, 'employee'), 1)
    expect(films.remove).toHaveBeenCalledWith(filmOwnedByOwner)
  })

  it('admin xoá được phim của người khác', async () => {
    const { service, films } = setup()
    await service.remove(actor(OTHER_ID, 'admin'), 1)
    expect(films.remove).toHaveBeenCalled()
  })

  it('super_admin xoá được phim của người khác', async () => {
    const { service, films } = setup()
    await service.remove(actor(OTHER_ID, 'super_admin'), 1)
    expect(films.remove).toHaveBeenCalled()
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
