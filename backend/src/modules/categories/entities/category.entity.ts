import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm'

/** Chuyên mục phim, cây cha-con (01-architecture.md §4). parent_id null = gốc. */
@Entity({ name: 'categories' })
export class Category {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 150 })
  name!: string

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 190 })
  slug!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId!: number | null

  @ManyToOne(() => Category, (c) => c.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category | null

  @OneToMany(() => Category, (c) => c.parent)
  children?: Category[]

  /**
   * TRUY VẾT — ai tạo chuyên mục này, và phòng ban của người đó lúc tạo (ADR-042).
   * CỐ Ý KHÔNG dùng để scope quyền: chuyên mục là danh mục DÙNG CHUNG toàn công ty, quyền
   * ghi giữ nguyên ở cấp cao nhất (Cấp 4) đúng `02-security-baseline.md` §2. Hai cột này
   * chỉ phục vụ truy vết/kiểm toán theo yêu cầu tường minh của người dùng.
   */
  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null

  @Column({ name: 'department_id', type: 'int', nullable: true })
  departmentId!: number | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
