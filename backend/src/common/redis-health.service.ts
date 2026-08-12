import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

/**
 * Readiness riêng cho Redis khi chạy multi-replica. Throttler có connection Redis của nó;
 * connection nhỏ này chỉ dùng PING để orchestrator ngừng route traffic khi shared rate-limit
 * không còn dùng được. Không tạo Redis ở single-instance để giữ hành vi/dev nhẹ như cũ.
 */
@Injectable()
export class RedisHealthService implements OnModuleDestroy {
  private readonly logger = new Logger('RedisHealth')

  constructor(private readonly client?: Redis) {}

  async status(): Promise<'disabled' | 'ok' | 'unreachable'> {
    if (!this.client) return 'disabled'
    try {
      await this.client.ping()
      return 'ok'
    } catch (error) {
      // Không log URL/password Redis. Chỉ đủ context để vận hành biết readiness bị hạ.
      this.logger.warn(`Redis shared throttler không sẵn sàng: ${error instanceof Error ? error.name : 'unknown'}`)
      return 'unreachable'
    }
  }

  onModuleDestroy() {
    this.client?.disconnect(false)
  }
}
