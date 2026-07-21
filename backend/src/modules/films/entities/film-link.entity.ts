import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { Film } from './film.entity'

/** Link ngoài của phim (GĐ2: youtube/vimeo/gdrive/misadrive — 'storage' thật đến ở GĐ3/MinIO). */
export type ExternalFilmPlatform = 'youtube' | 'vimeo' | 'gdrive' | 'misadrive'

@Entity({ name: 'film_links' })
export class FilmLink {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'film_id', type: 'int' })
  filmId!: number

  @ManyToOne(() => Film, (f) => f.links, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'film_id' })
  film?: Film

  @Column({ type: 'varchar', length: 20 })
  platform!: ExternalFilmPlatform

  @Column({ type: 'varchar', length: 500 })
  url!: string
}
