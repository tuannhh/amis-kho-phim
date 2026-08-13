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

/** Key ảnh bìa hợp lệ về ĐỊNH DẠNG (khớp regex DTO) — nội dung file mới là thứ được kiểm thật. */
const THUMB_KEY = 'thumb-00000000-0000-0000-0000-000000000000.png'

/**
 * Dựng 33 byte đầu của một file PNG hợp lệ (chữ ký 8 byte + chunk IHDR mang width/height).
 * Parser header chỉ cần chừng này để đọc kích thước — đúng bản chất tối ưu của ADR-055: server
 * chỉ tải 64KB đầu từ MinIO thay vì cả file. Dùng buffer thật thay vì mock để test đúng parser.
 */
function pngHeader(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0)
  buf.writeUInt32BE(13, 8)
  buf.write('IHDR', 12, 'ascii')
  buf.writeUInt32BE(width, 16)
  buf.writeUInt32BE(height, 20)
  buf.writeUInt8(8, 24) // bit depth
  buf.writeUInt8(6, 25) // color type RGBA
  return buf
}

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
    txEntityManager: {
      findOne: jest.Mock
      find: jest.Mock
      create: jest.Mock
      save: jest.Mock
      increment: jest.Mock
      delete: jest.Mock
      update: jest.Mock
    }
  }
  storage: {
    isAllowedVideoType: jest.Mock
    isAllowedImageType: jest.Mock
    isWithinLimit: jest.Mock
    createVideoUploadUrl: jest.Mock
    createThumbnailUploadUrl: jest.Mock
    stat: jest.Mock
    delete: jest.Mock
    readHeadBytes: jest.Mock
  }
  versions: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock }
  users: { getDepartmentId: jest.Mock; getRoleAndDepartment: jest.Mock }
  uploadIntents: { record: jest.Mock; claimForVersion: jest.Mock }
  filmUrlSlugs: {
    assignCurrent: jest.Mock
    findCurrent: jest.Mock
    findCurrentMap: jest.Mock
    findByPath: jest.Mock
  }
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
      // Film → trả phim đang test; FilmView/FilmVersion → không có bản ghi trùng/bản trước.
      return Promise.resolve(name === 'Film' ? film : null)
    }),
    // Hashtag lookup trong `findOrCreateHashtags` khi chạy trong transaction (create/update).
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((_e: unknown, x: unknown) => x),
    save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
    increment: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
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
    isAllowedImageType: jest.fn().mockReturnValue(true),
    createThumbnailUploadUrl: jest
      .fn()
      .mockResolvedValue({ thumbnailKey: 'thumb-x.jpg', uploadUrl: 'http://x', expiresIn: 600 }),
    // Mặc định: 64KB đầu đọc được nhưng KHÔNG phải ảnh thật → ca test nào cần ảnh hợp lệ
    // phải tự nạp buffer PNG 16:9 (xem `png16x9`), giống hệt cách server gặp file thật.
    readHeadBytes: jest.fn().mockResolvedValue(Buffer.from('day khong phai anh')),
  }
  const notifications = { notify: jest.fn() }
  // Upload intent phải được claim atomically trong transaction trước khi tạo version.
  const uploadIntents = { record: jest.fn().mockResolvedValue(undefined), claimForVersion: jest.fn().mockResolvedValue(undefined) }
  // URL công khai (2026-08-13) — không kiểm logic sinh path thật ở đây (đã có
  // `film-url-slugs.service.spec.ts` riêng), chỉ cần không throw khi create/update/confirmVersion gọi tới.
  const filmUrlSlugs = {
    assignCurrent: jest.fn().mockResolvedValue(undefined),
    findCurrent: jest.fn().mockResolvedValue(undefined),
    findCurrentMap: jest.fn().mockResolvedValue(new Map()),
    findByPath: jest.fn().mockResolvedValue(null),
  }
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
    repo() as never, // categories — chỉ cần đọc slug, không có ca test riêng ở đây
    storage as unknown as StorageService,
    notifications as unknown as NotificationsService,
    users as never,
    uploadIntents as never,
    filmUrlSlugs as never,
  )
  return { service, films, storage, versions, users, uploadIntents, filmUrlSlugs }
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

  it('quyền được kiểm TRƯỚC khi cấp presigned URL cho ảnh bìa', async () => {
    const { service, storage } = setup()
    await expect(
      service.createThumbnailUploadUrl(actor(OTHER_ID, 'employee'), 1, {
        contentType: 'image/png',
        size: 1024,
      } as never),
    ).rejects.toThrow(ForbiddenException)
    expect(storage.createThumbnailUploadUrl).not.toHaveBeenCalled()
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

  it('từ chối content-type ảnh bìa không cho phép ngay khi xin URL', async () => {
    const { service, storage } = setup()
    storage.isAllowedImageType.mockReturnValue(false)
    await expect(
      service.createThumbnailUploadUrl(actor(OWNER_ID, 'employee'), 1, {
        contentType: 'application/pdf',
        size: 1024,
      } as never),
    ).rejects.toThrow(BadRequestException)
    expect(storage.createThumbnailUploadUrl).not.toHaveBeenCalled()
  })

  // ── Ảnh bìa nay upload thẳng lên MinIO (ADR-055) nên MỌI kiểm tra dồn về confirmVersion.
  // Đây là chốt chặn duy nhất còn lại — nhóm ca test dưới đây canh đúng chỗ đó.

  it('ảnh bìa không phải ảnh thật (magic bytes sai) → từ chối VÀ xoá khỏi storage', async () => {
    const { service, storage, versions } = setup()
    storage.stat.mockResolvedValue({ size: 1024, contentType: 'image/png' })
    await expect(
      service.confirmVersion(actor(OWNER_ID, 'employee'), 1, { thumbnailKey: THUMB_KEY } as never),
    ).rejects.toThrow(BadRequestException)
    expect(storage.delete).toHaveBeenCalledWith(THUMB_KEY)
    expect(versions.save).not.toHaveBeenCalled()
  })

  it('ảnh bìa rỗng → từ chối', async () => {
    const { service, storage } = setup()
    storage.stat.mockResolvedValue({ size: 0, contentType: 'image/png' })
    storage.readHeadBytes.mockResolvedValue(Buffer.alloc(0))
    await expect(
      service.confirmVersion(actor(OWNER_ID, 'employee'), 1, { thumbnailKey: THUMB_KEY } as never),
    ).rejects.toThrow(/rỗng/)
  })

  it('ảnh bìa vượt 15MB (presigned PUT không ràng buộc size) → từ chối VÀ xoá', async () => {
    const { service, storage } = setup()
    storage.stat.mockResolvedValue({ size: 20 * 1024 * 1024, contentType: 'image/png' })
    await expect(
      service.confirmVersion(actor(OWNER_ID, 'employee'), 1, { thumbnailKey: THUMB_KEY } as never),
    ).rejects.toThrow(/15MB/)
    expect(storage.delete).toHaveBeenCalledWith(THUMB_KEY)
  })

  it('ảnh bìa đúng ảnh thật nhưng SAI tỷ lệ 16:9 → từ chối VÀ xoá', async () => {
    const { service, storage } = setup()
    storage.stat.mockResolvedValue({ size: 1024, contentType: 'image/png' })
    storage.readHeadBytes.mockResolvedValue(pngHeader(400, 400)) // vuông, không phải 16:9
    await expect(
      service.confirmVersion(actor(OWNER_ID, 'employee'), 1, { thumbnailKey: THUMB_KEY } as never),
    ).rejects.toThrow(/16:9/)
    expect(storage.delete).toHaveBeenCalledWith(THUMB_KEY)
  })

  it('ảnh bìa PNG đúng 16:9 → chấp nhận, tạo version mới', async () => {
    const { service, films, storage } = setup()
    storage.stat.mockResolvedValue({ size: 1024, contentType: 'image/png' })
    storage.readHeadBytes.mockResolvedValue(pngHeader(1280, 720))
    await service.confirmVersion(actor(OWNER_ID, 'employee'), 1, { thumbnailKey: THUMB_KEY } as never)
    expect(storage.delete).not.toHaveBeenCalled()
    // Tier A retrofit (2026-08-12): confirmVersion nay ghi film_versions TRONG transaction
    // (khoá dòng phim), qua `em.save`, không còn gọi trực tiếp repository `versions.save`.
    expect(films.txEntityManager.save).toHaveBeenCalled()
  })
})

