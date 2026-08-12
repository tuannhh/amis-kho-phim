import { Controller, Get, Optional, ServiceUnavailableException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { Public } from './auth/public.decorator'
import { RedisHealthService } from './redis-health.service'

/**
 * Health check — dùng cho nginx/docker/orchestrator. Công khai (không cần đăng nhập).
 *
 * GĐ7 tách 2 loại theo chuẩn Backend MISA (09-operations-reliability §1):
 *  - `/api/health` (liveness): CHỈ xác nhận tiến trình còn sống. CỐ Ý KHÔNG kiểm tra
 *    MySQL — nếu DB chập chờn mà liveness fail, orchestrator sẽ hiểu nhầm tiến trình đã
 *    chết và restart vô ích, trong khi lỗi thật nằm ở DB.
 *  - `/api/health/ready` (readiness): CÓ kiểm tra MySQL — orchestrator dùng để quyết
 *    định có định tuyến traffic vào instance này hay chưa.
 *
 * Cả hai chỉ trả trạng thái tổng quát, không lộ phiên bản/chi tiết hạ tầng ra ngoài.
 */
@Controller('health')
export class HealthController {
  /**
   * `@Optional()`: khi chạy với `DB_ENABLED=false`, TypeOrmModule không được nạp nên
   * không có DataSource để tiêm. Không đánh dấu optional thì chính chế độ chạy không-DB
   * (đã tồn tại từ GĐ0) sẽ hỏng.
   */
  constructor(
    @Optional() @InjectDataSource() private readonly dataSource?: DataSource,
    private readonly redisHealth: RedisHealthService = new RedisHealthService(),
  ) {}

  @Public()
  @Get()
  check() {
    return {
      app: 'AMIS Kho phim',
      status: 'ok',
      time: new Date().toISOString(),
    }
  }

  @Public()
  @Get('ready')
  async ready() {
    if (!this.dataSource) {
      // Chạy chế độ không DB chỉ có ở development/test. Dù vậy Redis vẫn là dependency của
      // multi-replica, nên không được trả ready giả khi shared throttler đã mất.
      const redis = await this.redisHealth.status()
      if (redis === 'unreachable') {
        throw new ServiceUnavailableException({
          status: 'not-ready',
          database: 'disabled',
          redis: 'unreachable',
        })
      }
      return { status: 'ready', database: 'disabled', redis, time: new Date().toISOString() }
    }
    try {
      await this.dataSource.query('SELECT 1')
    } catch {
      // Không kèm thông điệp lỗi gốc: tránh lộ chi tiết kết nối/hạ tầng ra ngoài
      // (02-security-baseline §5).
      throw new ServiceUnavailableException({
        status: 'not-ready',
        database: 'unreachable',
      })
    }
    const redis = await this.redisHealth.status()
    if (redis === 'unreachable') {
      throw new ServiceUnavailableException({
        status: 'not-ready',
        database: 'ok',
        redis: 'unreachable',
      })
    }
    return {
      status: 'ready',
      database: 'ok',
      redis,
      time: new Date().toISOString(),
    }
  }
}
