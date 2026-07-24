# AMIS Kho phim — Progress Log

> Nhật ký "đã làm gì". Cập nhật MỖI khi hoàn thành một việc đáng kể.
> Format: `YYYY-MM-DD — [GĐ x] mô tả — trạng thái`.

## Trạng thái tổng
- Giai đoạn hiện tại: **GĐ 6 — PWA & Mobile & MDS polish ĐÃ XONG & verify end-to-end** trong
  Docker + trình duyệt nhiều viewport (2026-07-24, Sonnet 5). Commit local (chưa push).
  Tiếp theo: **GĐ 7 — Hardening & Handoff** (03-roadmap.md).
- % hoàn thành tổng thể: ~93%
- Xem `06-activeContext.md` để biết chi tiết cần làm tiếp khi mở lại phiên.

## Nhật ký GĐ 6 (PWA & Mobile & MDS polish) — 2026-07-24
- **PWA**: cài `vite-plugin-pwa` + `sharp` (chỉ devDependency, dùng để render icon lúc
  build, không đưa vào bundle chạy). `frontend/scripts/generate-pwa-icons.mjs` sinh
  4 icon PNG (`public/icons/app-192.png`, `app-512.png`, `app-maskable-512.png`,
  `apple-touch-icon.png`) từ 1 SVG vẽ tay (nền brand `#245FDF` + glyph "device-tv" style
  Tabler stroke 1.5) — chạy lại bằng `node scripts/generate-pwa-icons.mjs` khi cần đổi icon.
  `vite.config.ts`: `VitePWA({ registerType: 'prompt', ... })` — **CHỌN 'prompt' KHÔNG
  phải 'autoUpdate'** để không tự activate/reload khi form đang có nội dung chưa lưu
  (ADR-027). Manifest tối thiểu đúng mobile-pwa.md (name/short_name/theme_color
  `#245fdf`/background `#ffffff`/3 icon). Workbox: precache app shell; `runtimeCaching`
  NetworkFirst cho `/api/*` (timeout 8s, cache 1h); `/media/*` (video) `NetworkOnly` —
  KHÔNG cache video/dữ liệu nhạy cảm. `index.html` thêm `viewport-fit=cover`,
  `apple-touch-icon`, các meta `apple-mobile-web-app-*`.
- **Trạng thái PWA trong App.vue**: `src/lib/useNetworkStatus.ts` (theo dõi
  `navigator.onLine` + sự kiện online/offline), `src/lib/usePwaUpdate.ts` (bọc
  `virtual:pwa-register/vue` — `needRefresh`/`offlineReady`/`updateServiceWorker`).
  Component mới `src/components/mds/MGlobalInline.vue` ("Global Inline Notification"
  theo `communication.md` mục 2.5 — dải banner trên cùng, TRÊN header) hiển thị 3
  trạng thái: mất mạng (warning, nút "Thử lại"), có phiên bản mới (info, nút "Cập nhật"
  → `updateServiceWorker(true)`), sẵn sàng dùng ngoại tuyến (success, đóng được) — đã
  verify cả 3 bằng browser thật (mô phỏng offline qua dispatch event, offline-ready bắn
  tự nhiên ngay lần load đầu sau khi SW cài xong).
- **Window size class**: `src/lib/windowSize.ts` — composable dùng chung
  (Compact&lt;600/Medium 600-839/Expanded 840-1199/Large&gt;=1200 theo `window.innerWidth`,
  1 listener resize dùng chung qua reference-count). `App.vue`, `MHeaderBar.vue`,
  `NotificationsPanel.vue` đều dùng composable này — **đổi layout khi resize KHÔNG cần
  reload** (đã verify: kéo resize 1280→768→320 và ngược lại, panel/toolbar tự đổi ngay).
- **App.vue (Compact &lt;600px)**: **bỏ hẳn `MSidebar` cố định**, thay bằng
  **bottom navigation** (`<nav class="fixed inset-x-0 bottom-0">`, `env(safe-area-inset-bottom)`,
  5 mục `sidebarItems` hiện có vừa đúng giới hạn ≤5 của mobile-pwa.md — xem ADR-028 lý
  do chọn bottom-nav thay vì drawer). `main` có `padding-bottom` chừa chỗ cho bottom nav.
  Root layout đổi `h-full`→`100dvh` (giữ `min-height`+`height` cùng lúc để Safari cũ vẫn
  có fallback). Banner (`MGlobalInline`) + `MHeaderBar` đặt trong 1 wrapper đo chiều cao
  thật qua `ResizeObserver` (`topBarHeight`) — popover menu người dùng + `NotificationsPanel`
  dùng giá trị này làm `top` thay vì hardcode `top-[52px]` cũ (banner hiện/ẩn động sẽ đẩy
  header xuống, không được hardcode nữa).