// Tier A retrofit (2026-08-12, Production Compatibility Gate) — presigned URL đã ký phải có
// chủ (actor/film/loại/hạn) và phải được đánh dấu consumed khi dùng thật, để `sweepExpired`
// dọn đúng object mồ côi mà không đụng tới upload đang/đã dùng hợp lệ.
describe('FilmsService — upload-intent ownership (Tier A retrofit 2026-08-12)', () => {
  it('ký URL video → ghi ownership (actor/film/loại/hạn), KHÔNG để lộ key không có chủ', async () => {
    const { service, uploadIntents } = setup()
    const result = await service.createUploadUrl(actor(OWNER_ID, 'employee'), 1, {
      contentType: 'video/mp4',
      size: 100,
    } as never)
    expect(uploadIntents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'video',
        storageKey: result.storageKey,
        filmId: 1,
        actorId: OWNER_ID,
        expiresInSec: result.expiresIn,
      }),
    )
  })

  it('ký URL ảnh bìa → ghi ownership tương tự video', async () => {
    const { service, uploadIntents } = setup()
    const result = await service.createThumbnailUploadUrl(actor(OWNER_ID, 'employee'), 1, {
      contentType: 'image/png',
      size: 1024,
    } as never)
    expect(uploadIntents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'thumbnail',
        storageKey: result.thumbnailKey,
        filmId: 1,
        actorId: OWNER_ID,
      }),
    )
  })

  it('confirmVersion claim atomically đúng key/chủ/phim/loại trước khi tạo version', async () => {
    const { service, films, storage, uploadIntents } = setup()
    storage.stat.mockResolvedValue({ size: 1024, contentType: 'image/png' })
    storage.readHeadBytes.mockResolvedValue(pngHeader(1280, 720))
    await service.confirmVersion(actor(OWNER_ID, 'employee'), 1, {
      thumbnailKey: THUMB_KEY,
    } as never)
    expect(uploadIntents.claimForVersion).toHaveBeenCalledWith(
      { storageKey: THUMB_KEY, kind: 'thumbnail', filmId: 1, actorId: OWNER_ID },
      expect.anything(),
    )
    expect(uploadIntents.claimForVersion).toHaveBeenCalledTimes(1)
    const claimCall = uploadIntents.claimForVersion.mock.invocationCallOrder[0]
    const versionSaveCall = films.txEntityManager.save.mock.invocationCallOrder.find(
      (order) => order > claimCall,
    )
    expect(versionSaveCall).toBeDefined()
  })

  it('không tạo version khi key không thuộc actor/phim hoặc đã hết hạn', async () => {
    const { service, storage, films, uploadIntents } = setup()
    storage.stat.mockResolvedValue({ size: 1024, contentType: 'image/png' })
    storage.readHeadBytes.mockResolvedValue(pngHeader(1280, 720))
    uploadIntents.claimForVersion.mockRejectedValue(new BadRequestException('Upload không hợp lệ'))
    await expect(
      service.confirmVersion(actor(OWNER_ID, 'employee'), 1, { thumbnailKey: THUMB_KEY } as never),
    ).rejects.toThrow('Upload không hợp lệ')
    expect(films.txEntityManager.save).not.toHaveBeenCalled()
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
    // Tier A retrofit (2026-08-12): create() nay ghi phim TRONG transaction qua `em.save`,
    // không còn gọi trực tiếp repository `films.save` (xem ghi chú ở films.service.ts#create).
    expect(films.txEntityManager.save.mock.calls[0][0].departmentId).toBe(DEPT_B)
  })

  it('người tạo chưa có phòng ban → department_id = null (không bịa giá trị)', async () => {
    const { service, films } = setupForCreate()
    await service.create(actor(SUPER, 'super_admin'), { title: 'Phim mới', categoryId: 1 } as never)
    expect(films.txEntityManager.save.mock.calls[0][0].departmentId).toBeNull()
  })
})

