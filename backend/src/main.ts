import { NestFactory } from '@nestjs/core'
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { assertSecureConfig, corsOrigins, isProduction } from './common/config/security.config'

async function bootstrap() {
  // GĐ7 — chặn khởi động production nếu còn secret mặc định (xem security.config.ts).
  // Ngoài production chỉ in cảnh báo, KHÔNG đổi hành vi dev.
  assertSecureConfig()

  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // Prefix chung cho API (nginx proxy /api → backend). Loại trừ /media/:key
  // (nginx location /media/ proxy thẳng, phát video theo Range — GĐ3).
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'media/:key', method: RequestMethod.GET },
      { path: 'media/:key', method: RequestMethod.HEAD },
    ],
  })

  // GĐ7 — security headers. Tắt CSP ở tầng này: backend chỉ trả JSON + stream media,
  // CSP thuộc về tài liệu HTML (nginx đặt cho FE). crossOriginResourcePolicy để
  // 'cross-origin' để KHÔNG chặn thẻ <video src="/media/..."> khi FE và API khác origin
  // (dev Vite, WebView AMIS Mobile GĐ6.1) — media vốn đã là @Public (ADR-021).
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Không rò rỉ URL (scaffold GĐ6.1 có thể chứa ?ssoToken=) qua header Referer.
      referrerPolicy: { policy: 'no-referrer' },
    }),
  )

  // UTF-8 mặc định cho toàn bộ response JSON (tiếng Việt có dấu)
  app.use((_req: any, res: any, next: any) => {
    res.charset = 'utf-8'
    next()
  })

  // Validate DTO toàn cục (chuẩn bị cho các module nghiệp vụ)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  // CORS: dev phản chiếu mọi origin (FE Vite); production chỉ same-origin qua nginx,
  // trừ khi khai báo tường minh CORS_ORIGINS=https://a,https://b (GĐ7).
  app.enableCors({ origin: corsOrigins(), credentials: true })

  // Nginx đứng trước → tin X-Forwarded-For để rate limit lấy đúng IP người dùng.
  app.set('trust proxy', 1)

  // GĐ7 — tắt có kiểm soát (09-operations-reliability §2): khi nhận SIGTERM (triển khai
  // bản mới, orchestrator luân chuyển tải), Nest chạy hook huỷ của các module để đóng
  // kết nối MySQL/S3 tử tế thay vì cắt đột ngột giữa chừng.
  app.enableShutdownHooks()

  // GĐ7 — tài liệu API (OpenAPI). MẶC ĐỊNH TẮT ở production để không phơi toàn bộ
  // API surface ra ngoài; bật có chủ đích bằng ENABLE_API_DOCS=true (ADR-031).
  const docsEnabled = !isProduction() || process.env.ENABLE_API_DOCS === 'true'
  if (docsEnabled) {
    const config = new DocumentBuilder()
      .setTitle('AMIS Kho phim — API')
      .setDescription(
        'API nội bộ quản lý kho phim MISA. Hầu hết endpoint yêu cầu Bearer access token ' +
          '(lấy từ POST /api/auth/login). Xem thêm docs/api-overview.md.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    })
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3000
  await app.listen(port, '0.0.0.0')
  const logger = new Logger('Bootstrap')
  logger.log(`[AMIS Kho phim] Backend chạy tại http://0.0.0.0:${port}/api`)
  if (docsEnabled) logger.log(`Tài liệu API (Swagger): http://0.0.0.0:${port}/api/docs`)
}
bootstrap()
