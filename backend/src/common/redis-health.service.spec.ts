import { RedisHealthService } from './redis-health.service'

describe('RedisHealthService', () => {
  it('single-instance không tạo Redis → readiness ghi rõ disabled', async () => {
    await expect(new RedisHealthService().status()).resolves.toBe('disabled')
  })

  it('PING Redis thành công → ok', async () => {
    const client = { ping: jest.fn().mockResolvedValue('PONG'), disconnect: jest.fn() }
    await expect(new RedisHealthService(client as never).status()).resolves.toBe('ok')
  })

  it('PING lỗi → unreachable, không ném lỗi làm health endpoint crash', async () => {
    const client = { ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')), disconnect: jest.fn() }
    await expect(new RedisHealthService(client as never).status()).resolves.toBe('unreachable')
  })

  it('shutdown đóng kết nối readiness Redis', () => {
    const client = { ping: jest.fn(), disconnect: jest.fn() }
    const service = new RedisHealthService(client as never)
    service.onModuleDestroy()
    expect(client.disconnect).toHaveBeenCalledWith(false)
  })
})