describe('FilmsService — nhãn "Phim mới" khi TRÙNG TIÊU ĐỀ (ADR-052, đợt 2 việc 9)', () => {
  /** Ngày cách hôm nay `n` ngày, dạng 'YYYY-MM-DD' đúng như cột `published_at` (kiểu DATE). */
  const daysAgo = (n: number): string =>
    new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

  /** Phim tối thiểu đủ để `toPublic` chạy — chỉ quan tâm tiêu đề + ngày đăng + id. */
  const row = (id: number, title: string, publishedAt: string): Film =>
    ({
      id,
      slug: `phim-${id}`,
      title,
      publishedAt,
      uploaderId: EMP_A,
      departmentId: DEPT_A,
      viewCount: 0,
      downloadCount: 0,
      duration: '--:--',
    } as Film)

  /**
   * `list()` tin vào thứ tự do SQL trả về ("mới trước"), nên test cũng phải nạp dữ liệu ĐÚNG
   * thứ tự đó — nếu không, test sẽ nghiệm thu một hành vi mà production không có.
   */
  function listWith(rows: Film[]) {
    const { service, films } = setup()
    films.find.mockResolvedValue(rows)
    return service.list()
  }

  it('hai phim TRÙNG TÊN: chỉ phim mới nhất giữ nhãn, phim cũ MẤT nhãn dù còn trong hạn', async () => {
    const result = await listWith([
      row(2, 'Giới thiệu MISA', daysAgo(1)), // đăng sau
      row(1, 'Giới thiệu MISA', daysAgo(3)), // đăng trước, vẫn còn trong hạn 14 ngày
    ])
    expect(result.find((f) => f.id === 2)!.isNew).toBe(true)
    expect(result.find((f) => f.id === 1)!.isNew).toBe(false)
  })

  it('so tiêu đề KHÔNG phân biệt hoa/thường và bỏ khoảng trắng thừa', async () => {
    const result = await listWith([
      row(2, '  giới thiệu MISA  ', daysAgo(1)),
      row(1, 'Giới Thiệu Misa', daysAgo(3)),
    ])
    expect(result.find((f) => f.id === 1)!.isNew).toBe(false)
  })

  it('ba phim trùng tên: chỉ MỘT phim giữ nhãn, hai phim còn lại mất', async () => {
    const result = await listWith([
      row(3, 'Phim lặp', daysAgo(0)),
      row(2, 'Phim lặp', daysAgo(1)),
      row(1, 'Phim lặp', daysAgo(2)),
    ])
    expect(result.filter((f) => f.isNew).map((f) => f.id)).toEqual([3])
  })

  it('phim KHÔNG trùng tên vẫn theo quy tắc thời gian cũ (còn hạn → mới, quá hạn → cũ)', async () => {
    const result = await listWith([
      row(2, 'Phim A', daysAgo(2)),
      row(1, 'Phim B', daysAgo(90)),
    ])
    expect(result.find((f) => f.id === 2)!.isNew).toBe(true)
    expect(result.find((f) => f.id === 1)!.isNew).toBe(false)
  })

  it('phim mới nhất của nhóm nhưng ĐÃ QUÁ HẠN → vẫn không có nhãn (hai điều kiện phải cùng đúng)', async () => {
    const result = await listWith([
      row(2, 'Phim cũ', daysAgo(60)),
      row(1, 'Phim cũ', daysAgo(90)),
    ])
    expect(result.every((f) => f.isNew === false)).toBe(true)
  })

  it('trang CHI TIẾT cũng đúng: phim cũ trùng tên mở riêng ra vẫn không có nhãn', async () => {
    const older = row(1, 'Phim lặp', daysAgo(2))
    const newer = row(2, 'Phim lặp', daysAgo(0))
    const { service, films } = setup()
    // findOne lần 1 = phim đang mở; lần 2 = phim mới nhất cùng tiêu đề (isLatestOfTitle)
    films.findOne.mockResolvedValueOnce(older).mockResolvedValueOnce(newer)
    const result = await service.getBySlug('phim-1')
    expect(result.isNew).toBe(false)
  })

  it('trang CHI TIẾT của chính phim mới nhất → có nhãn', async () => {
    const newer = row(2, 'Phim lặp', daysAgo(0))
    const { service, films } = setup()
    films.findOne.mockResolvedValueOnce(newer).mockResolvedValueOnce(newer)
    const result = await service.getBySlug('phim-2')
    expect(result.isNew).toBe(true)
  })
})

