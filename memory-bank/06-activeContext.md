# AMIS Kho phim — Active Context

> "Đang làm gì ngay lúc này". File đọc đầu tiên khi mở lại phiên làm việc
> (đặc biệt sau khi clear context — đọc file này trước, không cần đọc lại lịch sử chat).

## Tóm tắt nhanh (đọc 30 giây là hiểu hết)
- **Đã xong**: GĐ 0 + 0.5 (UI mock) + 1 (Auth & RBAC) + 2 (Chuyên mục & Phim core) + **GĐ 3
  (Storage & Thumbnail, MinIO THẬT)** — GĐ 3 verify end-to-end Docker + trình duyệt (2026-07-21,
  Opus 4.8). Chi tiết: 04-progress.md "Nhật ký GĐ 3"; quyết định: ADR-019→022 (05-decisions.md).
- **GĐ 3 làm gì**: `StorageModule` (S3 client `@aws-sdk/client-s3` tới MinIO; presigned PUT cho
  video upload thẳng từ FE; MediaController `/media/:key` stream Range 206). Bảng `film_versions`
  (migration `AddFilmVersions`) giữ storage_key/thumbnail_key/duration; `films` trỏ bản mới nhất.
  Endpoint (trong FilmsModule, tái dùng `assertCanManage`): `POST /films/:id/upload-url` (presigned,
  validate MIME+size), `/thumbnail` (multipart, validate 16:9), `/versions` (confirm, head-check
  key). FE: FilmUploadView luồng upload thật (progress), VideoPlayer `<video src=/media/:key>`
  thật, FilmListView hiện thumbnail thật. **ADR-018 hết hiệu lực** (giờ persist thật).
- **Đăng nhập** (seed từ .env): `superadmin@misa.com.vn` / `Admin@12345` (đổi ở prod!).
- **DB hiện SẠCH**: sau verify đã xoá hết dữ liệu test qua API (0 phim/chuyên mục, chỉ seed
  super_admin). Volume GIỮ NGUYÊN (`docker compose down` không `-v`). Bucket `kho-phim` còn vài
  object test mồ côi trong MinIO — vô hại.
- **Env mới**: `MINIO_PUBLIC_ENDPOINT=http://localhost:9200` (endpoint trình duyệt gọi để upload
  presigned; đã thêm .env/.env.example/docker-compose). Đổi thành domain thật khi lên production.
- **Chưa push**: commit local GĐ 3 (xem `git log`). Push cần người dùng xác nhận riêng.
- **Việc tiếp theo — GĐ 4 (Player & Link ngoài & View)**: đếm lượt xem (bảng `film_views`, dedupe
  session), hoàn thiện trang xem, nút link theo nguồn. Nhiều phần player đa nguồn đã có sẵn.
- **Model**: GĐ 4 dùng **Opus 4.8** (player) → **Sonnet 5** (nút/link) theo 03-roadmap.md.

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

## GĐ 4 — checklist (Player & Link ngoài & View) — CHƯA BẮT ĐẦU
- [ ] BE bảng `film_views` (id, film_id, user_id?, session_hash, viewed_at) + migration
- [ ] BE đếm view: ghi film_views (dedupe user_id/session_hash cửa sổ 30') → tăng films.view_count
- [ ] FE gọi API tăng view khi mở trang xem; hiển thị lượt xem thật
- [ ] Hoàn thiện player đa nguồn + nút link theo nguồn (phần lớn đã có từ GĐ0.5/GĐ3 — rà lại)
- [ ] Review Gate: mở phim nhiều lần trong 30' không tăng view trùng; đổi nguồn play OK

## Cấu trúc code hiện tại (đã hết mock — API thật GĐ1→GĐ3)
- `frontend/src/features/films/filmTypes.ts` — FilmSource (gồm 'storage'), SOURCE_LABEL/ICON,
  categoryColorFor, thumbnailGradient (fallback khi chưa có ảnh bìa), isFilmNew/formatVNDate
- `frontend/src/features/films/filmsApi.ts` — CRUD + createUploadUrl/uploadThumbnail/confirmVersion;
  `ApiFilm` có `thumbnailUrl`. `filmsStore.ts` (Pinia, refetch sau mutation)
- `frontend/src/features/films/storageUpload.ts` — **[GĐ3]** putToStorage (XHR PUT presigned có
  progress), readVideoDuration (có timeout — ADR-022), formatDuration
- `frontend/src/features/upload/FilmUploadView.vue` — **[GĐ3]** luồng upload thật (progress/lỗi qua MUpload)
- `frontend/src/components/VideoPlayer.vue` — player đa nguồn; storage dùng `<video src=/media/:key>` thật
- `frontend/src/lib/http.ts` — apiFetch; **[GĐ3]** bỏ ép Content-Type khi body là FormData
- Backend `modules/storage/` — **[GĐ3]** StorageService (2 S3Client: internal+presigner),
  MediaController (`/media/:key` Range 206, @Public, ngoài prefix /api)
- Backend `modules/films/` — Film/FilmLink/Hashtag + **[GĐ3]** FilmVersion entity; FilmsController
  thêm upload-url/thumbnail/versions; FilmsService.toPublic lấy version mới nhất → storage/thumbnail
- Backend `modules/categories/` — cây cha-con (ADR-016 bảng riêng, không JSON column)
- Migrations: InitAuth → InitCatalog → **AddFilmVersions** (đăng ký tường minh trong `db-options.ts`)

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
