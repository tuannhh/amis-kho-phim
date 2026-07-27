# AMIS Kho phim — Decision Log (ADR rút gọn)

> Ghi lại quyết định kiến trúc quan trọng + lý do. Thêm mục mới ở trên cùng.

## ADR-030 — SSO AMIS Mobile: HMAC shared-secret tạm thay OIDC/JWKS thật [GĐ6.1]
- **Quyết định:** `POST /auth/sso/amis-mobile` xác minh token bằng HMAC-SHA256 trên payload
  JSON `{email, exp}` với shared secret đọc từ `AMIS_SSO_SHARED_SECRET` (rỗng = TẮT, trả 501
  rõ ràng — không throw 500). Tìm user theo email, tái dùng `issueTokens` y hệt luồng login
  thường (không có JWT/kiến trúc song song). Tận dụng seam có sẵn "Seam để GĐ7 thay bằng OIDC
  AMIS" ở đầu `auth.service.ts` thay vì tạo module xác thực riêng.
- **Lý do:** Chưa có spec bridge/JWKS chính thức từ đội AMIS Mobile lúc làm scaffold này.
  HMAC đơn giản, không cần hạ tầng JWKS, đủ để chứng minh luồng "app mẹ xác thực hộ → BE cấp
  JWT nội bộ" chạy được end-to-end (đã test round-trip thật với secret tạm, xem 04-progress.md).
  **PLACEHOLDER — BẮT BUỘC DevOps xác nhận lại với đội AMIS Mobile và thay `verifySsoToken`
  bằng cơ chế xác minh thật (OIDC/JWKS hoặc khác) trước khi dùng production.** An toàn mặc
  định: biến env rỗng trong mọi file cấu hình của repo (không set sẵn secret thật).

## ADR-029 — Bridge token qua query param `?ssoToken=` tạm, không phải bridge thật [GĐ6.1]
- **Quyết định:** FE phát hiện chế độ nhúng qua query param `?embedded=1` (đọc 1 lần lúc
  khởi động, cache module-level — `lib/amisBridge.ts`). Lấy token SSO ưu tiên qua
  `window.AMISBridge?.getToken?.()` (native tiêm sẵn), fallback query param `?ssoToken=...`
  nếu không có object native.
- **Lý do:** Chưa có spec bridge chính thức (postMessage? custom scheme? object khác?) từ
  đội AMIS Mobile. Query param là cách đơn giản/đáng tin cậy nhất để scaffold chạy được và
  test thủ công không cần app mẹ thật. **CẢNH BÁO BẢO MẬT đã ghi rõ trong code:** query param
  lộ token trong URL (lịch sử trình duyệt, log server, referrer header) — KHÔNG được dùng
  nguyên trạng ở production. Khi có spec thật, khả năng cao phải đổi sang `postMessage` hoặc
  cơ chế native khác không lộ trong URL. Auth flow có fallback: bridge-auth thất bại vẫn hiện
  `LoginView` thường (không khoá chết người dùng), và mặc định (không `?embedded=1`) hành vi
  ứng dụng KHÔNG đổi so với trước GĐ6.1.

## ADR-028 — Compact: bottom navigation (không drawer); Medium/Expanded KHÔNG tự ép rail [GĐ6]
- **Quyết định:** Ở window size class Compact (&lt;600px), thay `MSidebar` cố định bằng
  bottom navigation cố định 5 mục (đúng `sidebarItems` hiện có: Kho phim/Thêm phim/Chuyên
  mục/Quản trị người dùng/Báo cáo — ẩn 2 mục cuối theo role như cũ). KHÔNG dùng drawer.
  Ở Medium (600-839px) và Expanded (840-1199px), **giữ nguyên `MSidebar` đầy đủ** (200px
  mở rộng / 64px thu gọn qua nút bấm thủ công có sẵn từ GĐ0) — KHÔNG tự động ép về dạng
  rail/drawer theo breakpoint dù mobile-pwa.md gợi ý điều đó.
- **Lý do:** mobile-pwa.md quy định "dùng bottom navigation khi có tối đa 5 điểm đến cấp
  một ổn định" — `sidebarItems` đúng khớp giới hạn này (kể cả khi đủ quyền super_admin/
  admin), không cần tới drawer phức tạp hơn. Với Medium/Expanded: `MSidebar` đã có sẵn cơ
  chế thu gọn thủ công do người dùng chủ động bấm (không phải hành vi mới cần thêm) và
  card grid `FilmListView` đã tự co giãn số cột theo bề rộng còn lại — ép tự động chuyển
  rail theo breakpoint sẽ xung đột với lựa chọn thu gọn thủ công đã lưu của người dùng
  (`v-model:collapsed`) mà không mang lại lợi ích rõ ràng ở quy mô app này. Ghi nhận là
  đơn giản hoá có chủ đích, không phải bỏ sót — nếu sau này có nhu cầu thật (nội dung
  chính bị bó hẹp ở Medium), có thể bổ sung tự động collapse khi `sizeClass==='medium'`.

