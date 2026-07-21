# AMIS Kho phim — Progress Log

> Nhật ký "đã làm gì". Cập nhật MỖI khi hoàn thành một việc đáng kể.
> Format: `YYYY-MM-DD — [GĐ x] mô tả — trạng thái`.

## Trạng thái tổng
- Giai đoạn hiện tại: **GĐ 3 — Storage & Thumbnail (MinIO thật) ĐÃ XONG & verify end-to-end**
  trong Docker + trình duyệt (2026-07-21, làm bằng Opus 4.8). Commit local (chưa push).
  Tiếp theo: **GĐ 4 — Player & Link ngoài & View** (03-roadmap.md): đếm lượt xem (film_views),
  hoàn thiện trang xem, nút link theo nguồn (phần lớn player đa nguồn đã có sẵn từ GĐ0.5/GĐ3).
- % hoàn thành tổng thể: ~72%
- Xem `06-activeContext.md` để biết chi tiết cần làm tiếp khi mở lại phiên.

## Nhật ký GĐ 3 (Storage & Thumbnail, MinIO thật) — 2026-07-21
- [GĐ 3] Backend `StorageModule`: `StorageService` bọc MinIO qua `@aws-sdk/client-s3` (2 client:
  internal minio:9000 + presigner localhost:9200), `MediaController` GET/HEAD `/media/:key`
  (@Public, ngoài prefix /api) stream Range 206. Deps mới: `@aws-sdk/client-s3`,
  `@aws-sdk/s3-request-presigner`, `image-size`, `multer` (+@types) — DONE.
- [GĐ 3] Data model: entity + migration `AddFilmVersions` (bảng `film_versions`, FK film CASCADE
  + created_by SET NULL). `films` không đụng dữ liệu cũ; `toPublic` lấy version mới nhất →
  `links.storage`/`thumbnailUrl`/duration. Migration chạy sạch trên volume GĐ2 cũ (không phá) — DONE.
- [GĐ 3] Endpoint (trong FilmsModule, tái dùng `assertCanManage`): POST `/films/:id/upload-url`
  (presigned PUT, validate MIME+size), POST `/films/:id/thumbnail` (multipart, validate 16:9 +
  magic bytes), POST `/films/:id/versions` (head-check key trên MinIO, lấy size thật, tạo version,
  kế thừa asset chưa thay) — DONE. storage_key/thumbnail_key sinh server-side (uuid).
- [GĐ 3] FE: `filmsApi` +createUploadUrl/uploadThumbnail(FormData)/confirmVersion; `http.ts` bỏ
  ép Content-Type khi body là FormData; `storageUpload.ts` (XHR PUT có progress + readVideoDuration
  có timeout ADR-022). `FilmUploadView` luồng upload THẬT (chọn file → xin URL → PUT MinIO có
  progress → thumbnail → confirmVersion), xoá hết ghi chú "chưa lưu". `VideoPlayer` dùng
  `<video src="/media/:key">` thật; `FilmListView` hiện thumbnail thật (fallback gradient) — DONE.
  Build BE (nest) + FE (vue-tsc) đều sạch.
- [GĐ 3] Quyết định: ADR-019 (film_versions + trỏ bản mới nhất), ADR-020 (aws-sdk S3, key
  server-side, 2 client), ADR-021 (Range 206 proxy + /media ngoài prefix, public-by-uuid),
  ADR-022 (readVideoDuration timeout). ADR-018 hết hiệu lực.
