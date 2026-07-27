# AMIS Kho phim — Active Context

> "Đang làm gì ngay lúc này". File đọc đầu tiên khi mở lại phiên làm việc
> (đặc biệt sau khi clear context — đọc file này trước, không cần đọc lại lịch sử chat).

## Tóm tắt nhanh (đọc 30 giây là hiểu hết)
- **Đã xong**: GĐ 0 + 0.5 (UI mock) + 1 (Auth & RBAC) + 2 (Chuyên mục & Phim core) + GĐ 3
  (Storage & Thumbnail, MinIO THẬT) + GĐ 4 (Player & Link ngoài & View) + GĐ 5
  (Nghiệp vụ nâng cao: thông báo phim mới + báo cáo Quản trị CSV) + GĐ 6 (PWA & Mobile
  & MDS polish) + **GĐ 6.1 (AMIS Mobile Embed Readiness — SCAFFOLD, chờ DevOps)**
  (2026-07-27, Sonnet 5). Chi tiết: 04-progress.md "Nhật ký GĐ 6.1"; quyết định:
  ADR-029/030 (05-decisions.md).
- **GĐ 6.1 là gì — QUAN TRỌNG, ĐỌC KỸ**: đây là **scaffold/đặt chỗ, KHÔNG PHẢI tích hợp
  thật** với app khung AMIS Mobile. Phát sinh mới ngoài roadmap gốc: người dùng muốn sau
  này Kho phim nhúng vào "AMIS Mobile" (super-app nhân viên MISA) qua WebView + bridge JS,
  không phải app riêng cài từ store. Vì CHƯA có spec bridge chính thức từ đội AMIS Mobile,
  toàn bộ phần xác thực/bridge ở đây là **giả định tạm**, đã đánh dấu TODO rõ trong code,
  và **tắt theo mặc định** (an toàn — không mở lỗ hổng nào cho hệ thống đang chạy):
  - BE: `POST /auth/sso/amis-mobile` — xác minh HMAC-SHA256 tạm (không phải OIDC/JWKS thật)
    trên payload `{email, exp}`, secret đọc từ `AMIS_SSO_SHARED_SECRET` (rỗng = TẮT, trả
    501 rõ ràng). Tìm user theo email, tái dùng `issueTokens` y hệt login thường. Xem
    `backend/src/modules/auth/auth.service.ts` (method `ssoAmisMobile`/`verifySsoToken`).
  - FE: `frontend/src/lib/amisBridge.ts` — phát hiện `?embedded=1`, lấy token qua
    `window.AMISBridge?.getToken?.()` hoặc fallback query param `?ssoToken=...` (**CẢNH BÁO:
    query param lộ token trong URL — KHÔNG dùng nguyên trạng production**), expose
    `window.__khoPhimHandleNativeBack` cho nút back cứng. `App.vue` ẩn header/sidebar/
    bottom-nav khi nhúng; `authStore.restore()` thử SSO bridge trước khi rơi về LoginView
    (không khoá chết người dùng nếu bridge auth thất bại).
  - **Đã verify**: build BE+FE sạch; curl `/auth/sso/amis-mobile` không có secret → 501 (không
    500 crash); round-trip thật với secret tạm trong container test (không phải container
    chính, không set sẵn secret thật vào repo) → nhận JWT hợp lệ; browser: mặc định (không
    query param) giống hệt trước GĐ6.1, `?embedded=1` ẩn đúng header/sidebar + hiện LoginView
    full-screen khi chưa có bridge thật, 0 lỗi console.
  - **TRƯỚC KHI DÙNG THẬT**: cần đội AMIS Mobile cung cấp spec bridge chính thức (cách báo
    "đang nhúng", cách truyền token — object native/postMessage, cách xác minh danh tính —
    OIDC/JWKS...), rồi DevOps thay `verifySsoToken` (BE) và cách lấy token/phát hiện embedded
    (FE `amisBridge.ts`) cho khớp — phần cấp JWT/RBAC phía sau giữ nguyên không đổi.
- **GĐ 6 (log cũ)**: verify end-to-end Docker + trình duyệt nhiều viewport (2026-07-24,
  Sonnet 5). Chi tiết: 04-progress.md "Nhật ký GĐ 6"; quyết định: ADR-027/028.
- **GĐ 6 làm gì**: vite-plugin-pwa (`registerType:'prompt'`, manifest+icon sinh bằng
  script `scripts/generate-pwa-icons.mjs`, Workbox NetworkFirst `/api/*` + KHÔNG cache
  `/media/*`), banner Global Inline (offline/update/offline-ready) qua `MGlobalInline.vue`
  mới + `useNetworkStatus`/`usePwaUpdate` (`src/lib/`); window size class dùng chung
  (`src/lib/windowSize.ts`) — Compact (&lt;600px) bỏ `MSidebar` cố định, dùng bottom
  navigation 5 mục; `MHeaderBar` thêm prop `compact` (search icon→overlay full-width,
  Thiết lập/AVA/Chat/Hỗ trợ gộp More — KHÔNG đổi gì ở Medium/Expanded/Large);
  `NotificationsPanel` full-screen ở compact; CSS toàn cục cho touch target 48px
  (coarse pointer) + input 16px chống iOS zoom + chặn horizontal scroll toàn trang.
  Đã build production sạch + verify browser thật (không chỉ đọc code) qua 320/375/768/
  1024/1280px. **Việc tiếp theo: GĐ 7 — Hardening & Handoff** (security-review, test
  coverage, tài liệu API, hướng dẫn DevOps — xem 03-roadmap.md).