## ADR-027 — PWA: `registerType: 'prompt'` (không 'autoUpdate'); icon sinh bằng script `sharp` [GĐ6]
- **Quyết định:** `vite-plugin-pwa` cấu hình `registerType: 'prompt'` — service worker
  mới KHÔNG tự `skipWaiting()`/reload ngầm; thay vào đó `usePwaUpdate()` (bọc
  `virtual:pwa-register/vue`) cấp cờ `needRefresh` cho `App.vue` hiện Global Inline
  Notification "Có phiên bản mới" + nút "Cập nhật" — người dùng tự bấm mới
  `updateServiceWorker(true)`. Cache chiến lược: precache app shell qua Workbox
  `globPatterns`; `/api/*` NetworkFirst (timeout 8s); `/media/*` (stream video qua
  backend proxy — ADR-021) `NetworkOnly` tuyệt đối không cache. Icon PWA (192/512/
  512-maskable/apple-touch-icon) sinh bằng script Node `scripts/generate-pwa-icons.mjs`
  dùng `sharp` render 1 SVG vẽ tay (nền brand `#245FDF` + glyph "device-tv" phong cách
  Tabler stroke 1.5) — không dùng ảnh chụp màn hình hay icon ngoài.
- **Lý do:** `FilmUploadView` có luồng nháp/cảnh báo thoát trang khi form dở dang (ADR
  từ GĐ3) — nếu SW tự activate+reload theo `autoUpdate` giữa lúc người dùng đang nhập
  form sẽ mất dữ liệu đang gõ mà không có dialog xác nhận nào chặn được (SW update nằm
  ngoài luồng router/component), vi phạm trực tiếp mobile-pwa.md §7 "Không tự reload khi
  form đang có thay đổi chưa lưu". `/media/*` không cache vì file video lớn (không hợp lý
  chiếm cache storage) và có thể gắn với quyền truy cập theo phiên — cache dùng chung ở
  SW là rủi ro rò rỉ giữa các người dùng dùng chung thiết bị/trình duyệt. Script sinh icon
  bằng `sharp` (không phải service chuyển đổi ảnh online) giữ icon tái tạo được, không phụ
  thuộc tài sản thiết kế bên ngoài chưa có (app chưa có bộ icon PNG chính thức từ Product
  Design) — icon sẽ được thay bằng asset thật khi đội thiết kế cung cấp.

## ADR-026 — Xuất CSV: cùng 1 endpoint `?format=csv`, BOM UTF-8 thủ công [GĐ5]
- **Quyết định:** `GET /reports/films` nhận thêm query `format=csv` (thay vì tách route
  riêng `/reports/films/export` hoặc `/reports/films.csv`) — controller check
  `query.format === 'csv'` rồi trả `res.send(csv)` với `Content-Type: text/csv;
  charset=utf-8` + `Content-Disposition: attachment`, ngược lại trả JSON như thường.
  CSV tự dựng bằng string join (không dùng thư viện `csv-stringify`/`json2csv` vì báo
  cáo chỉ 5 cột cố định), mỗi field escape quote kiểu RFC4180, prepend BOM `﻿`
  (byte `EF BB BF`) để Excel Windows nhận diện UTF-8 và hiện tiếng Việt đúng thay vì
  ký tự lạ. Header cột bằng tiếng Việt có dấu ("Tên phim", "Người upload"...).
- **Lý do:** 1 endpoint dùng chung tránh lặp logic lọc/join giữa 2 route; `?format=`
  là quy ước phổ biến, dễ hiểu, không cần thêm route mapping. BOM là bắt buộc — đã xác
  nhận qua `curl` + `xxd`: thiếu BOM thì Excel (không phải trình duyệt) đoán sai encoding
  và hiện tiếng Việt lỗi font dù file thực chất là UTF-8 hợp lệ.

