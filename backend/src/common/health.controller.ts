import { Controller, Get, Optional, ServiceUnavailableException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { Public } from './auth/public.decorator'

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
      // Chạy chế độ không DB — coi như sẵn sàng, nói rõ để không gây hiểu nhầm.
      return { status: 'ready', database: 'disabled', time: new Date().toISOString() }
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
    return { status: 'ready', database: 'ok', time: new Date().toISOString() }
  }
}
