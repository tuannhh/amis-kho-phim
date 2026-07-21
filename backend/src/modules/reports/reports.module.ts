import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Film } from '../films/entities/film.entity'
import { ReportsService } from './reports.service'
import { ReportsController } from './reports.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Film])],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