## ADR-025 — Fan-out thông báo: notify() gọi trực tiếp trong FilmsService, không qua event bus [GĐ5]
- **Quyết định:** `NotificationsService.notify(filmId, type, actorId)` được `FilmsService`
  gọi TRỰC TIẾP (không dùng EventEmitter/queue) ngay tại 3 chỗ đã set lại tag "Phim mới"
  (`create()`, `update()`, `confirmVersion()` khi `versionNo > 1`) — đúng yêu cầu "đặt
  logic này đúng chỗ hiện tại đang set is_new/published, đừng tạo luồng song song rối".
  `notify()` tạo 1 row `notifications` rồi fan-out `user_notifications` cho MỌI user
  `isActive=true` TRỪ chính actor (lấy qua `UsersService.list()` có sẵn, không query
  riêng). `confirmVersion()` chỉ notify khi `versionNo > 1` — version đầu tiên (upload
  file lần đầu ngay sau khi tạo phim) đã được `create()` thông báo `new_film` rồi, tránh
  2 thông báo cho cùng 1 lần đăng phim.
- **Lý do:** App nội bộ quy mô nhỏ (vài chục user), không cần hạ tầng message queue;
  gọi thẳng trong cùng transaction-ish flow đơn giản, dễ trace, đúng tinh thần "sửa 1
  vùng ảnh hưởng tối thiểu" (NotificationsModule chỉ export 1 service, FilmsModule import
  thẳng, không có phụ thuộc ngược). Đánh đổi: nếu sau này fan-out chậm (rất nhiều user)
  sẽ cần chuyển sang xử lý nền — ghi nhận là nợ kỹ thuật, chưa cần ở quy mô hiện tại.

## ADR-024 — NotificationsPanel: popover tự dựng, không dùng MDialog [GĐ5]
- **Quyết định:** Panel danh sách thông báo (`NotificationsPanel.vue`) dựng bằng chính
  pattern popover tự chế đã dùng cho menu người dùng ở `App.vue` — lớp phủ
  `fixed inset-0` bắt click-ngoài-để-đóng + panel `fixed right-2 top-[52px]` (dưới
  header 48px + margin), `box-shadow: var(--mds-shadow-md)` (overlay, không phải
  `--mds-shadow-card` của box tĩnh), bo góc 8px, KHÔNG dùng `MDialog` (dialog che toàn
  màn hình, sai ngữ nghĩa cho panel nhỏ góc trên — xác nhận qua skill misa-design-system,
  bộ MDS hiện chưa có component "notification dropdown" đóng gói sẵn).
- **Lý do:** Nhất quán với popover có sẵn trong cùng file `App.vue` (menu người dùng) —
  cùng 1 pattern, dễ bảo trì, đúng token/shadow overlay theo quy chuẩn MDS thay vì tự
  chế lệch. `notificationsStore.ts` (Pinia) poll `unread-count` mỗi 30s khi đã đăng
  nhập (dừng khi logout) + load list khi mở panel lần đầu — đủ cho yêu cầu "không cần
  realtime phức tạp", tránh WebSocket/SSE không cần thiết ở quy mô nội bộ hiện tại.

## ADR-023 — Đếm view: dedupe theo user_id (không dùng session_hash), tăng atomic [GĐ4]
- **Quyết định:** Bảng `film_views`(id, film_id, user_id?, session_hash, viewed_at) đúng
  01-architecture.md §4. `POST /films/:id/view` (cần đăng nhập, không cần role đặc biệt —
  qua `JwtAuthGuard` toàn cục sẵn có, không thêm `@Roles`). Dedupe: query `film_views` theo
  `film_id + user_id` với `viewed_at > now - 30 phút`; nếu có → bỏ qua hoàn toàn (không ghi
  thêm dòng, không cập nhật lại `viewed_at`); nếu không → insert 1 dòng mới + `films.increment
  ({id}, 'viewCount', 1)` (câu lệnh SQL `UPDATE ... SET view_count = view_count + 1`, KHÔNG
  đọc giá trị hiện tại rồi ghi lại — tránh mất lượt tăng khi 2 request chạm cùng lúc, race
  condition kinh điển của đếm view). `session_hash = sha256(ip + '|' + user-agent)` sinh ở
  BE, LUÔN ghi vào cột nhưng KHÔNG dùng trong điều kiện dedupe hiện tại.