- **MHeaderBar.vue**: thêm prop `compact` (mặc định `false` — **không đổi gì ở
  Medium/Expanded/Large**, giao diện desktop giữ nguyên 100%). Khi `compact=true`: ô tìm
  kiếm inline ẩn, thay bằng icon "Tìm kiếm" mở **overlay full-width** (input tự focus,
  nút Back đóng) đè lên toàn header; Thiết lập/AVA/Chat/Hỗ trợ gộp vào popover "More"
  (trước đó These bị `hidden md:grid` nên vô hình ở mobile — giờ hiện đúng vị trí, chỉ
  còn Thông báo + avatar trực tiếp ngoài More theo đúng mobile-pwa.md §3).
- **NotificationsPanel.vue**: thêm prop `topOffset` (thay hardcode) và `fullScreen`
  (App.vue truyền `isCompact`) — Compact: panel full-screen có top bar Back; Medium+:
  giữ nguyên popover góc trên phải như cũ.
- **FilmListView/FilmDetailView**: đã là card grid responsive + toolbar flex-wrap từ
  GĐ0.5/2 nên **không cần viết lại** — chỉ rà và xác nhận qua browser thật ở 320/375/768/
  1024/1280 không tràn ngang, touch target đủ dùng, không có bảng ngang chật cần chuyển
  card (đã là card sẵn).
- **FilmUploadView.vue**: footer sticky Lưu/Hủy thêm `padding-bottom: max(12px,
  env(safe-area-inset-bottom))` (trước đó không chừa safe-area, có thể bị thanh cử chỉ
  iOS/Android che một phần) — không đổi các quy tắc nháp/cảnh báo thoát trang đã có.
- **CSS toàn cục** (`style.css`) — áp dụng CHUNG thay vì sửa từng file: (1) `@media
  (pointer: coarse)`: icon-button `h-8 w-8` (32px, gần như toàn bộ nút icon trong app
  dùng đúng 2 class Tailwind liền kề này) được mở rộng vùng chạm ảo lên 48×48px bằng
  `::after{inset:-8px}` — **không phóng to icon/nút thật**, giữ nguyên UI đã duyệt; input/
  select/textarea `font-size:16px !important` (chặn iOS Safari tự zoom khi focus — cần
  `!important` vì class Tailwind `text-[13px]` có specificity cao hơn selector element
  thường). (2) `body{overflow-x:hidden}` chặn tràn ngang toàn trang. (3)
  `prefers-reduced-motion: reduce` tắt animation. **Hạn chế đã biết**: công cụ browser
  test dùng trong phiên này resize viewport nhưng KHÔNG giả lập `pointer: coarse` (luôn
  báo `fine`/`maxTouchPoints:0`) — đã xác nhận rule tồn tại đúng trong CSS biên dịch
  (`document.styleSheets`) nhưng KHÔNG tự bấm-thử được bằng ngón tay thật trên thiết bị
  touch thật trong phiên này; cần verify thêm trên điện thoại/tablet thật hoặc DevTools
  device toolbar (giả lập touch đầy đủ) trước khi coi 48px touch target là 100% chắc chắn.
- **Không tự động thu gọn Sidebar ở Medium/Expanded**: mobile-pwa.md gợi ý Medium dùng
  rail/drawer, nhưng `MSidebar` đã có sẵn nút thu gọn thủ công (200px⇄64px, từ GĐ0) và
  card grid đã tự co giãn cột — **quyết định KHÔNG** tự động ép rail theo breakpoint để
  tránh xung đột với lựa chọn thủ công của người dùng đã có từ trước; ghi nhận là điểm
  đơn giản hoá có chủ đích (xem ADR-028).
- **CategoryView/UserAdminView/ReportsView**: đã rà ở 320px — `MDataTable`/`MTree` đã tự
  có `overflow-auto` container riêng nên KHÔNG tràn ngang toàn trang; **chưa chuyển
  table→card** cho 2 trang admin (UserAdminView/ReportsView) vì đây là màn hình quản trị
  ít dùng trên di động, bảng đã cuộn ngang gọn trong khung riêng — ghi nhận là điểm cố ý
  bỏ qua theo đúng tinh thần "không được tự ý bỏ qua mà không nói": nếu cần dùng nhiều
  trên mobile, GĐ7 có thể bổ sung.
- **LoginView/ChangePasswordView**: đã vừa khung 320×568 không cần cuộn thêm gì, input
  vốn đã `autocomplete`/`type` đúng từ GĐ1; áp dụng chung rule font-size 16px coarse-pointer
  ở style.css nên không cần sửa riêng.
