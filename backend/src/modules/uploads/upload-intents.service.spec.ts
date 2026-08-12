import { BadRequestException } from '@nestjs/common'
import { UploadIntentsService } from './upload-intents.service'
import { UploadIntent } from './entities/upload-intent.entity'

const originalMultiReplica = process.env.MULTI_REPLICA

/**
 * Tier A retrofit (2026-08-12, Production Compatibility Gate) — `UploadIntentsService` là
 * chỗ duy nhất biết "ai xin ký URL cho key nào, cho phim nào, hạn tới đâu". Ba hành vi quan
 * trọng nhất kiểm ở đây:
 *  1. `record()` ghi đủ actor/film/loại/hạn — thiếu 1 trong 4 là mất khả năng truy vết chủ.
 *  2. `claimForVersion()` atomically chốt đúng owner/phim/loại/hạn trong transaction tạo version.
 *  3. `sweepExpired()` chỉ đụng vào intent THẬT SỰ quá hạn còn `pending`, xoá object + đánh
 *     dấu `expired` — không đụng intent đã `consumed` (repo mock trả đúng tập `find` giả lập
 *     câu `WHERE status='pending' AND expires_at < now`, nên test không lặp lại logic đó,
 *     chỉ kiểm phần xử lý kết quả).
 */

function setup() {
  const intents = {
    create: jest.fn().mockImplementation((x: unknown) => x),
    save: jest.fn().mockImplementation((x: unknown) => Promise.resolve(x)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    find: jest.fn().mockResolvedValue([]),
  }
  const storage = { delete: jest.fn().mockResolvedValue(undefined) }
  const service = new UploadIntentsService(intents as never, storage as never)
  return { service, intents, storage }
}

const staleIntent = (over: Partial<UploadIntent> = {}): UploadIntent =>
  ({
    id: 1,
    storageKey: 'video-rac.mp4',
    kind: 'video',
    filmId: 1,
    actorId: 1,
    status: 'pending',
    expiresAt: new Date(Date.now() - 1000),
    consumedAt: null,
    createdAt: new Date(),
    ...over,
  }) as UploadIntent

beforeEach(() => {
  // `lastSweepAt` là static dùng chung giữa mọi instance để throttle sweep cơ hội — reset
  // giữa các test để không ca này ảnh hưởng ca kia (xem ghi chú throttle trong service).
  ;(UploadIntentsService as unknown as { lastSweepAt: number }).lastSweepAt = 0
})

afterEach(() => {
  if (originalMultiReplica === undefined) delete process.env.MULTI_REPLICA
  else process.env.MULTI_REPLICA = originalMultiReplica
})

describe('UploadIntentsService.record', () => {
  it('ghi đủ actor/film/loại/hạn, trạng thái pending, chưa consume', async () => {
    const { service, intents } = setup()
    await service.record({
      kind: 'video',
      storageKey: 'video-a.mp4',
      filmId: 7,
      actorId: 3,
      expiresInSec: 600,
    })
    expect(intents.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'video',
        storageKey: 'video-a.mp4',
        filmId: 7,
        actorId: 3,
        status: 'pending',
        consumedAt: null,
      }),
    )
  })

  it('expiresAt tính từ expiresInSec (khớp hạn thật của presigned URL đã ký)', async () => {
    const { service, intents } = setup()
    const before = Date.now()
    await service.record({ kind: 'thumbnail', storageKey: 'thumb-a.jpg', filmId: 1, actorId: 1, expiresInSec: 600 })
    const saved = intents.save.mock.calls[0][0] as UploadIntent
    // Khoảng chấp nhận rộng (590s-610s) để không flaky vì vài mili-giây thực thi test.
    expect(saved.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 590_000)
    expect(saved.expiresAt.getTime()).toBeLessThanOrEqual(before + 610_000)
  })
})