- **Lý do:** Toàn bộ người dùng AMIS Kho phim đều đã đăng nhập (nội bộ công ty, không có
  khách ẩn danh) → `user_id` là khoá dedupe đáng tin cậy và đơn giản hơn nhiều so với việc
  tự dựng/lưu session token phía FE (localStorage) rồi gửi lên mỗi request — vừa tốn công
  vừa dễ sai (token mất khi xoá localStorage/trình duyệt riêng tư). `session_hash` giữ lại
  đúng theo thiết kế cột trong kiến trúc gốc, xem như "nợ tính năng" cho tương lai (nếu có
  luồng khách xem không cần đăng nhập, hoặc muốn dedupe theo thiết bị/IP khi 1 tài khoản
  dùng chung nhiều máy) — không phát sinh phức tạp thừa ở GĐ4 vì chưa có yêu cầu đó.
  FE gọi 1 lần trong `onMounted` (không chờ video play) — đúng scope "vào trang xem là tính".

## ADR-022 — readVideoDuration có timeout (không bao giờ chặn xuất bản) [GĐ3]
- **Quyết định:** FE đọc thời lượng video qua `<video>` tạm (loadedmetadata) chỉ để hiển
  thị duration mm:ss, nhưng bọc `Promise.race` timeout 4s → trả `null` nếu metadata không
  load. Duration là best-effort; thiếu thì hiển thị `--:--`, KHÔNG chặn luồng tạo bản mới.
- **Lý do:** Phát hiện thật khi verify GĐ3: ở một số môi trường (vd Chromium tự động không
  giải mã được, hoặc `<video>` detached) sự kiện `loadedmetadata`/`error` không bao giờ bắn
  → publish treo vô hạn (nút "Xuất bản" quay mãi). Timeout là hardening bắt buộc.

## ADR-021 — Stream Range qua backend proxy MinIO (206), route /media/:key ngoài prefix /api [GĐ3]
- **Quyết định:** GET /media/:key (@Public) đọc object từ MinIO, chuyển thẳng header `Range`
  cho MinIO rồi trả nguyên `Content-Range`/`Content-Length`/`Content-Type` MinIO tính sẵn →
  206 Partial Content khi có Range, 200 khi không. Route đặt NGOÀI global prefix `api`
  (`setGlobalPrefix('api', { exclude: ['media/:key' GET/HEAD] })`) để khớp nginx `location /media/`.
  Phải @Public vì `<video src>`/link tải không gắn được Authorization header.
- **Lý do:** Tua/seek mượt cần 206 đúng chuẩn; để MinIO tự tính range tránh tự parse sai.
  storage_key là uuid không đoán được → chấp nhận public-by-key cho prototype nội bộ
  (production có thể chuyển sang presigned GET ngắn hạn — ghi nhận nợ kỹ thuật). Verify:
  curl + fetch trình duyệt đều trả 206 `bytes 0-999/113422`, đúng số byte.

