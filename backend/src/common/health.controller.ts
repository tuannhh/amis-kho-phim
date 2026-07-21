import { Controller, Get } from '@nestjs/common'

/** Health check — dùng cho nginx/docker healthcheck & smoke test. */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      app: 'AMIS Kho phim',
      status: 'ok',
      time: new Date().toISOString(),
    }
  }
}
