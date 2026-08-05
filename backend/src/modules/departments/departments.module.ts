import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Department } from './entities/department.entity'
import { DepartmentsService } from './departments.service'
import { DepartmentsController } from './departments.controller'

/**
 * Module phòng ban. Export DepartmentsService để UsersService kiểm tra phòng ban có tồn tại
 * khi gán cho tài khoản (không tin id client gửi lên).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Department])],
  providers: [DepartmentsService],
  controllers: [DepartmentsController],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
