import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Film } from '../films/entities/film.entity'
import { ReportsService } from './reports.service'
import { ReportsController } from './reports.controller'
import { CategoriesModule } from '../categories/categories.module'
import { UsersModule } from '../users/users.module'
import { DepartmentsModule } from '../departments/departments.module'

/**
 * CategoriesModule: lọc theo chuyên mục cha phải gồm cả chuyên mục con (`idsWithDescendants`).
 * UsersModule: đọc phòng ban THẬT của Trưởng phòng từ DB để ép phạm vi báo cáo (ADR-053).
 * DepartmentsModule: lấy tên phòng ban hiển thị trên đầu báo cáo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Film]), CategoriesModule, UsersModule, DepartmentsModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