describe('FilmsService — đếm lượt tải về (ADR-054, đợt 2 việc 8)', () => {
  it('tăng download_count atomic bằng increment, không đọc-rồi-ghi', async () => {
    const { service, films } = setup({ ...filmOwnedByOwner, downloadCount: 7 } as Film)
    const result = await service.recordDownload(actor(OWNER_ID, 'employee'), 1)
    expect(films.increment).toHaveBeenCalledWith({ id: 1 }, 'downloadCount', 1)
    expect(result.downloadCount).toBe(8)
  })

  it('KHÔNG dedupe: gọi ba lần liên tiếp là ba lượt (khác hẳn recordView)', async () => {
    const { service, films } = setup({ ...filmOwnedByOwner, downloadCount: 0 } as Film)
    await service.recordDownload(actor(OWNER_ID, 'employee'), 1)
    await service.recordDownload(actor(OWNER_ID, 'employee'), 1)
    await service.recordDownload(actor(OWNER_ID, 'employee'), 1)
    expect(films.increment).toHaveBeenCalledTimes(3)
  })

  it('Cấp 1 (viewer) VẪN tải được — tải phim không phải quyền ghi', async () => {
    const { service, films } = setup({ ...filmOwnedByOwner, downloadCount: 0 } as Film)
    await expect(service.recordDownload(actor(VIEWER, 'viewer'), 1)).resolves.toEqual({
      downloadCount: 1,
    })
    expect(films.increment).toHaveBeenCalled()
  })

  it('phim không tồn tại → 404, không tăng đếm', async () => {
    const { service, films } = setup(null)
    await expect(service.recordDownload(actor(OWNER_ID, 'employee'), 404)).rejects.toThrow(
      NotFoundException,
    )
    expect(films.increment).not.toHaveBeenCalled()
  })
})

