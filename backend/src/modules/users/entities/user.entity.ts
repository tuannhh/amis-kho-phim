import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'
import type { RoleCode } from './role.entity'

/**
 * Người dùng hệ thống. Mật khẩu LƯU DẠNG HASH (bcrypt) — không bao giờ trả password_hash ra API.
 * created_by = id người tạo (super_admin/admin), null với tài khoản seed hệ thống.
 * must_change_password: buộc đổi mật khẩu ở lần đăng nhập đầu (tài khoản do admin tạo).
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 190 })
  email!: string

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName!: string

  @Column({ name: 'password_hash', type: 'varchar', length: 100, select: false })
  passwordHash!: string

  @Column({ name: 'role_code', type: 'varchar', length: 20 })
  roleCode!: RoleCode

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
