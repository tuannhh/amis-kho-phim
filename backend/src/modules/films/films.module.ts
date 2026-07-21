import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Film } from './entities/film.entity'
import { FilmLink } from './entities/film-link.entity'
import { Hashtag } from './entities/hashtag.entity'
import { FilmsService } from './films.service'
import { FilmsController } from './films.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Film, FilmLink, Hashtag])],
  providers: [FilmsService],
  controllers: [FilmsController],
})
export class FilmsModule {}