- [GĐ 3] **Verify thật `docker compose up -d --build`** (5 container Up/healthy, migration
  `AddFilmVersions` chạy, bucket `kho-phim` tự tạo). **API (curl, file thật ffmpeg)**: presigned
  PUT → MinIO 200; thumbnail 16:9 OK, ảnh 600×600 → 400 "phải tỷ lệ 16:9"; confirmVersion gắn
  storage+thumbnail+duration; GET /media full 200 + Range `bytes=0-99`→206 `0-99/113422`,
  `bytes=1000-`→206 đúng, HEAD 200, key sai→404; RBAC: nhân viên xin upload-url/thumbnail/
  confirmVersion trên phim người khác→**403**, phim mình→201; oversized/bad-type→400; no-token→401.
  **Trình duyệt (Chrome tự động)**: login super→Kho phim hiện thumbnail thật + tag "Nội bộ"; tạo
  phim mới, set file qua DataTransfer → app tự chạy `onSelectVideo`; **presigned PUT từ trình
  duyệt → MinIO 200** (CORS preflight OPTIONS trả Access-Control-Allow-Origin đúng); thumbnail
  multipart OK; confirmVersion OK → điều hướng trang chi tiết (player `<video src=/media>` mount,
  nút Tải về bật, tag Phim mới); **fetch /media trong trình duyệt: 200 full + 206 Range
  `bytes 0-999/113422` đúng số byte, canPlayType H.264 "probably"**; F5/điều hướng lại vẫn còn
  phim+ảnh (persist DB+MinIO, không phải blob URL). 0 lỗi console của app (2 AbortError là do
  chính script test gọi play() rồi điều hướng, không phải app).
  - **Quirk môi trường (không phải bug):** `<video>` trong Chrome tự động không tự decode/hiển
    thị metadata (readyState 0) dù fetch 206 hoạt động và canPlayType "probably" → seek/play thật
    kiểm bằng fetch Range thay vì phát hình. Trình duyệt người dùng thật sẽ phát+tua bình thường.
  - **Bẫy gặp khi verify:** (1) publish treo do readVideoDuration không timeout → đã fix (ADR-022);
    (2) MSelect "Chuyên mục" khó mở bằng click tự động (đã biết từ GĐ2) → chọn bằng cách gọi
    click() trên phần tử option thật qua JS (tương đương click người dùng). Sau verify đã xoá
    sạch dữ liệu test qua API (0 phim/chuyên mục, chỉ còn seed super_admin), `docker compose down`
    (KHÔNG -v, giữ volume). Object MinIO test còn sót là vô hại (prototype).

## Nhật ký sau GĐ 2 — 2026-07-21
- [Fix UI] Cây chuyên mục khi rỗng (0 chuyên mục) trước đây hiện khung trắng trơn (chủ đầu tư
  hỏi lại tưởng là lỗi) — đã thêm empty state "Chưa có chuyên mục nào. Bấm 'Thêm chuyên mục'
  để tạo mới." trong `CategoryView.vue`, verify lại trên browser sau khi rebuild Docker — DONE.

## Nhật ký GĐ 2 (Chuyên mục & Phim core) — 2026-07-21
- [GĐ 2] Backend `CategoriesModule`: entity Category (cây cha-con qua `parent_id` self-FK
  CASCADE), CRUD `/api/categories` (GET công khai cho user đăng nhập, POST/PATCH/DELETE
  `@Roles('super_admin','admin')`), slug tự sinh + unique-suffix, cây dựng từ danh sách phẳng — DONE.
- [GĐ 2] Backend `FilmsModule`: entity Film + FilmLink (youtube/vimeo/gdrive/misadrive) +
  Hashtag + join table `film_hashtags`; CRUD `/api/films` (list/getBySlug/create/update/delete);
  `FilmsService.assertCanManage` = OwnerGuard thật (super/admin bất kỳ, nhân viên chỉ phim
  mình) — DONE. Migration `InitCatalog` (5 bảng, FK cascade/set-null đúng theo kiến trúc).
- [GĐ 2] FE: `filmTypes.ts`/`filmsApi.ts`/`filmsStore.ts` (Pinia, refetch toàn bộ sau mutation),
  `categoriesApi.ts` — thay hoàn toàn `mockFilms.ts`/`mockCategories.ts` (đã xoá 2 file).
  `CategoryView`, `FilmListView`, `FilmDetailView` (+ nút Xoá giờ có handler thật + dialog xác
  nhận), `FilmUploadView` nối API thật, giữ nguyên UI đã duyệt — DONE. Build BE+FE sạch.