describe('UploadIntentsService.claimForVersion', () => {
  it('chỉ claim atomically intent đúng key, actor, phim, loại, pending và chưa hết hạn', async () => {
    const { service } = setup()
    const manager = { update: jest.fn().mockResolvedValue({ affected: 1 }) }
    await service.claimForVersion(
      { storageKey: 'thumb-x.jpg', kind: 'thumbnail', filmId: 7, actorId: 3 },
      manager as never,
    )
    expect(manager.update).toHaveBeenCalledWith(
      UploadIntent,
      expect.objectContaining({
        storageKey: 'thumb-x.jpg',
        kind: 'thumbnail',
        filmId: 7,
        actorId: 3,
        status: 'pending',
        expiresAt: expect.anything(),
      }),
      expect.objectContaining({ status: 'consumed' }),
    )
  })

  it.each([
    ['key lạ'],
    ['key của người khác'],
    ['key của phim khác'],
    ['sai loại asset'],
    ['intent đã consumed'],
    ['intent đã hết hạn'],
  ])('từ chối %s khi atomic claim không ảnh hưởng bản ghi nào', async () => {
    const { service } = setup()
    const manager = { update: jest.fn().mockResolvedValue({ affected: 0 }) }
    await expect(
      service.claimForVersion(
        { storageKey: 'thumb-x.jpg', kind: 'thumbnail', filmId: 7, actorId: 3 },
        manager as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})

describe('UploadIntentsService.sweepExpired', () => {
  it('không có intent quá hạn → trả 0, KHÔNG gọi storage.delete', async () => {
    const { service, storage } = setup()
    expect(await service.sweepExpired()).toBe(0)
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('atomically reserve intent quá hạn trước khi xoá object rồi đánh dấu expired', async () => {
    const { service, intents, storage } = setup()
    intents.find.mockResolvedValue([staleIntent({ id: 5, storageKey: 'video-rac.mp4' })])
    const n = await service.sweepExpired()
    expect(n).toBe(1)
    expect(storage.delete).toHaveBeenCalledWith('video-rac.mp4')
    expect(intents.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, status: 'pending', expiresAt: expect.anything() }),
      { status: 'cleaning' },
    )
    expect(intents.update).toHaveBeenCalledWith({ id: 5, status: 'cleaning' }, { status: 'expired' })
  })

  it('nhiều intent quá hạn → xử lý HẾT, không dừng giữa chừng nếu 1 object đã bị xoá thủ công trước đó', async () => {
    const { service, intents, storage } = setup()
    intents.find.mockResolvedValue([
      staleIntent({ id: 5, storageKey: 'video-rac-1.mp4' }),
      staleIntent({ id: 6, storageKey: 'video-rac-2.mp4' }),
    ])
    const n = await service.sweepExpired()
    expect(n).toBe(2)
    expect(storage.delete).toHaveBeenCalledTimes(2)
    expect(intents.update).toHaveBeenCalledWith({ id: 5, status: 'cleaning' }, { status: 'expired' })
    expect(intents.update).toHaveBeenCalledWith({ id: 6, status: 'cleaning' }, { status: 'expired' })
  })
})

describe('UploadIntentsService.record — cleanup single-instance', () => {
  it('lần record() đầu tiên trong tiến trình → trigger sweepExpired ngay', async () => {
    const { service } = setup()
    const spy = jest.spyOn(service, 'sweepExpired')
    await service.record({ kind: 'video', storageKey: 'a', filmId: 1, actorId: 1, expiresInSec: 600 })
    await Promise.resolve() // sweepIfDue chạy fire-and-forget (`void`), đợi 1 microtask.
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('record() gọi liên tiếp trong cùng cửa sổ throttle → KHÔNG sweep lần 2 (tránh quét mỗi lần ký URL)', async () => {
    const { service } = setup()
    const spy = jest.spyOn(service, 'sweepExpired')
    await service.record({ kind: 'video', storageKey: 'a', filmId: 1, actorId: 1, expiresInSec: 600 })
    await Promise.resolve()
    await service.record({ kind: 'video', storageKey: 'b', filmId: 1, actorId: 1, expiresInSec: 600 })
    await Promise.resolve()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('multi-replica không quét theo request; CronJob dùng chung chịu trách nhiệm cleanup', async () => {
    process.env.MULTI_REPLICA = 'true'
    const { service } = setup()
    const spy = jest.spyOn(service, 'sweepExpired')
    await service.record({ kind: 'video', storageKey: 'a', filmId: 1, actorId: 1, expiresInSec: 600 })
    await Promise.resolve()
    expect(spy).not.toHaveBeenCalled()
  })

  it('sweepExpired lỗi KHÔNG được làm hỏng record() (luồng ký URL vẫn phải trả kết quả)', async () => {
    const { service, storage, intents } = setup()
    intents.find.mockResolvedValue([staleIntent()])
    storage.delete.mockRejectedValue(new Error('MinIO tạm thời không phản hồi'))
    await expect(
      service.record({ kind: 'video', storageKey: 'a', filmId: 1, actorId: 1, expiresInSec: 600 }),
    ).resolves.toBeUndefined()
  })
})
