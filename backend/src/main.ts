import { NestFactory } from '@nestjs/core'
import { RequestMethod, ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Prefix chung cho API (nginx proxy /api → backend). Loại trừ /media/:key
  // (nginx location /media/ proxy thẳng, phát video theo Range — GĐ3).
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'media/:key', method: RequestMethod.GET },
      { path: 'media/:key', method: RequestMethod.HEAD },
    ],
  })

  // UTF-8 mặc định cho toàn bộ response JSON (tiếng Việt có dấu)
  app.use((_req: any, res: any, next: any) => {
    res.charset = 'utf-8'
    next()
  })

  // Validate DTO toàn cục (chuẩn bị cho các module nghiệp vụ)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  // CORS cho môi trường dev (FE Vite). Prod đi qua nginx cùng origin.
  app.enableCors({ origin: true, credentials: true })

  const port = process.env.PORT ? Number(process.env.PORT) : 3000
  await app.listen(port, '0.0.0.0')
  // eslint-disable-next-line no-console
  console.log(`[AMIS Kho phim] Backend chạy tại http://0.0.0.0:${port}/api`)
}
bootstrap()
