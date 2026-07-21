import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm'

@Entity({ name: 'hashtags' })
export class Hashtag {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 100 })
  name!: string

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  slug!: string
}
