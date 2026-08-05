import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm'

/**
 * Phòng ban — danh mục tổ chức dùng để SCOPE quyền của Cấp 3 (Trưởng phòng) theo
 * `users.department_id` và `films.department_id` (ADR-040/042).
 *
 * Danh mục này ảnh hưởng trực tiếp tới ranh giới phân quyền, nên quyền ghi giới hạn ở
 * cấp cao nhất (Cấp 4) — đúng `02-security-baseline.md` §2 ("endpoint quản lý danh mục
 * dùng chung toàn hệ thống nên giới hạn quyền ghi ở cấp cao nhất").
 */
@Entity({ name: 'departments' })
export class Department {
  @PrimaryGeneratedColumn()
  id!: number

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 150 })
  name!: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
