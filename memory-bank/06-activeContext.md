# AMIS Kho phim — Active Context

> "Đang làm gì ngay lúc này". File đọc đầu tiên khi mở lại phiên làm việc
> (đặc biệt sau khi clear context — đọc file này trước, không cần đọc lại lịch sử chat).

## Tóm tắt nhanh (đọc 30 giây là hiểu hết)
- **Đã xong**: GĐ 0 (nền móng Docker) + GĐ 0.5 (UI Prototype 5 màn hình, mock data) —
  đã được chủ đầu tư duyệt "còn lại OK". Đã verify **toàn bộ chạy thật trong Docker**
  (không chỉ cấu hình trên giấy — xem 04-progress.md mục "Docker" cho 5 lỗi đã sửa).
- **Đã push GitHub**: `github.com/tuannhh/amis-kho-phim` (private, nhánh `main`),
  2 commit: `e4f8aef` (nền móng+UI) và `051d894` (fix build/Docker).
- **Đang KHÔNG chạy**: đã `docker compose down` trước khi clear context để giải phóng
  máy. Volume dữ liệu (`amis-kho-phim_mysql_data`, `amis-kho-phim_minio_data`) vẫn còn.
  Chạy lại: `cd /Users/tuanbui/amis-kho-phim && docker compose up -d`.
- **Việc tiếp theo — GĐ 1 (Auth & RBAC)**: xem checklist bên dưới. **Chưa viết code
  nào của GĐ 1** — 6 task đã tạo trong TaskList của phiên trước (không còn sau clear,
  cần tạo lại nếu muốn track: xem checklist dưới để biết nội dung).
- **Model**: đang ở Sonnet 5. Đổi sang **Opus 4.8** khi bắt đầu code Auth/RBAC (việc
  phân quyền/bảo mật nhạy cảm — theo nguyên tắc chọn model trong 03-roadmap.md).

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

## GĐ 1 — checklist (Auth & RBAC) — CHƯA BẮT ĐẦU
- [ ] Backend: UsersModule + entity User (role_code, created_by, is_active, password_hash argon2/bcrypt)
- [ ] AuthModule: POST /api/auth/login (JWT access+refresh), guard JWT, chỗ cắm OIDC sau
- [ ] RBAC: RolesGuard (@Roles) + OwnerGuard; seed super_admin lúc khởi động (từ .env)
- [ ] Migration TypeORM cho bảng users/roles; chạy được trong Docker (backend + mysql)
- [ ] FE: màn Login; Pinia auth store (token, user, role); router guard; thay CURRENT_MOCK_USER bằng user thật
- [ ] Màn Quản trị người dùng: thay mockUsers bằng API /api/users (tạo/khoá/xoá theo quyền)
- [ ] Review Gate: đăng nhập super_admin → tạo admin → tạo nhân viên; kiểm quyền ở BE
- Bảo mật: kiểm quyền ở BE (không tin FE), owner policy ở tầng service — kế thừa bài học AMIS Kho ảnh v2.

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
