# AMIS Kho phim — Active Context

> "Đang làm gì ngay lúc này". File đọc đầu tiên khi mở lại phiên làm việc
> (đặc biệt sau khi clear context — đọc file này trước, không cần đọc lại lịch sử chat).

## Tóm tắt nhanh (đọc 30 giây là hiểu hết)

### ⭐ DỰ ÁN ĐÃ HOÀN THÀNH TOÀN BỘ ROADMAP CHÍNH (GĐ 0 → GĐ 7)
- **GĐ 7 — Hardening & Handoff ĐÃ XONG (2026-07-29, Opus 5)** — đây là giai đoạn CUỐI của
  `03-roadmap.md`. Không còn giai đoạn nào phía sau.
- **Việc treo DUY NHẤT còn lại** (không thuộc roadmap chính): hoàn thiện **GĐ 6.1 — SSO AMIS
  Mobile** khi đội AMIS Mobile cung cấp spec bridge thật. Toàn bộ checklist những gì cần họ
  xác nhận và những gì cần code sau đó đã gom sẵn ở **`docs/devops-handoff.md` mục 6** —
  đọc mục đó, không cần lần lại ADR-029/030.
- **Trạng thái commit**: GĐ 4, 5, 6, 6.1, 7 đang là commit LOCAL, **CHƯA push** (chờ xác nhận
  của người dùng). GĐ 3 và trước đó đã lên GitHub `main`.

### GĐ 7 đã làm gì (chi tiết đầy đủ ở `04-progress.md` mục "Nhật ký GĐ 7")
- **Áp dụng skill `misa-backend-standard`** (Quy chuẩn Backend MISA, ở
  `~/.claude/skills/misa-backend-standard`) làm khung chuẩn. **Phiên sau sửa backend PHẢI
  dùng lại skill này.** Đánh giá an ninh bám đúng khung 9 mục của
  `references/02-security-baseline.md`.
- **Đã sửa 12 vấn đề bảo mật/vận hành.** Nghiêm trọng nhất: JWT secret mặc định `change-me`
  nằm công khai trong repo (ai đọc code cũng tự ký được token super_admin) → nay có cơ chế
  **từ chối khởi động** khi cấu hình còn giá trị mặc định. Cùng với: rate limit đăng nhập,
  ép cứng thuật toán JWT, chống CSV injection, helmet + security header, siết CORS, chống dò
  tài khoản qua thời gian phản hồi, nhật ký kiểm toán, `npm ci` chống supply-chain,
  liveness/readiness tách riêng, tắt có kiểm soát.
- **Còn treo 11 rủi ro** (đều là đổi kiến trúc / phá vỡ hợp đồng API / cần quyết định nghiệp
  vụ) — bảng đầy đủ kèm bằng chứng `file:dòng` và lý do KHÔNG tự sửa ở
  **`docs/danh-gia-an-ninh.md`**. Nghiêm trọng nhất là **R-09**: `/media/:key` công khai chỉ
  dựa vào UUID khó đoán — nên đổi sang presigned GET ngắn hạn trước khi mở cho toàn công ty
  nếu kho phim có nội dung nhạy cảm.
- **Test: từ 0 lên 152** (126 BE với Jest + 26 FE với Vitest). Trước GĐ7 dự án **không có
  test nào**. Ưu tiên phủ phần rủi ro cao (guard, RBAC, owner policy/IDOR, auth, SSO, chốt
  chặn cấu hình, CSV), cố ý không phủ CRUD đơn giản.
- **Tài liệu mới**: `docs/danh-gia-an-ninh.md`, `docs/api-overview.md`,
  `docs/quy-trinh-noi-bo.md`, `docs/devops-handoff.md`, Swagger `/api/docs` (tắt ở production),
  và `memory-bank/11-coding-rules.md` (quy tắc riêng dự án, theo mandate của skill).

