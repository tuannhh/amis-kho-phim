# AMIS Kho phim — Decision Log (ADR rút gọn)

> Ghi lại quyết định kiến trúc quan trọng + lý do. Thêm mục mới ở trên cùng.

## ADR-014 — OwnerGuard hoãn tới GĐ2 (chưa có resource "phim" ở BE)
- **Quyết định:** GĐ1 mới có `RolesGuard` (toàn cục theo `@Roles`). Kiểm chủ sở hữu cho **quản trị người dùng** (ai khoá/xoá được ai, không tự khoá mình) đặt ở **tầng service** (`UsersService.assertCanManage`), không dựng class OwnerGuard rỗng. `OwnerGuard` thật (theo `uploader_id` của phim) sẽ thêm ở GĐ2 khi FilmsModule ra đời.
- **Lý do:** Owner theo nghĩa roadmap (§5) là "nhân viên chỉ sửa/xoá phim của mình" — chưa có phim ở BE nên guard chưa có gì để canh; tránh dead code. Vẫn giữ đúng tinh thần ADR-002 (kiểm quyền ở BE, không tin FE).

## ADR-013 — Buộc đổi mật khẩu lần đầu (must_change_password)
- **Quyết định:** Cột `users.must_change_password`. Tài khoản do admin/super tạo luôn `=true`; seed super_admin `=false`. FE: sau login nếu `mustChangePassword` → ép sang `/change-password` (router guard dồn mọi route về đây tới khi đổi xong). Backend `/auth/change-password` verify mật khẩu hiện tại rồi set `=false`.
- **Lý do:** Mật khẩu tạm do hệ thống sinh/admin đặt không nên dùng lâu dài; đúng UX đã hứa ở form GĐ0.5.

## ADR-012 — JWT access(15') + refresh(7d), lưu localStorage (prototype)
- **Quyết định:** 2 token: access ngắn (JWT_ACCESS_TTL) + refresh dài (JWT_REFRESH_TTL), ký bằng 2 secret khác nhau, có `type: access|refresh` trong payload (guard chỉ nhận access; refresh chỉ dùng ở /auth/refresh). FE lưu ở `localStorage`, `http.ts` tự gắn Bearer + tự refresh 1 lần khi 401. Kiểm quyền THẬT ở BE (RolesGuard + service); FE chỉ ẩn/hiện cho UX.
- **Lý do:** Đủ an toàn cho tool nội bộ prototype, đơn giản. Chừa seam: GĐ7 DevOps thay bước "xác minh danh tính" bằng OIDC AMIS, phần cấp JWT/kiểm quyền giữ nguyên. **Nợ kỹ thuật ghi nhận:** localStorage dễ tổn thương XSS hơn httpOnly cookie — cân nhắc chuyển khi lên production.

## ADR-011 — Hash mật khẩu bằng bcryptjs; migration tự chạy khi khởi động
- **Quyết định:** Dùng `bcryptjs` (thuần JS) thay `argon2`/`bcrypt` native. Migration TypeORM đăng ký **tường minh** (không glob) + `migrationsRun: true` để tự chạy lúc khởi động; `db-options.ts` là config DÙNG CHUNG cho AppModule (runtime) và DataSource CLI. `password_hash` để `select: false` (không lộ ra API). Seed roles + super_admin idempotent qua `OnModuleInit`.
- **Lý do:** `argon2`/`bcrypt` cần build native trên `node:20-alpine` (python/make/g++) → rủi ro gãy Docker build (đã dính lỗi build ở GĐ0.5). `bcryptjs` cài là chạy. Đăng ký entity/migration tường minh để chạy đúng cả ở dist(.js) lẫn dev(.ts). **Lưu ý:** `retryAttempts`/`retryDelay` là mở rộng riêng của Nest — chỉ thêm khi gọi `TypeOrmModule.forRoot`, KHÔNG để trong `DataSourceOptions` dùng chung (fail typecheck).

## ADR-010 — Cổng Docker: 8180 (nginx) / 9200+9201 (MinIO) thay vì mặc định
- **Quyết định:** Đổi `NGINX_PORT` 8080→8180, `MINIO_API_PORT` 9000→9200, `MINIO_CONSOLE_PORT` 9001→9201.
- **Lý do:** Máy dev đã có tiến trình khác chiếm cổng 8080/9000/9001 (phát hiện khi `docker compose up` báo "port is already allocated"). Cổng mới ít khả năng đụng độ với service phổ biến khác. `.env` và `.env.example` cùng cập nhật.

