import { Controller, Get } from '@nestjs/common'
import { Public } from './auth/public.decorator'

/** Health check — dùng cho nginx/docker healthcheck & smoke test. Công khai (không cần đăng nhập). */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      app: 'AMIS Kho phim',
      status: 'ok',
      time: new Date().toISOString(),
    }
  }
}