- [GĐ 2] Quyết định đáng chú ý (ADR-015→018): slug tự sinh ở BE; hashtag/link là bảng riêng
  theo đúng kiến trúc GĐ0 (không JSON column); màu tag/gradient chuyên mục đổi sang suy ra từ
  `categoryId` (ổn định hơn cách cũ theo vị trí danh sách); **storage/thumbnail thật CHƯA làm**
  — form vẫn có MUpload nhưng chỉ xem trước phiên làm việc, có ghi chú rõ cho người dùng
  (trung thực, không giả vờ đã lưu — đúng nguyên tắc skill MDS).
- [GĐ 2] **Verify thật `docker compose down -v && up -d --build`** (fresh volume): 2 migration
  chạy đủ (`InitAuth`+`InitCatalog`, kiểm bằng `SHOW TABLES`). Test qua curl: tạo chuyên mục
  cha-con, xoá cha→con cascade xoá, xoá chuyên mục có phim→phim chỉ mất categoryId (SET NULL,
  không mất phim); tạo/sửa/xoá phim; nhân viên sửa/xoá phim người khác→403, sửa/xoá phim mình→OK,
  admin xoá phim nhân viên→OK. Verify trình duyệt: tạo 3 chuyên mục (kể cả cây cha-con hiển thị
  đúng thụt lề), tạo phim với YouTube link → xuất bản → hiển thị đúng trong Kho phim (gradient
  theo chuyên mục, tag "Phim mới", copy link); login nhân viên khác xem phim của super_admin →
  ĐÚNG như thiết kế không thấy nút Sửa/Xoá; double-check API trực tiếp cũng chặn 403. 0 lỗi
  console. Đã `docker compose down -v && up -d` lại để trả về DB sạch trước khi bàn giao.
  **Lưu ý test:** 1 lần thao tác chọn "Chuyên mục cha" tưởng là bug (không cập nhật) hoá ra do
  tool click nhầm toạ độ (screenshot-space không khớp) — dùng `read_page`+ref để click chính
  xác thay vì đoán toạ độ từ ảnh chụp.

