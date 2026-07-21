import { Controller, Get, Head, Param, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { StorageService } from './storage.service'
import { Public } from '../../common/auth/public.decorator'

/**
 * Phát media từ MinIO — GET /media/:key (nginx location /media/ proxy sẵn Range).
 *
 * PHẢI @Public: thẻ <video src> và link tải KHÔNG gắn được Authorization header,
 * nên endpoint không yêu cầu JWT. An toàn dựa trên key là uuid không đoán được
 * (ADR-020). Route nằm NGOÀI prefix /api (main.ts exclude 'media/:key').
 *
 * Hỗ trợ HTTP Range: chuyển thẳng header Range cho MinIO, trả 206 Partial Content
 * kèm Content-Range/Accept-Ranges/Content-Length khớp phần range → tua/seek mượt.
 */
@Controller('media')
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Head(':key')
  async head(@Param('key') key: string, @Res() res: Response): Promise<void> {
    const info = await this.storage.stat(key)
    if (!info) {
      res.status(404).end()
      return
    }
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', info.contentType)
    res.setHeader('Content-Length', String(info.size))
    res.status(200).end()
  }

  @Public()
  @Get(':key')
  async stream(
    @Param('key') key: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const range = req.headers.range
    const obj = await this.storage.getObject(key, range)
    if (!obj) {
      res.status(404).json({ statusCode: 404, message: 'Không tìm thấy tệp' })
      return
    }

    res.setHeader('Accept-Ranges', 'bytes')
    if (obj.contentType) res.setHeader('Content-Type', obj.contentType)
    if (obj.contentLength != null) res.setHeader('Content-Length', String(obj.contentLength))

    if (obj.contentRange) {
      res.setHeader('Content-Range', obj.contentRange)
      res.status(206) // Partial Content khi có Range
    } else {
      res.status(200)
    }

    obj.body.on('error', () => {
      if (!res.headersSent) res.status(500)
      res.end()
    })
    obj.body.pipe(res)
  }
}
