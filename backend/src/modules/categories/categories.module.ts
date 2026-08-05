import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Category } from './entities/category.entity'
import { CategoriesService } from './categories.service'
import { CategoriesController } from './categories.controller'
import { UsersModule } from '../users/users.module'

/** UsersModule để snapshot `department_id` của người tạo chuyên mục (cột truy vết, ADR-042). */
@Module({
  imports: [TypeOrmModule.forFeature([Category]), UsersModule],
  providers: [CategoriesService],
  controllers: [CategoriesController],
  exports: [CategoriesService],
})
export class CategoriesModule {}