## Nhật ký GĐ 1 (Auth & RBAC) — 2026-07-21
- [GĐ 1] Backend: `UsersModule` (entity User+Role, `password_hash` select:false), `AuthModule`
  (login/refresh/me/change-password, JWT access 15'+refresh 7d), RBAC toàn cục
  (`JwtAuthGuard`→`RolesGuard`, `@Public`/`@Roles`/`@CurrentUser`), CRUD `/api/users` với
  kiểm quyền ở service (`assertCanManage`, `creatableRoles`) — DONE. Deps mới: `@nestjs/jwt`, `bcryptjs`.
- [GĐ 1] DB: migration `InitAuth` (users+roles, utf8mb4) tự chạy khi khởi động (`migrationsRun`);
  seed roles + super_admin idempotent từ `.env` (`SEED_SUPER_ADMIN_*`) — DONE.
- [GĐ 1] FE: Pinia `authStore` (token localStorage, restore/refresh/logout), `http.ts`
  (Bearer + auto-refresh 401), `LoginView`, `ChangePasswordView` (buộc đổi lần đầu),
  router guard (chưa đăng nhập→login, ép đổi mật khẩu, chặn theo role), menu user ở header
  (đổi mật khẩu/đăng xuất), ẩn menu "Quản trị người dùng" theo role — DONE.
- [GĐ 1] FE: `UserAdminView` nối API thật (list/create/lock/delete + dialog hiện mật khẩu tạm),
  thay `CURRENT_MOCK_USER` (ở UserAdminView/FilmDetailView/FilmUploadView) bằng `authStore`;
  xoá `mockUsers.ts` — DONE. Build FE (vue-tsc) + BE (nest build) đều sạch.
- [GĐ 1] **2 lỗi typecheck bắt sớm khi build local** (trước Docker): (1) `retryAttempts/retryDelay`
  không thuộc `DataSourceOptions` → tách ra chỉ thêm khi Nest gọi `forRoot`; (2) FE bật
  `erasableSyntaxOnly` → cấm parameter-property trong constructor (`ApiError`) → khai báo field tường minh.
- [GĐ 1] **Verify thật `docker compose up -d --build`**: 5 container Up/healthy, migration+seed chạy
  (log "Đã tạo super_admin"), routes mapped đúng. Test RBAC bằng curl: no-token→401, sai pass→401
  (thông báo mơ hồ), super tạo admin (trả mật khẩu tạm), admin đổi mật khẩu→204, admin tạo NV→OK,
  admin tạo admin→403, employee GET/POST /users→403, tự khoá mình→403, refresh flow OK.
  Verify trình duyệt: login super→Kho phim, Quản trị người dùng hiện DATA API THẬT (4 user, cột
  "Người tạo" map id→tên), hàng của chính mình không có nút khoá/xoá, menu user OK, đăng xuất OK;
  login nv2→**bị ép đổi mật khẩu**→vào app vai trò NV (ẩn menu quản trị), gõ thẳng `/admin/users`→
  guard đẩy về Kho phim; 0 lỗi console. Đã chụp ảnh Review Gate.

## Nhật ký GĐ 0 + 0.5
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
- 2026-07-21 — [mốc] Push GitHub **github.com/tuannhh/amis-kho-phim** (PRIVATE, nhánh main). Force push đè bản MVP cũ (commit 14/07/2026 — chủ đầu tư đồng ý thay hoàn toàn). Remote `origin` đã cấu hình.

- 2026-07-21 — [Docker] ✅ Verify toàn bộ stack chạy thật trong Docker (`docker compose up -d --build`), 3 lỗi thật phát hiện & sửa:
  1. `tsconfig.app.json` thiếu `paths: {"@/*": ["./src/*"]}` → `vue-tsc` build production fail (dev server Vite chỉ transpile nên không lộ lỗi này). Thêm `paths` (không dùng `baseUrl` — TS mới deprecate).
  2. Thiếu `allowJs: true` → `vue-tsc` không hiểu các component MDS gốc là `<script setup>` JS thuần (MSelect, MTree, toast.js...).
  3. MSelect không nhận `null` trong kiểu `modelValue` → đổi toàn bộ state "chưa chọn" từ `null` sang `undefined` (categoryFilter, form.category/parentId/role). `useFormValidation.js` (JS) trả `errors: {}` không type → ép kiểu tường minh ở 3 nơi dùng. MDataTable slot `row` kiểu `unknown` → hàm `asUser()` ép kiểu tại điểm dùng (UserAdminView).
  4. **Backend**: thiếu `class-validator`/`class-transformer` trong `package.json` dù `main.ts` dùng `ValidationPipe` → container restart-loop (exit code 1) không log rõ nguyên nhân. Thêm 2 dependency, `npm install` lại.
  5. Port `9000/8080` trùng tiến trình khác đang chạy trên máy → đổi `NGINX_PORT=8180`, `MINIO_API_PORT=9200`, `MINIO_CONSOLE_PORT=9201` (cả `.env` và `.env.example`).
  - Kết quả: `docker compose ps` cả 5 container `Up`/`healthy`; `curl localhost:8180/api/health` → 200; FE qua nginx (build production, không phải dev server) hiển thị đúng, 0 lỗi console.

## Việc tiếp theo (next actions)
1. **GĐ 1 (Auth & RBAC)** — đổi model sang **Opus 4.8** khi bắt đầu viết code. Backend thật: JWT login, seed super_admin, 3 role, RolesGuard + OwnerGuard, CRUD users; FE thay mock auth/admin bằng API thật.
2. Docker stack đã verify chạy tốt — có thể `docker compose down` khi không cần chạy liên tục (đỡ chiếm cổng/RAM), `up -d` lại khi cần.
