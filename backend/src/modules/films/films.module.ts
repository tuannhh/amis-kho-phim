import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Film } from './entities/film.entity'
import { FilmLink } from './entities/film-link.entity'
import { Hashtag } from './entities/hashtag.entity'
import { FilmVersion } from './entities/film-version.entity'
import { FilmView } from './entities/film-view.entity'
import { FilmsService } from './films.service'
import { FilmsController } from './films.controller'
import { StorageModule } from '../storage/storage.module'

@Module({
  imports: [TypeOrmModule.forFeature([Film, FilmLink, Hashtag, FilmVersion, FilmView]), StorageModule],
  providers: [FilmsService],
  controllers: [FilmsController],
})
export class FilmsModule {}
