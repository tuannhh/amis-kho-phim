# AMIS Kho phim — Progress Log

> Nhật ký "đã làm gì". Cập nhật MỖI khi hoàn thành một việc đáng kể.
> Format: `YYYY-MM-DD — [GĐ x] mô tả — trạng thái`.

## Trạng thái tổng
- Giai đoạn hiện tại: **GĐ 1 — Auth & RBAC (bắt đầu)** — GĐ 0.5 đã CHỐT & duyệt.
- % hoàn thành tổng thể: ~35%

## Nhật ký
- 2026-07-21 — [GĐ 0] Chốt stack: NestJS + MySQL + MinIO, FE Vue3+Tailwind+MDS, PWA, Docker — DONE
- 2026-07-21 — [GĐ 0] Khởi tạo memory bank + chiến lược UI-first (Review Gate mỗi GĐ) — DONE
- 2026-07-21 — [GĐ 0] Scaffold FE: Vite Vue3-TS + Tailwind v4 + copy bộ MDS (37 file) + tokens, theme blue — DONE
- 2026-07-21 — [GĐ 0] App shell: MHeaderBar (brand) + MSidebar + vue-router (5 route) + PagePlaceholder — DONE
- 2026-07-21 — [GĐ 0] Chạy dev server (port 5180), verify: shell render đúng MDS, router hoạt động, tiếng Việt OK, 0 lỗi console — DONE
- 2026-07-21 — [GĐ 0] Backend NestJS skeleton: main.ts (prefix /api, UTF-8, CORS, ValidationPipe) + app.module (TypeORM MySQL conditional) + health controller — DONE
- 2026-07-21 — [GĐ 0] Docker: docker-compose (mysql+minio+backend+frontend+nginx), Dockerfile BE/FE, nginx reverse proxy (/api,/media range), .env.example — `docker compose config` hợp lệ — DONE
- 2026-07-21 — [GĐ 0] CHƯA chạy `docker compose up --build` đầy đủ (nặng/tốn thời gian) — chờ chủ đầu tư yêu cầu; backend chưa `npm install` — sẽ cài khi build docker / vào GĐ 1
- 2026-07-21 — [GĐ 0.5] Màn **Kho phim** (danh sách): grid card 16:9, tag Phim mới, lọc chuyên mục/tìm kiếm/chỉ-phim-mới, mock 9 phim đủ 6 chuyên mục — DONE, verify browser OK
- 2026-07-21 — [GĐ 0.5] Component **VideoPlayer** dùng chung (đa nguồn: storage `<video controls>`, YouTube/Vimeo iframe embed chính thức, GDrive/MISA Drive nút mở link ngoài) + nút chọn nguồn — DONE
- 2026-07-21 — [GĐ 0.5] Màn **Chi tiết/Xem phim** `/films/:slug`: player + mô tả + hashtag + lượt xem + tải về + nút Sửa/Xoá ghim phải theo quyền (owner/admin) — DONE, verify browser (play/pause/fullscreen/volume có sẵn qua `<video controls>` gốc, chuyển nguồn hoạt động)
- 2026-07-21 — [GĐ 0.5] Màn **Thêm/Sửa phim**: form 2 cột, MUpload file+thumbnail (preview ảnh thật qua object URL), 4 link riêng (YouTube/Vimeo/GDrive/MISA Drive), hashtag MCombobox allowCreate, cảnh báo trùng tiêu đề + MDialog xác nhận cập nhật bản mới → gắn lại tag Phim mới — DONE, verify browser (publish thành công, phim mới xuất hiện ngay trong Kho phim nhờ `reactive` store)
- 2026-07-21 — [GĐ 0.5] Màn **Chuyên mục**: Master-Detail (MTree cha-con bên trái + form thêm/sửa/xoá bên phải) — DONE, verify browser (chọn node con load đúng form)
- 2026-07-21 — [GĐ 0.5] Màn **Quản trị người dùng**: MDataTable + MTag vai trò (Super Admin/Admin/Nhân viên màu khác nhau) + dialog tạo user (option vai trò theo đúng ma trận phân quyền — Super Admin tạo Admin+NV, Admin chỉ tạo NV) + khoá/mở khoá/xoá theo quyền — DONE, verify browser (tạo user mới thành công, quyền ẩn/hiện nút đúng)
- 2026-07-21 — [GĐ 0.5] **3 lỗi thật phát hiện & sửa khi verify trên trình duyệt** (không chỉ đọc code):
  1. `MIcon :size="14"` sai (chỉ nhận 12/16/20/28...) — dùng ở nhiều nơi kể cả trong 2 file gốc của skill (MUpload.vue, MTree.vue) → sửa hết về `12`.
  2. Cho phép "Xuất bản" phim không có file/link nào → trang chi tiết hiển thị rỗng vô nghĩa → thêm validate bắt buộc ≥1 nguồn trước khi xuất bản + fallback UI "Chưa có nguồn phát nào" trong VideoPlayer.
  3. `MDialog v-model="!!deleteTarget"` là lỗi cú pháp (v-model cần ref gán được) → chuyển sang `:model-value`/`@update:model-value`.

