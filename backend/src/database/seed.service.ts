import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { ALL_ROLE_CODES, ROLE_NAME, Role } from '../modules/users/entities/role.entity'
import { User } from '../modules/users/entities/user.entity'

/**
 * Seed lúc khởi động (idempotent — chạy nhiều lần không nhân đôi):
 *  1. 3 vai trò tĩnh viewer/employee/super_admin (RBAC 3 cấp phẳng, ADR-045).
 *  2. Tài khoản super_admin đầu tiên từ .env (SEED_SUPER_ADMIN_*).
 * Chạy sau khi migration đã tạo bảng (migrationsRun=true khi init DataSource).
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('Seed')

  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedRoles()
    await this.seedSuperAdmin()
  }

  private async seedRoles(): Promise<void> {
    // Danh sách vai trò lấy từ NGUỒN SỰ THẬT DUY NHẤT ở `role.entity.ts` — không khai lại
    // thủ công ở đây để tránh seed lệch với RoleCode/nhãn khi thêm cấp mới sau này.
    for (const code of ALL_ROLE_CODES) {
      const existed = await this.roles.findOne({ where: { code } })
      if (!existed) await this.roles.save({ code, name: ROLE_NAME[code] } as Role)
    }
  }

  private async seedSuperAdmin(): Promise<void> {
    const email = (process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@misa.com.vn').toLowerCase()
    const password = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Admin@12345'
    const fullName = process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin'

    const existed = await this.users.findOne({ where: { email } })
    if (existed) return

    const passwordHash = await bcrypt.hash(password, 10)
    await this.users.save(
      this.users.create({
        email,
        fullName,
        passwordHash,
        roleCode: 'super_admin',
        departmentId: null,
        createdBy: null,
        isActive: true,
        mustChangePassword: false,
      }),
    )
    this.logger.log(`Đã tạo super_admin mặc định: ${email}`)
  }
}
