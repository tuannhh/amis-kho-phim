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
 * created_by = id người tạo (Cấp 4), null với tài khoản seed hệ thống.
 * department_id = phòng ban (nullable) — dùng scope quyền Cấp 3, xem role.entity.ts.
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

  /**
   * Phòng ban của người dùng — NGUỒN SỰ THẬT để scope quyền Cấp 3 (ADR-040).
   * Nullable có chủ đích: Cấp 1 (chỉ xem) và Cấp 4 (toàn quyền) không cần thuộc phòng ban
   * cụ thể nào; chỉ Cấp 2/Cấp 3 mới có ý nghĩa thực tế khi được gán.
   */
  @Column({ name: 'department_id', type: 'int', nullable: true })
  departmentId!: number | null

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