### ⚠️ BA ĐIỀU DỄ HIỂU NHẦM NHẤT — đọc trước khi sửa gì
1. **Stack dev chạy `NODE_ENV=production`** (Dockerfile pin sẵn). Vì vậy cổng chặn cấu hình
   là biến riêng **`ALLOW_INSECURE_CONFIG`**, không phải `NODE_ENV` (ADR-032). Log backend in
   6 dòng cảnh báo "[CHẶN Ở MÔI TRƯỜNG THẬT]" mỗi lần khởi động — **đó là bình thường ở dev**,
   không phải lỗi.
2. **Sửa `nginx/nginx.conf` phải `docker compose restart nginx`** — file mount read-only,
   `up -d --build` không nạp lại config.
3. **Chuông thông báo luôn rỗng là CHỦ ĐÍCH** (tắt từ 2026-07-22 để tránh spam), không phải bug.

Danh sách đầy đủ các bẫy loại này: **`memory-bank/11-coding-rules.md`** — đọc file đó trước
khi sửa code, sẽ tiết kiệm rất nhiều thời gian.

### Giới hạn đã biết của GĐ 7 (nói rõ, không giấu)
- **Chưa có integration test chạy DB thật** và **chưa có load/concurrency test**. Bộ test hiện
  tại toàn bộ là unit test có mock. Luồng đếm lượt xem (`recordView`) tuy đã dùng `increment()`
  atomic nhưng **chưa được kiểm dưới tải đồng thời thật** như `07-testing-strategy §1` yêu cầu.
- **Chưa có test component UI** (chưa cài `@vue/test-utils`) — UI vẫn dựa vào kiểm thủ công
  trên trình duyệt qua từng Review Gate.
- **Chưa kiểm trên thiết bị di động thật** (iOS Safari / Android Chrome) — tồn đọng từ GĐ 6.
- **Chưa có CI**, nên `npm audit` và bộ test chưa chạy tự động (đã đề xuất ở
  `docs/devops-handoff.md` mục 10).
- **`npm audit` còn cảnh báo** chủ yếu từ `multer@1.x` mà NestJS 10 kéo theo — khắc phục cần
  nâng NestJS lên major mới, phải làm ở nhánh riêng (rủi ro R-05).

### Các giai đoạn trước (tóm tắt — chi tiết ở `04-progress.md`)
- **GĐ 6.1**: scaffold nhúng AMIS Mobile (WebView+bridge), **TẮT mặc định**, chờ spec thật.
  `POST /auth/sso/amis-mobile` + `frontend/src/lib/amisBridge.ts`. ADR-029/030.
- **GĐ 6**: PWA (`vite-plugin-pwa`, `registerType:'prompt'`), window size class, bottom
  navigation ở Compact (<600px). ADR-027/028.
