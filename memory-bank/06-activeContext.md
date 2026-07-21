# AMIS Kho phim — Active Context

> "Đang làm gì ngay lúc này". File đọc đầu tiên khi mở lại phiên làm việc.

## Focus hiện tại
GĐ 0.5 (UI Prototype) ĐÃ CHỐT & duyệt. Đã push GitHub `amis-kho-phim` (private).
**Docker toàn stack đã verify chạy thật** (5 container Up/healthy, build production
FE+BE thành công, xem chi tiết 04-progress.md mục "Docker"). Đã tạo sẵn 6 task GĐ 1
(BE Auth/RBAC + FE Login/Users) — **chưa bắt đầu code**. Model hiện tại: Sonnet 5
(đổi sang Opus 4.8 khi thực sự viết code Auth/RBAC theo roadmap).

## Cách chạy Docker (đã verify — cổng đã đổi, xem ADR-010)
```
cd /Users/tuanbui/amis-kho-phim
docker compose up -d --build   # lần đầu / sau khi sửa code
docker compose up -d           # các lần sau (không build lại)
docker compose down            # tắt hết khi không dùng
```
Truy cập: http://localhost:8180 (FE qua nginx) · http://localhost:8180/api/health (BE).
MinIO console: http://localhost:9201 (minioadmin/minioadmin).

## GĐ 1 — checklist (Auth & RBAC)
- [ ] Backend: UsersModule + entity User (role_code, created_by, is_active, password_hash argon2/bcrypt)
- [ ] AuthModule: POST /api/auth/login (JWT access+refresh), guard JWT, chỗ cắm OIDC sau
- [ ] RBAC: RolesGuard (@Roles) + OwnerGuard; seed super_admin lúc khởi động (từ .env)
- [ ] Migration TypeORM cho bảng users/roles; chạy được trong Docker (backend + mysql)
- [ ] FE: màn Login; Pinia auth store (token, user, role); router guard; thay CURRENT_MOCK_USER bằng user thật
- [ ] Màn Quản trị người dùng: thay mockUsers bằng API /api/users (tạo/khoá/xoá theo quyền)
- [ ] Review Gate: đăng nhập super_admin → tạo admin → tạo nhân viên; kiểm quyền ở BE
- Bảo mật: kiểm quyền ở BE (không tin FE), owner policy ở tầng service — kế thừa bài học AMIS Kho ảnh v2.

## Cấu trúc code GĐ 0.5 (mock, sẽ thay dần bằng API thật)
- `features/films/mockFilms.ts` — reactive mock phim + toSlug/colorForCategory/CURRENT_MOCK_USER
- `features/categories/mockCategories.ts` — reactive cây chuyên mục cha-con
- `features/admin/mockUsers.ts` — reactive mock user + creatableRoles() (ma trận phân quyền)
- `components/VideoPlayer.vue` — player đa nguồn dùng chung (film-detail + sau này có thể tái dùng)
- Khi làm GĐ 2+: giữ nguyên UI, chỉ thay các hàm mock bằng gọi API thật (đúng tinh thần module hoá/UI-first).

## Cách chạy nhanh (dev)
- FE dev: `cd frontend && npm run dev -- --port 5180` → http://localhost:5180 (đã có config launch `kho-phim-fe`).
- Toàn stack Docker: `cp .env.example .env && docker compose up -d --build` → http://localhost:8080.
- BE chưa `npm install` local (mới chạy trong Docker) — cần dev BE local thì `cd backend && npm install`.

## Quyết định đã chốt ở GĐ 0
- ORM: **TypeORM** (hợp NestJS + migration). ✔
- **Dùng nginx ngay từ GĐ 0** để URL /api + /media chuẩn từ đầu. ✔
- Tailwind **v4** (@tailwindcss/vite). Theme MDS blue mặc định, đổi runtime qua data-mds-theme.

## Lưu ý khi làm việc
- UI: BẮT BUỘC gọi skill `misa-design-system` mỗi khi dựng/sửa giao diện.
- Kế thừa bài học bảo mật từ project AMIS Kho ảnh v2 (kiểm quyền ở BE, owner policy).
- Mọi thay đổi schema → migration, không sửa tay.
- Sau mỗi việc đáng kể: cập nhật `04-progress.md`; quyết định lớn → `05-decisions.md`.

## Con trỏ nhanh
- Brief: `00-projectbrief.md` · Kiến trúc: `01-architecture.md` · Stack: `02-techContext.md`
- Roadmap+model: `03-roadmap.md` · Tiến độ: `04-progress.md` · Quyết định: `05-decisions.md`
