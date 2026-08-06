import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm'

/**
 * Phòng ban — danh mục tổ chức gắn vào `users.department_id`, `films.department_id`,
 * `categories.department_id`.
 *
 * Ở bản RBAC 3 CẤP PHẲNG (ADR-045/046) danh mục này KHÔNG scope quyền của ai cả — thuần
 * TRUY VẾT/báo cáo. Quyền ghi vẫn giới hạn ở cấp cao nhất (Cấp 3 `super_admin`) đúng
 * `02-security-baseline.md` §2 ("endpoint quản lý danh mục dùng chung toàn hệ thống nên
 * giới hạn quyền ghi ở cấp cao nhất").
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
