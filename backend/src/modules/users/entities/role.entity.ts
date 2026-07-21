import { Entity, PrimaryColumn, Column } from 'typeorm'

/** Vai trò cố định (seed tĩnh): super_admin | admin | employee — xem 01-architecture.md §4/§5. */
export type RoleCode = 'super_admin' | 'admin' | 'employee'

@Entity({ name: 'roles' })
export class Role {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  code!: RoleCode

  @Column({ type: 'varchar', length: 50 })
  name!: string
}