- **VideoPlayer.vue**: giữ nguyên (ADR-008 — native `<video controls>`/iframe official
  đã tự xử lý fullscreen + safe-area qua trình duyệt, không cần thêm CSS).
- **Build & verify**: `npm run build` (vue-tsc + vite build) sạch, PWA sinh
  `dist/sw.js`+`dist/workbox-*.js`+`dist/manifest.webmanifest` hợp lệ. Verify browser
  thật (Claude_Browser, KHÔNG chỉ đọc code) qua Docker (`docker compose up -d --build`,
  cổng 8180) — đăng nhập `superadmin@misa.com.vn`, tự bấm/resize qua 320×568, 375×667,
  768×1024, 1024×768, 1280×800: xác nhận không sidebar cố định ở compact, bottom nav
  5 mục hoạt động, search overlay + More popover hoạt động, NotificationsPanel
  full-screen↔popover đổi đúng theo size class không reload, banner offline/offline-ready
  hiện đúng vị trí không đè header, không trang nào tràn ngang (`scrollWidth===innerWidth`
  đo trực tiếp qua JS ở nhiều trang), form Thêm phim sticky footer không bị cắt.
  **Chưa verify được**: dev server FE riêng `npm run dev -- --port 5180` không có proxy
  `/api` (thiếu từ trước GĐ6, không phải lỗi phát sinh ở GĐ6) nên không đăng nhập được
  qua cổng 5180 trong phiên này — đã chuyển toàn bộ verify sang cổng 8180 (Docker nginx,
  build production, cùng chất lượng kiểm thử); test thiết bị iOS/Android thật (Safari/
  Chrome, Add to Home Screen, push permission, back-gesture) chưa thực hiện được vì môi
  trường phiên này chỉ có browser desktop resize — cần verify thêm trên thiết bị thật.

## Nhật ký GĐ 5 (Nghiệp vụ nâng cao) — 2026-07-21
- Versioning/tag "Phim mới"/hashtag/search theo tên-hashtag-chuyên mục: đã có sẵn từ
  GĐ2-4, verify lại — search FE (`searchState.ts` + `FilmListView.vue`) đã lọc cả
  `title` lẫn `hashtags` (dòng `inTags`), KHÔNG cần sửa thêm.
- BE module `notifications` mới: bảng `notifications`(id, film_id, type, created_at) +
  `user_notifications`(id, user_id, notification_id, is_read, created_at) — migration
  `AddNotifications`. `NotificationsService.notify()` tạo 1 notification rồi fan-out
  cho mọi user `isActive` TRỪ actor. Gọi từ `FilmsService`: `create()` → `new_film`;
  `update()` (sửa metadata, đã tự reset `publishedAt`/tag "mới" từ GĐ2) → `updated`;
  `confirmVersion()` chỉ khi `versionNo > 1` (upload lại file cho phim đã có, tránh
  thông báo trùng với `new_film` của lần xuất bản đầu) → `updated`. Endpoint
  `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`,
  `PATCH /notifications/read-all` — ai đăng nhập cũng gọi được (chỉ thấy thông báo của mình).
- FE: `notificationsStore.ts` (Pinia) poll `unread-count` mỗi 30s khi đã đăng nhập +
  load danh sách khi mở panel lần đầu. `NotificationsPanel.vue` — popover tự dựng
  (KHÔNG phải MDialog, theo hướng dẫn skill misa-design-system) góc trên phải dưới
  chuông `MHeaderBar`, giống pattern popover menu người dùng đã có ở `App.vue`. Bấm
  1 thông báo → đánh dấu đã đọc + điều hướng `/films/:slug`. Nút "Đánh dấu tất cả đã đọc".
- BE module `reports` mới: `GET /reports/films?uploaderId=&from=&to=&format=csv` —
  `@Roles('super_admin','admin')`. Trả `{ summary: [{uploaderId, uploaderName, count}],
  films: [...] }` lọc theo `films.created_at` (ngày UPLOAD, khác `published_at` có thể
  bị đẩy lại khi sửa/cập nhật bản mới). `format=csv` → cùng endpoint, trả CSV UTF-8 BOM
  (`﻿`) + header tiếng Việt (Content-Disposition attachment).
- FE trang mới `/admin/reports` (`ReportsView.vue`) — chỉ `super_admin`/`admin` (route
  `meta.roles`, sidebar `App.vue` ẩn/hiện theo role giống "Quản trị người dùng"). Bộ lọc
  `MSelect` (người upload, tái dùng `GET /users`) + `MDateRangePicker` (khoảng ngày) +
  bảng `MDataTable` + nút "Xuất CSV" (`MButton` primary) tải file qua `fetch` kèm Bearer
  token → blob → thẻ `<a download>` tạm (không dùng `apiFetch` vì nó luôn parse JSON).