- **GĐ 5 (log cũ)**: verify end-to-end Docker + trình duyệt (2026-07-21, Sonnet 5).
  Chi tiết: 04-progress.md "Nhật ký GĐ 5"; quyết định: ADR-024/025/026.
- **GĐ 5 làm gì**: module `notifications` (bảng `notifications`+`user_notifications`,
  migration `AddNotifications`) + module `reports` (`GET /reports/films` + `?format=csv`
  BOM UTF-8, chỉ super_admin/admin, trang FE `/admin/reports` — bộ lọc người
  upload/khoảng ngày + bảng + Xuất CSV). Search hashtag: đã có sẵn từ trước, verify không
  cần sửa.
- **Thông báo "phim mới" ĐÃ TẮT** (2026-07-22, quyết định người dùng ngay sau khi verify
  GĐ5): 3 điểm gọi `notifications.notify()` trong `FilmsService` (`create`/`update`/
  `confirmVersion`) đã bị COMMENT OUT — lý do: thực tế sẽ có rất nhiều phim đăng lên, bắn
  thông báo mỗi lần cho toàn bộ user sẽ gây spam (đặc biệt vì `update()` tự gắn lại tag
  "Phim mới" mỗi lần sửa metadata dù chỉ sửa mô tả — hành vi có từ GĐ2, GĐ5 chỉ khuếch đại
  bằng thông báo thật). **Hạ tầng vẫn giữ nguyên** (bảng, `NotificationsService`, 4
  endpoint, `NotificationsPanel.vue` nối chuông `MHeaderBar`) để bật lại sau với điều kiện
  phù hợp hơn (vd chỉ digest định kỳ, hoặc chỉ khi thật sự có file mới qua GĐ3, không phải
  mọi lần sửa metadata) — NẾU bật lại, cân nhắc sửa luôn hành vi tự gắn lại tag "Phim mới"
  ở `update()` cho khớp. Hiện chuông thông báo sẽ luôn hiện rỗng, đó là chủ ý.
- **GĐ 4 làm gì**: bảng `film_views` (migration `AddFilmViews`) + `POST /films/:id/view`
  (ai đăng nhập cũng gọi được) — dedupe theo `user_id` trong cửa sổ 30' (KHÔNG dùng
  `session_hash` trong logic dedupe, chỉ ghi dự phòng — ADR-023), tăng `films.view_count`
  atomic (`increment`, không đọc-rồi-ghi). FE `FilmDetailView` gọi 1 lần trong `onMounted`
  sau khi load phim xong, cập nhật `viewCount` ngay từ response (không cần F5). Player đa
  nguồn/nút link theo nguồn/fullscreen+volume đã rà lại — không có bug thật, giữ nguyên.
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
- **Fix nhỏ sau GĐ3 (2026-07-21, Sonnet 5)**: (1) Cảnh báo rời trang khi `FilmUploadView` còn nội
  dung chưa lưu (`onBeforeRouteLeave` + dialog "Ở lại/Không lưu/Lưu nháp") — nháp lưu localStorage
  (`kho-phim:film-draft:new|edit:<slug>`, chỉ trường văn bản, không lưu được File đã chọn), tự khôi
  phục khi quay lại, tự xoá sau khi xuất bản/lưu thành công. (2) `MUpload` thêm prop `pasteImage` —
  dán ảnh copy (Ctrl+V) thẳng vào dropzone, đã bật cho ô ảnh bìa phim. Đã verify browser (dialog
  hiện đúng lúc, nháp khôi phục đúng, dán ảnh tạo preview đúng), build FE sạch.
- **Đã push**: commit GĐ 3 + fix nhỏ trên đã lên GitHub `main` (xem `git log`). GĐ 4, GĐ 5,
  GĐ 6, GĐ 6.1 mới commit LOCAL, CHƯA push (chờ xác nhận riêng).
- **Việc tiếp theo — GĐ 7 (Hardening & Handoff)**: xem 03-roadmap.md dòng GĐ 7 —
  security-review; test coverage; tài liệu API + quy trình nội bộ; hướng dẫn DevOps đưa
  lên AMIS (cắm OIDC thay JWT nội bộ — ADR-012/003, đổi storage MinIO→AMIS Drive/S3 thật
  — ADR-004/020). Gợi ý bắt đầu bằng skill/slash-command `security-review` có sẵn.
  **KHI làm GĐ 7, nhớ đưa cả phần SSO AMIS Mobile (GĐ 6.1) vào phạm vi review** — placeholder
  HMAC + query-param token chưa qua security-review chính thức, chỉ mới tự verify cơ bản.
- **Model**: GĐ 7 dùng **Opus 4.8** (review/bảo mật) + **Haiku 4.5** (docs/format) theo
  gợi ý 03-roadmap.md.
- **Việc chưa verify được ở GĐ 6** (môi trường phiên chỉ có browser desktop resize, không
  phải thiết bị thật): test trên iOS Safari/Android Chrome thật (Add to Home Screen, push
  permission, back-gesture, `pointer:coarse` thật); dev server FE riêng (`npm run dev --
  port 5180`) thiếu proxy `/api` nên không login được qua cổng 5180 (có từ trước GĐ6,
  không phải lỗi mới) — nếu cần dùng lại luồng hot-reload 5180 để login, cân nhắc thêm
  `server.proxy` trong `vite.config.ts` trỏ `/api` + `/media` sang backend.

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
