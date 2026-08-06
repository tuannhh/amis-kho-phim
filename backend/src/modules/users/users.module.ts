import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from './entities/user.entity'
import { Role } from './entities/role.entity'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { DepartmentsModule } from '../departments/departments.module'

/**
 * Module người dùng: entity + CRUD. Export UsersService để AuthModule và FilmsModule dùng lại
 * (FilmsService cần đọc phòng ban thật từ DB để ghi snapshot truy vết khi tạo phim).
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Role]), DepartmentsModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