- Review Gate: `docker compose up -d --build` chạy sạch (BE log đủ 6 module + migration
  `AddNotifications` tự chạy). Browser: super_admin xuất bản 1 phim mới → nhân viên khác
  (tài khoản tạo test qua API) thấy badge chuông tăng lên 1, mở panel đúng nội dung
  "Phim mới: <tên phim>" + "X phút trước", bấm vào → điều hướng đúng `/films/:slug` +
  badge về 0. `/admin/reports` với super_admin hiển thị đúng thống kê + bảng chi tiết;
  nhân viên vào `/admin/reports` bị router guard đẩy về `/films`, sidebar không hiện
  "Báo cáo"/"Quản trị người dùng". Xuất CSV qua `curl` xác nhận byte đầu `EF BB BF`
  (BOM) + nội dung tiếng Việt đúng (không lỗi font). Console chỉ có 2 lỗi
  `AbortError: play() interrupted` từ YouTube iframe player (GĐ4, không liên quan thay
  đổi GĐ5) — không có lỗi mới phát sinh từ code GĐ5.
- Dữ liệu test (phim, chuyên mục, tài khoản nhân viên tạo để verify) đã xoá qua API
  sau khi verify xong.

## Nhật ký GĐ 4 (Player & Link ngoài & View) — 2026-07-21
- BE: bảng `film_views` (id, film_id, user_id?, session_hash, viewed_at) — migration
  `AddFilmViews` (FK film_id→films CASCADE, user_id→users SET NULL, index film_id+user_id).
  Đăng ký entity/migration tường minh trong `db-options.ts` (đúng pattern GĐ3).
- BE: `POST /api/films/:id/view` — bất kỳ ai đã đăng nhập gọi được (không cần role đặc
  biệt, chỉ cần qua `JwtAuthGuard` toàn cục sẵn có). `FilmsService.recordView`: dedupe theo
  `user_id` trong cửa sổ 30' (query `MoreThan(now-30')`) → nếu trùng thì bỏ qua (không ghi
  thêm dòng, không update lại `viewed_at` — chấp nhận đơn giản theo scope); ngược lại insert
  `film_views` mới + `films.increment({id}, 'viewCount', 1)` (atomic, không đọc-rồi-ghi —
  tránh race khi nhiều tab/nhiều request cùng lúc).
- `session_hash`: sinh ở BE = `sha256(ip + '|' + user-agent)`, cột dự phòng — KHÔNG dùng
  trong logic dedupe hiện tại (mọi người dùng đều đã đăng nhập nên `user_id` là đủ). Xem ADR-023.
- FE: `filmsApi.recordView(id)` gọi `POST /films/:id/view`; `FilmDetailView.onMounted` gọi
  1 lần sau khi `getBySlug` thành công (biến `viewedSlug` nhớ đã gọi cho slug nào, tránh gọi
  lại khi component chỉ re-render); cập nhật `film.viewCount` từ response ngay (không cần F5).
- Rà soát VideoPlayer.vue/FilmDetailView.vue (player đa nguồn, nút link/copy theo nguồn,
  fullscreen/volume qua `<video controls>` gốc): **không phát hiện bug thật** — giữ nguyên,
  đúng ADR-008 đã chốt từ GĐ0.5.
- Verify: `docker compose up -d --build` (5 container Up/healthy). Backend `tsc --noEmit` +
  FE `vue-tsc --noEmit` sạch trước khi build Docker. Trình duyệt: login super_admin → mở
  phim có sẵn (view_count 0→1) → F5 lại nhiều lần cùng phim → **vẫn 1** (dedupe đúng, xác
  nhận cả qua SQL `SELECT view_count, COUNT(film_views)` khớp 1/1). Tạo phim test riêng qua
  API, gọi `POST /:id/view` 3 lần liên tiếp → chỉ tăng lần đầu (1,1,1), xoá phim test xong.
  0 lỗi console. `docker compose down` (không `-v`) sau verify.

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
1. **GĐ 5 (Nghiệp vụ nâng cao)** — Sonnet 5 (+ Opus 4.8 cho phần versioning nếu cần đào sâu).
   Còn thiếu theo 03-roadmap.md: thông báo phim mới (bảng `notifications`/`user_notifications`
   đã có trong 01-architecture.md §4, chưa có module `notifications` thật); báo cáo Quản trị
   theo giai đoạn ai upload bao nhiêu phim + gồm phim gì (lọc theo người upload/khoảng ngày,
   xuất CSV). Trùng tiêu đề/versioning + tag "Phim mới" đã có 1 phần từ GĐ2/GĐ3.
2. Docker stack đã verify chạy tốt — có thể `docker compose down` khi không cần chạy liên tục (đỡ chiếm cổng/RAM), `up -d` lại khi cần.
