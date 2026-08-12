import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, LessThan, MoreThan, Repository } from 'typeorm'
import { UploadIntent, type UploadIntentKind } from './entities/upload-intent.entity'
import { StorageService } from '../storage/storage.service'

/**
 * Chủ sở hữu + vòng đời của mỗi presigned upload URL đã ký — Tier A retrofit (2026-08-12,
 * xem chú thích đầy đủ ở `entities/upload-intent.entity.ts`).
 */
@Injectable()
export class UploadIntentsService {
  private readonly logger = new Logger('UploadIntents')

  /**
   * Single-instance/dev: quét opportunistic, có throttle. Multi-replica: worker CronJob
   * riêng gọi `sweepExpired()`; không để mỗi web Pod cùng quét và sinh hành vi theo traffic.
   */
  private static readonly SWEEP_INTERVAL_MS = 15 * 60 * 1000
  private static lastSweepAt = 0

  constructor(
    @InjectRepository(UploadIntent) private readonly intents: Repository<UploadIntent>,
    private readonly storage: StorageService,
  ) {}

  /** Ghi nhận 1 presigned URL vừa ký — gọi ngay sau khi `StorageService` sinh key + URL. */
  async record(params: {
    kind: UploadIntentKind
    storageKey: string
    filmId: number
    actorId: number
    expiresInSec: number
  }): Promise<void> {
    await this.intents.save(
      this.intents.create({
        kind: params.kind,
        storageKey: params.storageKey,
        filmId: params.filmId,
        actorId: params.actorId,
        status: 'pending',
        expiresAt: new Date(Date.now() + params.expiresInSec * 1000),
        consumedAt: null,
      }),
    )
    if (process.env.MULTI_REPLICA !== 'true') void this.sweepIfDue()
  }

  /**
   * Claim một object upload để đưa vào version. Đây vừa là kiểm ownership, vừa là chốt chống
   * replay/race: MỘT câu UPDATE chỉ thành công khi key còn pending, chưa hết hạn và thuộc đúng
   * actor/phim/loại asset. `affected !== 1` nghĩa là key không tồn tại, sai chủ/phim/loại,
   * đã dùng, đang bị dọn hoặc đã hết hạn; không tiết lộ nhánh nào cho client.
   *
   * Bắt buộc gọi TRONG transaction tạo FilmVersion và TRƯỚC `em.save(FilmVersion)`. Nếu các
   * bước sau lỗi, transaction rollback cả claim; nếu hai request cùng claim, chỉ một request
   * nhận affected=1. Không thay bằng find-then-update vì sẽ mở lại race condition.
   */
  async claimForVersion(
    params: { storageKey: string; kind: UploadIntentKind; filmId: number; actorId: number },
    manager: EntityManager,
  ): Promise<void> {
    const now = new Date()
    const result = await manager.update(
      UploadIntent,
      {
        storageKey: params.storageKey,
        kind: params.kind,
        filmId: params.filmId,
        actorId: params.actorId,
        status: 'pending',
        expiresAt: MoreThan(now),
      },
      { status: 'consumed', consumedAt: now },
    )
    if (result.affected !== 1) {
      throw new BadRequestException('Tệp upload không hợp lệ, đã hết hạn hoặc đã được sử dụng')
    }
  }

  /** Chỉ gọi `sweepExpired` nếu đã đủ lâu kể từ lần quét trước — tránh quét mỗi lần ký URL. */
  private async sweepIfDue(): Promise<void> {
    const now = Date.now()
    if (now - UploadIntentsService.lastSweepAt < UploadIntentsService.SWEEP_INTERVAL_MS) return
    UploadIntentsService.lastSweepAt = now
    try {
      const n = await this.sweepExpired()
      if (n) this.logger.log(`Đã dọn ${n} upload-intent quá hạn chưa consume`)
    } catch (e) {
      // Dọn rác thất bại KHÔNG được làm hỏng luồng ký URL đang phục vụ người dùng.
      this.logger.warn(`sweepExpired lỗi: ${(e as Error).message}`)
    }
  }

  /**
   * Xoá object mồ côi trên MinIO cho các intent `pending` đã quá hạn (`expires_at` < hiện
   * tại), rồi đánh dấu `expired`. Giới hạn 200 bản ghi/lần để một lần quét không kéo dài.
   * Trả về số intent đã xử lý.
   */
  async sweepExpired(): Promise<number> {
    const stale = await this.intents.find({
      where: { status: 'pending', expiresAt: LessThan(new Date()) },
      take: 200,
    })
    if (!stale.length) return 0

    let cleaned = 0
    for (const intent of stale) {
      // Reserve có điều kiện trước khi đụng MinIO. Không làm vậy, `confirmVersion` có thể
      // consume key ngay sau find() nhưng trước delete(), tạo FilmVersion trỏ vào object vừa
      // bị sweep xoá. Mỗi Pod/worker chỉ có thể reserve đúng một lần.
      const reserved = await this.intents.update(
        { id: intent.id, status: 'pending', expiresAt: LessThan(new Date()) },
        { status: 'cleaning' },
      )
      if (reserved.affected !== 1) continue

      try {
        // `storage.delete` tự nuốt lỗi 404; nếu adapter ném lỗi hạ tầng, trả intent về
        // pending để lần sweep sau retry thay vì đánh dấu expired trong khi object còn tồn tại.
        await this.storage.delete(intent.storageKey)
        await this.intents.update({ id: intent.id, status: 'cleaning' }, { status: 'expired' })
        cleaned++
      } catch (e) {
        await this.intents.update({ id: intent.id, status: 'cleaning' }, { status: 'pending' })
        throw e
      }
    }
    return cleaned
  }
}
