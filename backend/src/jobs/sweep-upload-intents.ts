import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { assertSecureConfig } from '../common/config/security.config'
import { UploadIntentsService } from '../modules/uploads/upload-intents.service'

/**
 * One-shot worker cho K8s CronJob/Swarm external scheduler. Không dùng timer trong Pod: việc
 * dọn phải sống độc lập với traffic upload và lifecycle của web replica. `sweepExpired` đã
 * reserve atomically từng intent nên chạy overlap sau retry cũng không xoá object đã consume.
 */
async function main() {
  assertSecureConfig()
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] })
  const logger = new Logger('UploadIntentSweepJob')
  try {
    const uploads = app.get(UploadIntentsService)
    let total = 0
    // sweep xử lý batch 200; lặp đến hết để CronJob không để backlog lớn kéo dài nhiều chu kỳ.
    for (;;) {
      const cleaned = await uploads.sweepExpired()
      total += cleaned
      if (cleaned === 0) break
    }
    logger.log(`Hoàn tất dọn upload intent: ${total} object`)
  } finally {
    await app.close()
  }
}

void main()