- **GĐ 5**: thông báo phim mới (đã tắt) + báo cáo Quản trị CSV. ADR-024/025/026.
- **GĐ 4**: đếm lượt xem thật (`film_views`), dedupe theo user 30 phút. ADR-023.
- **GĐ 3**: MinIO thật — presigned PUT, stream Range 206, `film_versions`. ADR-019/020/021/022.
- **GĐ 2**: chuyên mục + phim core, owner policy `assertCanManage`. ADR-015/016/017/018.
- **GĐ 1**: Auth & RBAC (JWT access 15' + refresh 7d). ADR-011/012/013/014.
- **Đăng nhập** (seed từ .env): `superadmin@misa.com.vn` / `Admin@12345` (**đổi ở prod!**).
- **DB hiện có 1 phim** ("Phim Giới thiệu Tập đoàn MISA", nguồn YouTube). Dữ liệu test tạo
  trong lúc verify GĐ7 đã được dọn sạch.

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

## GĐ 2 — checklist (Chuyên mục & Phim core) — ✅ ĐÃ XONG (2026-07-21)
- [x] BE CategoriesModule: entity + CRUD /api/categories (cây cha-con), @Roles super/admin cho ghi
- [x] BE FilmsModule: entity films + slug, CRUD /api/films (metadata + link ngoài, chưa file)
- [x] BE **OwnerGuard** thật: `FilmsService.assertCanManage` — nhân viên chỉ sửa/xoá phim mình (ADR-002/014)
- [x] FE: CategoryView + FilmListView + FilmDetailView + FilmUploadView nối API thật; xoá mock 2 file
- [x] Giữ UI đã duyệt; UTF-8 tiếng Việt; Review Gate (curl RBAC + browser: tạo cây chuyên mục,
  xuất bản phim YouTube, nhân viên không thấy nút Sửa/Xoá phim người khác)

## GĐ 3 — checklist (Storage & Thumbnail, MinIO thật) — ✅ ĐÃ XONG (2026-07-21)
- [x] BE StorageModule: `@aws-sdk/client-s3` tới MinIO, presigned PUT (video) + multipart (thumbnail)
- [x] BE stream Range (206 Partial Content) `/media/:key` (ngoài prefix /api, khớp nginx /media/)
- [x] Bảng `film_versions` (migration `AddFilmVersions`); films trỏ bản mới nhất → storage/thumbnail
- [x] FE FilmUploadView: luồng upload THẬT (presigned PUT có progress → thumbnail → confirmVersion), xoá TODO
- [x] FE VideoPlayer: nguồn `storage` dùng `<video src="/media/:key">` thật; FilmListView thumbnail thật
- [x] Validate thumbnail 16:9 (image-size magic bytes) + MIME video + MAX_UPLOAD_MB — enforce ở BE
- [x] RBAC dùng lại `assertCanManage` cho mọi thao tác storage (verify nhân viên→403)
- [x] Review Gate: Docker up, presigned PUT từ trình duyệt→MinIO 200 (CORS OK), Range 206, F5 vẫn còn

## GĐ 4 — checklist (Player & Link ngoài & View) — ✅ ĐÃ XONG (2026-07-21)
- [x] BE bảng `film_views` (id, film_id, user_id?, session_hash, viewed_at) + migration `AddFilmViews`
- [x] BE đếm view: `POST /films/:id/view`, dedupe theo user_id cửa sổ 30' → tăng films.view_count atomic
- [x] FE gọi API tăng view khi mở trang xem (onMounted, 1 lần/slug); hiển thị lượt xem thật ngay
- [x] Rà lại player đa nguồn + nút link theo nguồn (đã có từ GĐ0.5/GĐ3) — không có bug thật
- [x] Review Gate: Docker up, mở phim → +1; F5 nhiều lần trong 30' không tăng thêm (verify browser
  + SQL); gọi API 3 lần liên tiếp trên phim khác → chỉ tăng lần đầu; 0 lỗi console

## Cấu trúc code hiện tại (đã hết mock — API thật GĐ1→GĐ4)
- `frontend/src/features/films/filmTypes.ts` — FilmSource (gồm 'storage'), SOURCE_LABEL/ICON,
  categoryColorFor, thumbnailGradient (fallback khi chưa có ảnh bìa), isFilmNew/formatVNDate
- `frontend/src/features/films/filmsApi.ts` — CRUD + createUploadUrl/uploadThumbnail/confirmVersion +
  **[GĐ4]** `recordView(id)`; `ApiFilm` có `thumbnailUrl`. `filmsStore.ts` (Pinia, refetch sau mutation)
- `frontend/src/features/films/FilmDetailView.vue` — **[GĐ4]** gọi `recordView` 1 lần trong
  `onMounted` sau khi load phim xong (biến `viewedSlug` chống gọi lại khi chỉ re-render)
- `frontend/src/features/films/storageUpload.ts` — **[GĐ3]** putToStorage (XHR PUT presigned có
  progress), readVideoDuration (có timeout — ADR-022), formatDuration
- `frontend/src/features/upload/FilmUploadView.vue` — **[GĐ3]** luồng upload thật (progress/lỗi qua MUpload)
- `frontend/src/components/VideoPlayer.vue` — player đa nguồn; storage dùng `<video src=/media/:key>` thật
- `frontend/src/lib/http.ts` — apiFetch; **[GĐ3]** bỏ ép Content-Type khi body là FormData
- Backend `modules/storage/` — **[GĐ3]** StorageService (2 S3Client: internal+presigner),
  MediaController (`/media/:key` Range 206, @Public, ngoài prefix /api)
