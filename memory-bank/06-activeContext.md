# AMIS Kho phim — Active Context

> "Đang làm gì ngay lúc này". File đọc đầu tiên khi mở lại phiên làm việc
> (đặc biệt sau khi clear context — đọc file này trước, không cần đọc lại lịch sử chat).

## Tóm tắt nhanh (đọc 30 giây là hiểu hết)
- **Đã xong**: GĐ 0 (nền móng) + GĐ 0.5 (UI Prototype, mock) + **GĐ 1 (Auth & RBAC thật)** —
  GĐ 1 verify end-to-end trong Docker + trình duyệt (2026-07-21, làm bằng Opus 4.8). Chi tiết:
  04-progress.md mục "Nhật ký GĐ 1"; quyết định: ADR-011→014 trong 05-decisions.md.
- **GĐ 1 làm gì**: đăng nhập JWT (access 15'+refresh 7d), seed super_admin, 3 role, RBAC
  (RolesGuard toàn cục + owner-check ở service), CRUD `/api/users`, màn Login + đổi mật khẩu
  buộc-lần-đầu, router guard, UserAdminView nối API thật. Đã bỏ `CURRENT_MOCK_USER`/`mockUsers.ts`.
- **Đăng nhập** (seed từ .env): `superadmin@misa.com.vn` / `Admin@12345` (đổi ở prod!).
  Volume hiện có sẵn vài user test tạo lúc verify: admin1@ (Admin), nv1@/nv2@ (Nhân viên) —
  nv2 mật khẩu đã đổi thành `Nhanvien@456`. Xoá sạch làm lại: `docker compose down -v`.
- **Chưa push GitHub GĐ 1** — làm việc tiếp theo là commit (khi chủ đầu tư đồng ý). Trước GĐ1
  có 3 commit; GĐ1 chưa commit. Docker hiện **đang chạy** (chưa `down`).
- **Việc tiếp theo — GĐ 2 (Chuyên mục & Phim core, API thật)**: xem roadmap. Nguyên tắc: giữ UI
  đã duyệt, thay hàm mock (`mockCategories`, `mockFilms`) bằng gọi API; thêm FilmsModule +
  **OwnerGuard thật theo `uploader_id`** (ADR-014 đã hoãn từ GĐ1 sang đây).
- **Model**: GĐ 2 phần lớn CRUD/UI → **Sonnet 5** đủ; giữ Opus cho versioning (GĐ5)/streaming (GĐ3).

## Cách chạy lại nhanh
```bash
cd /Users/tuanbui/amis-kho-phim
docker compose up -d              # chạy lại toàn stack (đã build sẵn image)
docker compose up -d --build      # nếu vừa sửa code BE/FE
docker compose down               # tắt khi không dùng (volume vẫn giữ)
```
- Truy cập: http://localhost:8180 (FE qua nginx) · http://localhost:8180/api/health (BE)
- MinIO console: http://localhost:9201 (minioadmin/minioadmin)
- Dev FE riêng (không qua Docker, hot-reload nhanh hơn khi sửa UI):
  `cd frontend && npm run dev -- --port 5180` → http://localhost:5180
  (đã có config sẵn trong `~/.claude/launch.json` tên `kho-phim-fe`)
- Dev BE riêng: `cd backend && npm install && npm run start:dev` (cần mysql chạy qua
  `docker compose up -d mysql`)

## GĐ 1 — checklist (Auth & RBAC) — ✅ ĐÃ XONG (2026-07-21)
- [x] Backend UsersModule + entity User/Role (password_hash bcryptjs, select:false) + migration tự chạy
- [x] AuthModule: login/refresh/me/change-password (JWT access+refresh), guard JWT toàn cục, seam OIDC
- [x] RBAC: RolesGuard (@Roles) toàn cục; owner-check ở service (OwnerGuard phim hoãn GĐ2 — ADR-014); seed super_admin từ .env
- [x] Migration users/roles chạy trong Docker (migrationsRun); seed idempotent
- [x] FE: Login + đổi-mật-khẩu-buộc-lần-đầu; Pinia authStore + http.ts auto-refresh; router guard; bỏ CURRENT_MOCK_USER
- [x] UserAdminView nối API /api/users thật (tạo/khoá/xoá theo quyền + hiện mật khẩu tạm)
- [x] Review Gate: super→tạo admin→admin đổi mk→admin tạo NV; kiểm quyền BE (curl 401/403 đúng); verify browser + ảnh

## GĐ 2 — checklist (Chuyên mục & Phim core) — CHƯA BẮT ĐẦU
- [ ] BE CategoriesModule: entity + CRUD /api/categories (cây cha-con), @Roles super/admin cho ghi
- [ ] BE FilmsModule: entity films + slug, CRUD /api/films (metadata, chưa file), status draft/published
- [ ] BE **OwnerGuard** thật: nhân viên chỉ sửa/xoá phim `uploader_id === user.id` (ADR-002/014)
- [ ] FE: CategoryView + FilmListView + FilmDetailView + FilmUploadView thay mock (`mockCategories`,`mockFilms`) bằng API
- [ ] Giữ UI đã duyệt; UTF-8 tiếng Việt; Review Gate

## Cấu trúc code GĐ 0.5 (mock, sẽ thay dần bằng API thật ở GĐ 1/2)
- `frontend/src/features/films/mockFilms.ts` — reactive mock phim + toSlug/colorForCategory/
  CURRENT_MOCK_USER/isFilmNew/publishedTime (phim mới tính động theo NEW_FILM_TTL_DAYS=14 ngày)
- `frontend/src/features/films/searchState.ts` — ô tìm kiếm DUY NHẤT dùng chung (header ghi, Kho phim đọc)
- `frontend/src/features/categories/mockCategories.ts` — reactive cây chuyên mục cha-con
- `frontend/src/features/admin/mockUsers.ts` — reactive mock user + creatableRoles() (ma trận phân quyền)
- `frontend/src/components/VideoPlayer.vue` — player đa nguồn dùng chung (file-detail, tái dùng được)
- Nguyên tắc GĐ 2+: giữ nguyên UI, chỉ thay các hàm mock bằng gọi API thật (module hoá/UI-first).

## Quyết định đã chốt (xem đầy đủ ở 05-decisions.md)
- ORM: **TypeORM**. Nginx dùng từ GĐ 0. Tailwind **v4**. Theme MDS blue mặc định.
- Mock data dùng `reactive()` không phải mảng tĩnh (ADR-009) — để form demo hoạt động thật.
- Cổng Docker: `NGINX_PORT=8180`, `MINIO_API_PORT=9200`, `MINIO_CONSOLE_PORT=9201` — đã đổi
  khỏi mặc định vì trùng tiến trình khác trên máy dev (ADR-010).
- `tsconfig.app.json` cần `paths: {"@/*": [...]}` + `allowJs: true` để `vue-tsc` build production
  qua được (dev server Vite không cần, chỉ transpile) — đừng xoá 2 dòng này.
- Component MDS gốc dùng `null` cho "chưa chọn" nhưng MSelect không nhận `null` trong kiểu
  `modelValue` khi dùng từ TS — toàn bộ state "chưa chọn" trong dự án dùng `undefined`, không `null`.

## Lưu ý khi làm việc
- UI: BẮT BUỘC gọi skill `misa-design-system` mỗi khi dựng/sửa giao diện.
- Kế thừa bài học bảo mật từ project AMIS Kho ảnh v2 (kiểm quyền ở BE, owner policy).
- Mọi thay đổi schema → migration, không sửa tay.
- Sau mỗi việc đáng kể: cập nhật `04-progress.md`; quyết định lớn → `05-decisions.md`.
- Trước khi báo "xong" UI: tự bấm/test thật trên browser (đã bắt được 5+ lỗi thật kiểu này,
  xem 04-progress.md) — đừng chỉ đọc code hoặc tin cấu hình đúng trên giấy.

## Con trỏ nhanh
- Brief: `00-projectbrief.md` · Kiến trúc: `01-architecture.md` · Stack: `02-techContext.md`
- Roadmap+model: `03-roadmap.md` · Tiến độ: `04-progress.md` · Quyết định: `05-decisions.md`