- 2026-07-21 — [GĐ 0.5] Feedback chủ đầu tư sau khi xem preview → sửa 2 điểm UI (FilmListView + VideoPlayer):
  1. Tag "Phim mới" chuyển từ đè lên thumbnail xuống hàng tag cạnh chuyên mục (luôn thấy rõ kể cả khi có ảnh bìa thật, không lẫn màu).
  2. Thêm nút **Copy link** cho từng nguồn (Nội bộ/YouTube/Vimeo/GDrive/MISA Drive) — ở cả thẻ danh sách (Kho phim) và player (Chi tiết phim), dùng `navigator.clipboard.writeText` + toast xác nhận. Đã verify browser cả 2 trang, không lỗi.

- 2026-07-21 — [GĐ 0.5] Feedback đợt 2 (chủ đầu tư):
  1. **Gộp về 1 ô tìm kiếm duy nhất**: bỏ ô search trong toolbar trang Kho phim; dùng ô search trên MHeaderBar (Enter để tìm) qua state chung `features/films/searchState.ts` (`filmSearchQuery`). Trang Kho phim hiện chip từ khoá đang lọc + nút xoá. Verify browser: gõ "MISA Cup" + Enter → còn 1 phim, xoá chip → 9 phim.
     - *Hạn chế đã biết*: ô header giữ text sau khi xoá chip (MHeaderBar quản text nội bộ, không expose v-model — không sửa sâu vào component MDS gốc). Chấp nhận ở GĐ 0.5.
  2. **Định nghĩa "Phim mới"**: bỏ cờ tĩnh `isNew`, thay bằng hàm `isFilmNew(film)` tính động theo `publishedAt` + `NEW_FILM_TTL_DAYS=14` (khớp .env.example). Phim = "mới" nếu xuất bản/cập nhật bản mới trong vòng 14 ngày. Áp dụng ở FilmListView + FilmDetailView + form upload (chỉ set `publishedAt=hôm nay`). GĐ 2+ backend tính đúng qua query/job.

- 2026-07-21 — [GĐ 0.5] Feedback đợt 3 (chủ đầu tư) → sửa & verify browser:
  1. Filter chuyên mục thêm option **"Tất cả chuyên mục"** (value null) ở đầu → quay lại xem toàn bộ được. Verify: chọn "Giới thiệu sản phẩm" (2 phim) → "Tất cả" (9 phim).
  2. **Logo/tên app trên header bấm về trang chủ** (@logo-click → route films). Verify từ trang Chuyên mục → /films.
  3. **Phân trang trang chủ**: chọn 20/30/50 phim/trang + prev/next (chuẩn MDS không đánh số trang) + dòng "1–N / tổng phim". **Luôn sắp phim mới nhất (publishedAt giảm dần) lên đầu.**
- 2026-07-21 — [GĐ 0.5] Ghi nhận yêu cầu tương lai: **báo cáo Quản trị người dùng theo giai đoạn** (ai upload bao nhiêu phim, gồm phim gì) — thêm vào roadmap GĐ 5, chưa làm ở GĐ 0.5.
- 2026-07-21 — [GĐ 0.5] ✅ CHỐT UI — chủ đầu tư duyệt "còn lại OK". Chuyển sang GĐ 1.

## Việc tiếp theo (next actions)
1. **GĐ 1 (Auth & RBAC)** — model **Opus 4.8** (đã đổi). Backend thật: JWT login, seed super_admin, 3 role, RolesGuard + OwnerGuard, CRUD users; FE thay mock auth/admin bằng API thật.
2. Push GitHub `amis-kho-phim` (private) làm mốc trước khi vào backend.
3. (Tuỳ chọn) `docker compose up -d --build` verify toàn stack.