- Backend `modules/films/` — Film/FilmLink/Hashtag + FilmVersion (GĐ3) + **[GĐ4]** FilmView entity
  (`film-view.entity.ts`); FilmsController thêm upload-url/thumbnail/versions + **[GĐ4]** `:id/view`;
  FilmsService.toPublic lấy version mới nhất → storage/thumbnail; `recordView`/`sessionHashOf` (GĐ4)
- Backend `modules/categories/` — cây cha-con (ADR-016 bảng riêng, không JSON column)
- Migrations: InitAuth → InitCatalog → AddFilmVersions → **AddFilmViews** (đăng ký tường minh
  trong `db-options.ts`)

## Quyết định đã chốt (xem đầy đủ ở 05-decisions.md)
- ORM: **TypeORM**. Nginx dùng từ GĐ 0. Tailwind **v4**. Theme MDS blue mặc định.
- Slug (category/film) tự sinh ở BE + hậu tố số nếu trùng — FE không tự gửi slug (ADR-015).
- Cổng Docker: `NGINX_PORT=8180`, `MINIO_API_PORT=9200`, `MINIO_CONSOLE_PORT=9201` — đã đổi
  khỏi mặc định vì trùng tiến trình khác trên máy dev (ADR-010).
- `tsconfig.app.json` cần `paths: {"@/*": [...]}` + `allowJs: true` để `vue-tsc` build production
  qua được (dev server Vite không cần, chỉ transpile) — đừng xoá 2 dòng này.
- Component MDS gốc dùng `null` cho "chưa chọn" nhưng MSelect không nhận `null` trong kiểu
  `modelValue` khi dùng từ TS — toàn bộ state "chưa chọn" trong dự án dùng `undefined`, không `null`.
- Backend TypeScript bật `erasableSyntaxOnly`-tương-tự ở FE (vue-tsc) — KHÔNG dùng parameter
  property trong constructor class lỗi (`ApiError`), khai báo field tường minh.
- `retryAttempts`/`retryDelay` là mở rộng riêng của Nest — chỉ thêm khi gọi `TypeOrmModule.forRoot`,
  KHÔNG để trong `DataSourceOptions` dùng chung cho CLI migration (fail typecheck).

## Lưu ý khi làm việc
- UI: BẮT BUỘC gọi skill `misa-design-system` mỗi khi dựng/sửa giao diện.
- Kế thừa bài học bảo mật từ project AMIS Kho ảnh v2 (kiểm quyền ở BE, owner policy).
- Mọi thay đổi schema → migration, không sửa tay.
- Sau mỗi việc đáng kể: cập nhật `04-progress.md`; quyết định lớn → `05-decisions.md`.
- Trước khi báo "xong" UI: tự bấm/test thật trên browser — đừng chỉ đọc code hoặc tin cấu hình
  đúng trên giấy. Lưu ý công cụ browser tool: toạ độ click phải lấy từ `read_page`/`find` (ref),
  KHÔNG áng chừng toạ độ từ ảnh chụp — screenshot-space và viewport-space có thể không khớp 1:1,
  suýt bị hiểu nhầm thành bug thật khi test GĐ2 (chọn dropdown "Chuyên mục cha" không cập nhật).
- Đừng để form "giả vờ đã lưu" khi thực ra chưa có backend support (vd storage GĐ2→GĐ3) —
  luôn ghi chú rõ giới hạn cho người dùng (ADR-018).

## Con trỏ nhanh
- Brief: `00-projectbrief.md` · Kiến trúc: `01-architecture.md` · Stack: `02-techContext.md`
- Roadmap+model: `03-roadmap.md` · Tiến độ: `04-progress.md` · Quyết định: `05-decisions.md`
- **Quy tắc code riêng + bẫy kỹ thuật: `11-coding-rules.md`** (tạo ở GĐ7 — đọc trước khi sửa code)
- Tài liệu bàn giao (ngoài memory-bank): `docs/danh-gia-an-ninh.md` · `docs/api-overview.md`
  · `docs/quy-trinh-noi-bo.md` · `docs/devops-handoff.md`
- Quy chuẩn backend BẮT BUỘC: skill `misa-backend-standard`