/**
 * Đợt 2 việc 6 — "Phim tôi quản lý". Yêu cầu quan trọng nhất: tập phim trả về phải TRÙNG KHỚP
 * với tập phim `assertCanManage` cho phép sửa/xoá. Rộng hơn thì người dùng thấy phim rồi bấm
 * Sửa nhận 403; hẹp hơn thì mất phim đáng lẽ quản được.
 */
describe('FilmsService.listManaged — phạm vi "Phim tôi quản lý" (đợt 2 việc 6)', () => {
  const managedRow = (id: number, uploaderId: number, departmentId: number | null): Film =>
    ({
      id,
      slug: `phim-${id}`,
      title: `Phim ${id}`,
      publishedAt: '2026-08-01',
      uploaderId,
      departmentId,
      viewCount: 0,
      downloadCount: 0,
      duration: '--:--',
      uploader: { fullName: 'X', roleCode: DIRECTORY[uploaderId]?.roleCode },
    }) as never

  /** Một kho phim đủ mọi tổ hợp người tạo × phòng ban để bắt lỗi lọc quá rộng. */
  const ALL_FILMS = [
    managedRow(1, EMP_A, DEPT_A), // Cấp 2 phòng A
    managedRow(2, EMP_A2, DEPT_A), // Cấp 2 phòng A (người khác)
    managedRow(3, EMP_B, DEPT_B), // Cấp 2 phòng B
    managedRow(4, MGR_A, DEPT_A), // Cấp 3 phòng A
    managedRow(5, MGR_A2, DEPT_A), // Cấp 3 phòng A (trưởng phòng khác)
    managedRow(6, SUPER, null), // Cấp 4
    managedRow(7, EMP_A, null), // phim cũ chưa có phòng ban
  ]

  function managed(actorId: number, roleCode: AuthUser['roleCode']) {
    const { service, films } = setup()
    films.find.mockResolvedValue(ALL_FILMS)
    return service.listManaged(actor(actorId, roleCode)).then((r) => r.map((f) => f.id).sort())
  }

  it('Cấp 1 (viewer) → danh sách RỖNG', async () => {
    expect(await managed(VIEWER, 'viewer')).toEqual([])
  })

  it('Cấp 2 → chỉ phim của chính mình, kể cả phim chưa có phòng ban', async () => {
    expect(await managed(EMP_A, 'employee')).toEqual([1, 7])
  })

  it('Cấp 2 KHÔNG thấy phim của đồng nghiệp cùng phòng', async () => {
    expect(await managed(EMP_A, 'employee')).not.toContain(2)
  })

  it('Cấp 3 → phim của mình + phim của Cấp 2 CÙNG phòng ban', async () => {
    // 4 = của chính mình; 1 và 2 = của Cấp 2 phòng A. KHÔNG có 5 (Cấp 3 khác), 3 (phòng B),
    // 6 (Cấp 4), 7 (department_id NULL).
    expect(await managed(MGR_A, 'dept_manager')).toEqual([1, 2, 4])
  })

  it('Cấp 3 KHÔNG thấy phim phòng ban khác', async () => {
    expect(await managed(MGR_A, 'dept_manager')).not.toContain(3)
  })

  it('Cấp 3 KHÔNG vơ hết phim cũ có department_id NULL', async () => {
    expect(await managed(MGR_A, 'dept_manager')).not.toContain(7)
  })

  it('Cấp 4 → toàn bộ kho phim', async () => {
    expect(await managed(SUPER, 'super_admin')).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('nhãn "Phim mới" tính trên TOÀN KHO, không tính lại trong phạm vi đã lọc', async () => {
    // Hai phim trùng tên: một của Cấp 2 phòng A (thấy được), một của phòng B (không thấy) và
    // mới hơn. Phim thấy được PHẢI mất nhãn dù bản mới hơn nằm ngoài danh sách này.
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const mine = { ...managedRow(1, EMP_A, DEPT_A), title: 'Trùng tên', publishedAt: yesterday }
    const theirs = { ...managedRow(2, EMP_B, DEPT_B), title: 'Trùng tên', publishedAt: today }

    const { service, films } = setup()
    films.find.mockResolvedValue([theirs, mine]) // đúng thứ tự "mới trước" như SQL trả về
    const result = await service.listManaged(actor(EMP_A, 'employee'))

    expect(result.map((f) => f.id)).toEqual([1])
    expect(result[0].isNew).toBe(false)
  })
})