## ADR-009 — Mock data dùng `reactive()`, không phải mảng tĩnh
- **Quyết định:** `mockFilms`, `categoryTree`, `mockUsers` (GĐ 0.5) đều là `reactive([...])` export từ module, không phải `const [...]` tĩnh.
- **Lý do:** Cho phép form Thêm/Sửa phim, Chuyên mục, Quản trị người dùng "hoạt động thật" trong phiên demo (thêm 1 phim → thấy ngay trong Kho phim) mà không cần backend — giúp Review Gate trực quan hơn nhiều so với mock tĩnh chỉ đọc.

## ADR-008 — VideoPlayer: native controls + iframe chính thức, không tự vẽ lại
- **Quyết định:** Nguồn `storage` dùng `<video controls>` gốc trình duyệt (đã có sẵn play/pause/tua/âm lượng/toàn màn hình); YouTube/Vimeo nhúng iframe player chính thức của họ; Google Drive/MISA Drive không nhúng, chỉ mở link ngoài.
- **Lý do:** MDS chưa có component Player chuyên dụng; tự vẽ lại control (progress bar, volume slider...) tốn công và dễ sai lệch hành vi bàn phím/accessibility so với control gốc đã được trình duyệt/nền tảng tối ưu sẵn. Việc "chưa nhúng ổn định được" GDrive/MISA Drive được note rõ trong code (TODO), không giả vờ đã xong.



## ADR-007 — Chiến lược UI-first + Review Gate
- **Quyết định:** Dựng UI xem được sớm bằng mock data, chốt giao diện trước khi làm backend; mỗi GĐ có UI đều qua Review Gate (preview + ảnh chụp duyệt).
- **Lý do:** Giảm token/thời gian, tránh làm xong hết mới sửa; hợp module hoá (backend chỉ thay mock bằng API).

## ADR-006 — Tailwind v4 + theme MDS runtime
- **Quyết định:** Dùng Tailwind v4 (@tailwindcss/vite); bộ MDS copy-in vào `src/components/mds`; theme blue mặc định, đổi qua `data-mds-theme`.
- **Lý do:** MDS hỗ trợ Tailwind v3/v4; v4 cấu hình gọn qua plugin Vite; giữ nguyên token MDS, không tự chế màu.

## ADR-005 — Model versioning cho "cập nhật bản mới"
- **Quyết định:** Tách `film_versions`; `films` giữ metadata + trỏ version hiện hành.
- **Lý do:** Update trùng tiêu đề tạo version mới, giữ lịch sử, dễ rollback, gắn lại tag "mới".

## ADR-004 — Storage tách rời qua MinIO (S3 API)
- **Quyết định:** Dùng MinIO thay vì lưu thẳng volume.
- **Lý do:** File video lớn, hỗ trợ range streaming, dễ migrate sang AMIS Drive/S3 khi bàn giao.

## ADR-003 — Auth nội bộ JWT, để chỗ cắm OIDC
- **Quyết định:** Prototype dùng JWT + seed super_admin; module `auth` thiết kế sẵn interface cho OIDC.
- **Lý do:** Chưa có quyền AMIS; tránh làm lại khi DevOps cắm SSO.

## ADR-002 — RBAC = RolesGuard + OwnerGuard
- **Quyết định:** Phân quyền 2 tầng: theo role + theo chủ sở hữu resource.
- **Lý do:** Nhân viên chỉ sửa/xoá phim của mình → cần kiểm tra owner ở tầng service, không chỉ route.

## ADR-001 — NestJS module hoá
- **Quyết định:** Backend NestJS, mỗi domain 1 module độc lập; giao tiếp qua service export.
- **Lý do:** Yêu cầu "sửa 1 vùng ảnh hưởng tối thiểu"; NestJS DI + module là fit tự nhiên.

## ADR-000 — Stack: NestJS + MySQL + MinIO + Vue/Tailwind/MDS
- **Quyết định:** Chốt theo lựa chọn chủ đầu tư 2026-07-21.
- **Lý do:** Cùng hệ JS FE-BE (dễ Claude Code), MySQL hợp dữ liệu quan hệ/phân quyền, MinIO hợp video lớn.
