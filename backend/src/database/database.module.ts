import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Role } from '../modules/users/entities/role.entity'
import { User } from '../modules/users/entities/user.entity'
import { SeedService } from './seed.service'

/** Chạy seed roles + super_admin lúc khởi động. */
@Module({
  imports: [TypeOrmModule.forFeature([Role, User])],
  providers: [SeedService],
})
export class DatabaseModule {}
