import { ServiceUnavailableException } from '@nestjs/common'
import { HealthController } from './health.controller'

describe('HealthController.ready', () => {
  const dataSource = { query: jest.fn().mockResolvedValue([{ 1: 1 }]) }

  it('single-instance báo ready cùng trạng thái Redis disabled', async () => {
    const controller = new HealthController(dataSource as never, { status: jest.fn().mockResolvedValue('disabled') } as never)
    await expect(controller.ready()).resolves.toEqual(expect.objectContaining({ status: 'ready', database: 'ok', redis: 'disabled' }))
  })

  it('chế độ không DB cũng không che Redis mất khi multi-replica', async () => {
    const controller = new HealthController(undefined, { status: jest.fn().mockResolvedValue('unreachable') } as never)
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('Redis shared không reachable → readiness 503 để Pod không nhận traffic', async () => {
    const controller = new HealthController(dataSource as never, { status: jest.fn().mockResolvedValue('unreachable') } as never)
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('MySQL lỗi vẫn trả 503 trước khi kiểm Redis', async () => {
    const controller = new HealthController({ query: jest.fn().mockRejectedValue(new Error('DB down')) } as never, {
      status: jest.fn(),
    } as never)
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})