## ADR-020 — Chọn @aws-sdk/client-s3 (S3-compatible) cho MinIO, key sinh server-side [GĐ3]
- **Quyết định:** Dùng `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (forcePathStyle)
  thay vì `minio` client — chuẩn S3, dễ chuyển sang AMIS Drive/S3 thật khi bàn giao. Hai
  S3Client: `internal` (minio:9000) cho thao tác backend (head/get-stream/put thumbnail/xoá),
  `presigner` (MINIO_PUBLIC_ENDPOINT=localhost:9200) CHỈ để ký presigned PUT. `storage_key`
  (`video-<uuid>.<ext>`) và `thumbnail_key` (`thumb-<uuid>.<ext>`) sinh 100% ở server từ
  content-type đã validate — KHÔNG nhận key từ client (chống path traversal/đoán key). File
  phẳng 1 segment (không có `/`) để route `/media/:key` khỏi vướng wildcard.
- **Lý do:** Video lớn phải upload thẳng lên MinIO (không buffer qua Node) → cần presigned PUT;
  nhưng chữ ký SigV4 gắn host nên URL phải ký bằng host trình duyệt gọi được (localhost:9200),
  trong khi backend tự thao tác qua host nội bộ (minio:9000) → tách 2 client. Validate ở server:
  MIME video (mp4/webm/ogg/mov/mkv), size ≤ MAX_UPLOAD_MB, ảnh bìa tỷ lệ 16:9 + magic bytes
  (image-size). confirmVersion head-check lại key trên MinIO + lấy size thật (không tin client).

## ADR-019 — film_versions là bảng thật; films trỏ bản mới nhất (version_no lớn nhất) [GĐ3]
- **Quyết định:** Thêm bảng `film_versions`(storage_key, file_size, duration, thumbnail_key,
  note, created_by...) qua migration `AddFilmVersions`. `toPublic` lấy bản version_no lớn nhất
  làm nguồn `links.storage=/media/<key>` + `thumbnailUrl`. confirmVersion tạo version mới, KẾ
  THỪA asset không thay từ bản trước (thêm mỗi ảnh bìa không làm mất video cũ) + set lại
  `is_new`/publishedAt. RBAC dùng lại `FilmsService.assertCanManage` (owner policy) cho mọi
  thao tác storage — nhân viên chỉ upload/tạo version cho phim của mình (verify: 403 đúng).
- **Lý do:** Đúng kiến trúc 01-architecture.md §4 + ADR-005 (versioning, giữ lịch sử, rollback).
  Endpoint storage đặt trong FilmsModule (import StorageModule) để tái dùng assertCanManage,
  không lặp logic quyền. **ADR-018 hết hiệu lực** — storage/thumbnail giờ persist thật.

## ADR-018 — GĐ2 chưa persist storage/thumbnail thật (đúng scope GĐ3) [ĐÃ THAY THẾ bởi ADR-019/020/021, GĐ3]
- **Quyết định:** `films` GĐ2 chỉ có metadata + `film_links` (youtube/vimeo/gdrive/misadrive).
  MUpload (file phim + thumbnail) vẫn hiện trên form (giữ UI đã duyệt) nhưng CHỈ xem trước
  trong phiên (object URL), KHÔNG gửi lên server — có ghi chú rõ ràng ngay trên form. Validate
  "cần ít nhất 1 nguồn" chỉ tính link ngoài, bỏ qua file đã chọn.
- **Lý do:** Trung thực với người dùng (nguyên tắc skill MDS: không báo "đã lưu" khi chưa lưu
  thật) — tránh users tưởng đã upload xong rồi mất dữ liệu khi F5. Storage thật (MinIO) là GĐ3.

## ADR-017 — Màu tag/gradient chuyên mục suy ra từ category id, không phải vị trí danh sách
- **Quyết định:** `categoryColorFor(categoryId)` và `thumbnailGradient(categoryId)` = mảng cố
  định lấy theo `categoryId % length` — thay vì cách cũ GĐ0.5 gán màu theo thứ tự xuất hiện
  trong danh sách phim đang tải (`colorForCategory(category, categories)`).
- **Lý do:** Cách cũ không ổn định — cùng 1 chuyên mục có thể ra màu khác nhau tuỳ tập phim
  đang lọc/tải. Theo id là bất biến, đúng hơn về UX dù không ai yêu cầu, chấp nhận được vì
  không tốn thêm chi phí thiết kế.

## ADR-016 — Hashtag & FilmLink là bảng riêng (đúng theo 01-architecture.md), không JSON column
- **Quyết định:** `hashtags` + `film_hashtags` (n-n) và `film_links` (1-n) là bảng SQL riêng,
  không nhét mảng JSON vào cột `films`.
- **Lý do:** Kiến trúc đã chốt từ GĐ0 (01-architecture.md §4); chuẩn hoá giúp tìm theo hashtag
  (GĐ5) và validate/dedupe hashtag hiệu quả hơn JSON column.

## ADR-015 — Category & Film slug tự sinh ở BE (không nhận từ FE)
- **Quyết định:** Backend tự tạo slug từ `name`/`title` qua `slugify()` + hậu tố số nếu trùng
  (`-2`, `-3`...). FE không gửi slug, chỉ nhận lại từ response.
- **Lý do:** Slug là identifier suy ra được, để BE sinh + đảm bảo unique tránh race-condition
  2 client tạo cùng lúc trùng slug; nhất quán với cách Category cha-con cũng dùng numeric id
  (không dùng slug làm khoá như mock GĐ0.5 cũ).

## ADR-014 — OwnerGuard hoãn tới GĐ2 (chưa có resource "phim" ở BE) — ✅ đã thêm ở GĐ2
- **Quyết định:** GĐ1 mới có `RolesGuard` (toàn cục theo `@Roles`). Kiểm chủ sở hữu cho **quản trị người dùng** (ai khoá/xoá được ai, không tự khoá mình) đặt ở **tầng service** (`UsersService.assertCanManage`), không dựng class OwnerGuard rỗng. `OwnerGuard` thật (theo `uploader_id` của phim) sẽ thêm ở GĐ2 khi FilmsModule ra đời.
- **Cập nhật GĐ2:** đã thêm `FilmsService.assertCanManage` (cùng pattern với Users) — super_admin/admin sửa/xoá bất kỳ phim, nhân viên chỉ phim của mình. Vẫn ở tầng service (không tách class `OwnerGuard` riêng) vì logic đơn giản, chỉ so `uploaderId === actor.id`.
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
