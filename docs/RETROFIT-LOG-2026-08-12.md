# Retrofit Log — Tier A + Seam B (theo Production Compatibility Gate)

Nguồn: `PHAN-BIEN-AUDIT-AMIS-KHO-PHIM-2026-08-12.md` + `PHAN-HOI-CODEX-VE-PHAN-BIEN-AUDIT-AMIS-KHO-PHIM-2026-08-12.md`
(vòng phản biện Claude Code ↔ Codex, đã hội tụ). Mục đích: cho Codex audit lại xem việc sửa có
đúng gốc rễ, đúng phạm vi, đúng nhãn `Severity/Retrofit-tier/Target-gate` đã thống nhất hay không.

Mỗi mục: **Nhãn → Trước → Sau → File:dòng → Evidence**.

---

## 1. Unique `(film_id, version_no)` — Critical / A / all-production

- **Trước:** `film_versions` chỉ có `IDX_film_versions_film` (một cột `film_id`), `version_no`
  tính bằng "đọc max rồi +1" ở service — không có ràng buộc DB nào chặn 2 version cùng
  `version_no` cho cùng phim.
- **Sau:** migration mới drop index cũ, tạo unique compound index
  `IDX_film_versions_film_version_no (film_id, version_no)`. Entity cập nhật `@Index(...,
  {unique:true})` khớp migration.
- **File:** `backend/src/database/migrations/1722200000000-AddFilmVersionsUniqueIndex.ts`,
  `backend/src/modules/films/entities/film-version.entity.ts:18-22`.
- **Evidence:** migration up/down viết tay theo TypeORM `QueryRunner`/`TableIndex` (chưa chạy
  `migration:run` thật trên DB dev — cần chạy trước khi merge, xem mục "Việc còn lại" cuối log).

## 2. Transaction + lock cho `confirmVersion` — Critical / A / all-production

- **Trước:** đọc `last = versions.findOne(...)` NGOÀI giao dịch, tính `versionNo = last+1`,
  ghi rời — 2 request `confirmVersion` song song cho cùng phim (vd upload video xong trước,
  ảnh bìa xong sau, hoặc double-click) đọc cùng `last` → ghi trùng `version_no`.
- **Sau:** tách phần I/O MinIO (`storage.stat`, `assertValidThumbnail`) ra NGOÀI giao dịch
  (giữ transaction ngắn, đúng nguyên tắc `05-database-rules.md` đã áp dụng cho `recordView`);
  phần đọc `last.versionNo` + ghi `film_versions` + cập nhật `films` nằm TRONG MỘT
  transaction có khoá dòng phim (`pessimistic_write`) — cùng mẫu đã có sẵn ở `recordView`.
  Unique index ở mục 1 là lớp chặn cuối nếu lock bị bỏ qua.
- **File:** `backend/src/modules/films/films.service.ts` — hàm `confirmVersion` (đã viết lại,
  xem comment "RETROFIT TIER A (2026-08-12)" ngay trên hàm).
- **Evidence:** 216/216 unit test backend xanh (bao gồm toàn bộ test `confirmVersion` cũ, đã
  cập nhật mock để assert đúng `em.save` thay vì `versions.save` trực tiếp — xem
  `films.service.spec.ts`). **Chưa có concurrency test thật** (giống
  `test/concurrency/record-view.concurrency.mjs` đã có cho `recordView`) — đề xuất thêm
  `test/concurrency/confirm-version.concurrency.mjs` trước khi coi mục này "đã chứng minh
  dưới tải đồng thời thật", không chỉ đúng về mặt code.

## 3. Transaction cho `create()`/`update()` phim + links + hashtag — Critical / A / all-production

- **Trước:** `create()` ghi `film` xong mới ghi `film_links` ở câu lệnh tách rời; `update()`
  ghi `film` xong mới `delete` + ghi lại `film_links`. Cả hai đều gọi `findOrCreateHashtags()`
  bằng repository ngoài giao dịch — hashtag mới có thể đã COMMIT dù bước ghi film/links sau
  đó lỗi và rollback ở tầng khác → hashtag mồ côi (đúng "orphaned hashtag" audit + Codex nêu ở
  mục 1.1 phản hồi).
- **Sau:** `findOrCreateHashtags()` nhận `EntityManager` làm tham số bắt buộc; `create()` và
  `update()` bọc toàn bộ (tìm/tạo hashtag → ghi film → xoá/ghi lại links) trong MỘT
  `this.films.manager.transaction(...)`. Lỗi ở bất kỳ bước nào rollback hết.
- **File:** `backend/src/modules/films/films.service.ts` — hàm `findOrCreateHashtags`,
  `create`, `update`.
- **Evidence:** 216/216 unit test backend xanh. Test `FilmsService.create` đã cập nhật để
  assert qua `films.txEntityManager.save` (xem `films.service.spec.ts:490-508`).

## 4. TypeScript build

- `npx tsc --noEmit` sạch sau toàn bộ thay đổi mục 1–3 (không có lỗi kiểu).

## 5. Xoá fallback `?ssoToken=` khỏi production — Critical / A / all-production

- **Trước:** `getBridgeToken()` fallback đọc `location.search.get('ssoToken')` KHÔNG điều
  kiện — chạy ở mọi build kể cả production. Token lộ qua URL (lịch sử trình duyệt, log
  server, referrer) đúng cảnh báo bảo mật đã ghi sẵn trong comment của chính file đó.
- **Sau:** bọc fallback trong `if (import.meta.env.DEV)` — Vite fold hằng số này lúc build
  (`vite build` sinh `import.meta.env.DEV = false` tĩnh, không phải kiểm tra runtime có thể bị
  qua mặt), nên bundle production KHÔNG CÒN chứa nhánh đọc `ssoToken` nữa, không chỉ "không
  chạy tới" mà đã bị loại khỏi code production hoàn toàn (dead-code elimination). Native
  bridge (`window.AMISBridge?.getToken?.()`) không đổi — vẫn ưu tiên trước.
- **File:** `frontend/src/lib/amisBridge.ts:53-66`.
- **Evidence:** thêm test mới `amisBridge.spec.ts` — "BUILD PRODUCTION không bao giờ đọc
  ?ssoToken= — fail-closed" (ép `import.meta.env.DEV=false`, xác nhận `getBridgeToken()` trả
  `null` dù URL có `?ssoToken=...` và không có native object). 14/14 test file này xanh,
  83/83 test frontend toàn repo xanh (tăng 1 so với con số 82 cũ trong README do test mới).
- **Verify bằng build thật:** đã chạy `npm run build` + `grep -l "ssoToken" dist/assets/*.js`
  → KHÔNG có file nào chứa chuỗi `"ssoToken"` trong toàn bộ bundle production. Xác nhận Vite
  đã loại bỏ nhánh code này khỏi output thật (dead-code elimination hoạt động đúng như kỳ
  vọng), không chỉ đúng trên lý thuyết `import.meta.env.DEV`.

## 6. Profile-guard `RUN_MIGRATIONS_ON_BOOT` + đã có sẵn chặn seed default credential — Critical/A(migration) — all-production khi MULTI_REPLICA

- **Phát hiện khi làm:** phần "cấm seed default credential khi NODE_ENV=production" audit
  nêu **ĐÃ CÓ SẴN** từ trước (không phải tôi thêm mới) — `security.config.ts`
  `collectConfigIssues()` dòng ~121 đã chặn fatal nếu `SEED_SUPER_ADMIN_PASSWORD` là mật khẩu
  mẫu (`Admin@12345`, rỗng, hoặc quá ngắn), và `assertSecureConfig()` được gọi ở
  `main.ts:12` lúc bootstrap. Ghi rõ ở đây để không báo cáo nhận công việc đã tồn tại.
- **Phần thật sự làm mới — `migrationsRun` theo profile:**
  - **Trước:** `dbOptions.migrationsRun` hard-code `true` — mọi replica tự chạy migration lúc
    khởi động, không có cách tắt.
  - **Sau:** đọc từ `runMigrationsOnBoot()` (mặc định `true`, giữ nguyên hành vi cũ). Thêm
    `multiReplicaDeclared()` đọc cờ khai báo tường minh `MULTI_REPLICA=true`. Trong
    `collectConfigIssues()`: nếu `MULTI_REPLICA=true` mà `RUN_MIGRATIONS_ON_BOOT` chưa đặt
    `"false"` → **fatal**, chặn khởi động ở production (đúng cơ chế `strict` sẵn có, không
    tạo cơ chế guard mới).
  - Theo đúng guardrail của skill `production-compatibility-gate`: **không tự suy diễn**
    project này đã là multi-replica — cờ `MULTI_REPLICA` phải do vận hành CHỦ ĐỘNG khai khi
    thật sự triển khai nhiều bản sao; mặc định không đặt gì thì hành vi y hệt trước khi sửa.
  - **Bug tiện thể phát hiện + sửa:** migration mới ở mục 1
    (`AddFilmVersionsUniqueIndex1722200000000`) **chưa được đăng ký** vào mảng `migrations:
    [...]` của `dbOptions.ts` — nếu không đăng ký, `migrationsRun: true` sẽ KHÔNG chạy
    migration này dù file đã tồn tại trên đĩa. Đã thêm import + vào mảng.
- **File:** `backend/src/common/config/security.config.ts` (hàm `runMigrationsOnBoot`,
  `multiReplicaDeclared`, check mới trong `collectConfigIssues`),
  `backend/src/database/db-options.ts` (đọc `migrationsRun`, đăng ký migration thiếu),
  `.env.example` (tài liệu 2 biến mới, mặc định để trống/comment — không đổi hành vi mẫu).
- **Evidence:** thêm 3 test mới trong `security.config.spec.ts` (fatal khi thiếu guard, sạch
  khi có guard đúng, không ảnh hưởng single-instance mặc định). 219/219 unit test backend
  xanh (216→219). `npx tsc --noEmit` sạch.

## 7. Upload-intent ownership + cleanup — Critical / A / all-production

- **Trước:** `createUploadUrl`/`createThumbnailUploadUrl` ký presigned PUT URL, sinh key
  server-side, rồi KHÔNG lưu vết gì — key chỉ tồn tại trong response trả về FE. Nếu FE đóng
  tab/mất mạng trước khi gọi `confirmVersion`, object có thể đã nằm trên MinIO mà không ai
  biết nó tồn tại, ai xin ký, cho phim nào — rác vô chủ, không cách nào dọn có chủ đích.
- **Sau:** module mới `backend/src/modules/uploads/` gồm:
  - Entity `UploadIntent` (bảng `upload_intents`): `storage_key` (unique), `kind`
    (video/thumbnail), `film_id`, `actor_id`, `status` (pending/consumed/expired),
    `expires_at`, `consumed_at`.
  - `UploadIntentsService.record(...)` — gọi ngay sau khi ký URL, ghi actor/film/loại/hạn.
  - `UploadIntentsService.markConsumed(storageKey, em)` — gọi TRONG transaction của
    `confirmVersion` (dùng `EntityManager` của transaction đó, không lệch connection — cùng
    kỷ luật đã áp dụng cho `findOrCreateHashtags`).
  - `UploadIntentsService.sweepExpired()` — xoá object mồ côi (`storage.delete`, đã tự nuốt
    lỗi 404 sẵn có) cho intent `pending` quá hạn, đánh dấu `expired`.
  - `FilmsService.createUploadUrl`/`createThumbnailUploadUrl` gọi `record(...)` sau khi ký;
    `confirmVersion` gọi `markConsumed(...)` cho ĐÚNG key vừa được xác nhận dùng (không đụng
    key kế thừa từ bản trước).
- **Giới hạn CHỦ ĐỘNG chấp nhận, ghi rõ không giấu:** `sweepExpired()` được trigger CƠ HỘI
  (opportunistic) — mỗi lần `record()` chạy, tự throttle tối đa 1 lần quét / 15 phút bằng
  biến tĩnh trong tiến trình — KHÔNG PHẢI cron thật theo lịch cố định. Lý do: repo chưa có hạ
  tầng scheduler (`@nestjs/schedule` hay tương đương); thêm dependency mới cho một cron nằm
  ngoài phạm vi "ownership + cleanup" đã chốt trong backlog Tier A. Hệ quả: nếu app ngừng
  nhận request ký URL mới trong thời gian dài, rác quá hạn trong lúc đó sẽ không được dọn cho
  tới lần ký URL kế tiếp. Đây là quyết định hạ tầng Tier C (đúng mô hình 2 trục của skill
  `production-compatibility-gate`) — nếu traffic ký URL thấp mà cần dọn đúng giờ, thay bằng
  `@nestjs/schedule` + `@Cron` thật.
- **File:** `backend/src/modules/uploads/entities/upload-intent.entity.ts`,
  `backend/src/modules/uploads/upload-intents.service.ts`,
  `backend/src/modules/uploads/uploads.module.ts`,
  `backend/src/database/migrations/1722300000000-AddUploadIntents.ts`,
  `backend/src/modules/films/films.module.ts` (import `UploadsModule`),
  `backend/src/modules/films/films.service.ts` (constructor + `createUploadUrl`/
  `createThumbnailUploadUrl`/`confirmVersion`), `backend/src/database/db-options.ts`
  (đăng ký entity/migration).
- **Evidence:** 9 test mới cho `UploadIntentsService` (record ghi đủ trường, expiresAt tính
  đúng, markConsumed dùng đúng manager, sweepExpired xử lý đúng/đủ intent quá hạn, throttle
  không sweep 2 lần liên tiếp, lỗi sweep không làm hỏng record) + 3 test mới trong
  `films.service.spec.ts` (ghi ownership khi ký URL video/ảnh bìa, đánh dấu consumed đúng
  key). 231/231 unit test backend xanh (219→231). `npx tsc --noEmit` sạch.
- **Việc CHƯA làm:** migration `AddUploadIntents1722300000000` chưa chạy thật trên DB dev
  (cùng nhóm với migration mục 1, xem "Việc còn lại" cuối log). Chưa có test tích hợp DB thật
  cho `sweepExpired` (unit test hiện dùng mock repository, chưa chứng minh câu `WHERE
  status='pending' AND expires_at < now` thật sự đúng trên MySQL — TypeORM `LessThan` sinh
  SQL chuẩn nên rủi ro thấp, nhưng chưa "đã chứng minh").

## 8. Bug tiện thể phát hiện: migration mục 1 chưa từng được đăng ký

Đã sửa trong lúc làm mục 6 (xem log mục 6) — ghi lại ở đây để không bị bỏ sót khi audit: nếu
không có mục 6 rà lại `db-options.ts`, migration `AddFilmVersionsUniqueIndex1722200000000`
(mục 1) sẽ nằm im trên đĩa, không bao giờ chạy dù `migrationsRun: true`, và unique constraint
sẽ KHÔNG tồn tại trên bất kỳ DB thật nào — toàn bộ mục 1 sẽ là "đã viết code nhưng chưa từng
có hiệu lực". Bài học quy trình: mỗi migration mới PHẢI kèm bước "đăng ký vào mảng
`migrations: [...]` của `db-options.ts`" như một bước không thể tách rời, không phải bước tuỳ
chọn — nên thêm vào checklist review PR của repo này.

---

## 9. Seam `HostAdapter` — Tier B, all-production (AMIS-host-production khi finalise)

- **Trước:** `App.vue` gọi thẳng `isEmbedded()`, `registerBackHandler()` từ `amisBridge.ts`,
  và gọi trực tiếp `window.AMISBridge?.closeWebview?.()` ngay trong `onMounted`.
  `authStore.ts` cũng gọi thẳng `isEmbedded()`/`getBridgeToken()`. Capability của "app chủ"
  bị gọi rải rác ở nhiều nơi — đúng vấn đề audit/Codex nêu ("app tự đoán host thay vì qua
  adapter").
- **Sau:** `frontend/src/lib/hostAdapter.ts` — interface `HostAdapter`
  (`isEmbedded/getBridgeToken/registerBackHandler/closeApp`), 1 implementation thật
  (`browserHostAdapter`, bọc lại `amisBridge.ts` — KHÔNG đổi hành vi), 1 no-op
  (`createNoopHostAdapter`), `getHostAdapter()/setHostAdapter()` để swap. `App.vue` và
  `authStore.ts` sửa lại gọi qua `getHostAdapter()` thay vì import thẳng `amisBridge.ts`.
- **Cố ý CHƯA làm (đúng thoả thuận với Codex mục 1.2 phản hồi):** interface KHÔNG khai
  safe-area/lifecycle/permission/deep-link — các capability này CHỜ bridge contract chính
  thức từ đội AMIS Mobile (Gate 3), tránh bịa hình dạng API không có nguồn xác thực. Adaptive
  native tablet composition (lớp Codex nói "không phụ thuộc bridge, làm được ngay") KHÔNG
  nằm trong đợt retrofit này — ngoài phạm vi 8 việc backlog gốc, cần một phiên riêng.
- **File:** `frontend/src/lib/hostAdapter.ts`, `frontend/src/App.vue`,
  `frontend/src/features/auth/authStore.ts`.
- **Evidence:** 6 test mới `hostAdapter.spec.ts` (mặc định đúng adapter, swap được toàn bộ
  implementation — chứng minh đây là seam thật không phải đổi tên hàm suông, no-op an toàn,
  `closeApp` gọi đúng `window.AMISBridge.closeWebview` và không crash khi vắng mặt). 89/89
  test frontend xanh lúc này (83→89). `npx vue-tsc --noEmit` sạch, `npm run build` sạch.

## 10. `AuthTransport` adapter — Tier B, Gate 2 (browser/PWA production)

- **Trước:** `authStore.ts` gọi thẳng `localStorage.getItem/setItem/removeItem` với 2 hằng số
  key ngay trong file store.
- **Sau:** `frontend/src/lib/authTransport.ts` — interface `AuthTransport`
  (`getAccessToken/getRefreshToken/setTokens/clear`), implementation thật
  `localStorageAuthTransport` (Y HỆT hành vi cũ — cùng 2 key `kp.accessToken`/
  `kp.refreshToken`, không đổi cách lưu), `createMemoryAuthTransport()` cho test,
  `getAuthTransport()/setAuthTransport()` để swap. `authStore.ts` sửa lại gọi qua
  `getAuthTransport()`.
- **Cảnh báo bảo mật ghi lại nguyên trạng, KHÔNG che giấu bằng việc "đã tách seam":** tách
  seam KHÔNG tự động làm localStorage an toàn hơn — token vẫn lộ được qua XSS. Đã ghi rõ
  trong comment `authTransport.ts`: đây là mức chấp nhận được cho PROTOTYPE, quyết định
  chuyển sang cookie HttpOnly + CSRF (hoặc risk-acceptance có chủ) phải chốt TRƯỚC Gate 2.
- **File:** `frontend/src/lib/authTransport.ts`, `frontend/src/features/auth/authStore.ts`.
- **Evidence:** 8 test mới `authTransport.spec.ts` (hành vi localStorage giữ nguyên key cũ,
  memory transport cô lập hoàn toàn, swap được toàn bộ implementation). 97/97 test frontend
  xanh (89→97, tổng 83→97 qua cả mục 9+10). `npx vue-tsc --noEmit` sạch, `npm run build` sạch.

---

## Trạng thái backlog — CẢ 8 VIỆC ĐÃ XONG

> **Đính chính sau independent audit + remediation cùng ngày:** tiêu đề này chỉ mô tả code đợt
> đầu, không phải production-ready. `markConsumed(key)` chưa kiểm actor/phim/loại/pending/TTL và
> gọi sau khi tạo version. Bản remediation hiện hành dùng atomic `claimForVersion` trước save,
> có E2E MySQL+MinIO cross-film/replay, Redis shared throttler, K8s migration Job/CronJob và
> native tablet surface. Xem ADR-075, `deploy/` và memory-bank để dùng trạng thái hiện hành.

| # | Việc | Tier | File chính | Test mới |
|---|------|------|------------|----------|
| 1 | Unique `(film_id, version_no)` | A | `1722200000000-AddFilmVersionsUniqueIndex.ts` | — (migration) |
| 2 | Transaction+lock `confirmVersion` | A | `films.service.ts` | (chung với #3) |
| 3 | Transaction `create`/`update` | A | `films.service.ts` | 216→219 backend |
| 4 | Upload-intent ownership+cleanup | A | `modules/uploads/*` | +12 backend (219→231) |
| 5 | Xoá `?ssoToken=` fail-closed | A | `lib/amisBridge.ts` | +1 frontend (82→83) |
| 6 | Profile-guard migration/seed | A/C | `security.config.ts`, `db-options.ts` | +3 backend |
| 7 | Seam `HostAdapter` | B | `lib/hostAdapter.ts` | +6 frontend (83→89) |
| 8 | Seam `AuthTransport` | B | `lib/authTransport.ts` | +8 frontend (89→97) |

**Tổng:** backend 216→231 unit test (+15), frontend 82→97 unit test (+15). `npx tsc --noEmit`
(backend) và `npx vue-tsc --noEmit` (frontend) sạch. `npm run build` (frontend) sạch, xác
nhận bằng grep rằng `?ssoToken=` không còn trong bundle production.

## Việc CHƯA làm — để mỗi mục ở trên được coi là "xong thật" theo Evidence Contract

Toàn bộ 8 việc backlog đã có code + unit test xanh + build sạch, nhưng "code chạy + test mock
xanh" KHÔNG đồng nghĩa "đã chứng minh dưới điều kiện thật" — liệt kê đầy đủ để Codex audit
biết chính xác ranh giới đã kiểm chứng tới đâu, không báo cáo thổi phồng.

**Mục 1-2 (unique version + transaction/lock `confirmVersion`):**
- Migration `AddFilmVersionsUniqueIndex1722200000000` CHƯA chạy thật trên DB dev/staging.
  Nếu DB hiện có sẵn 2 version trùng `(film_id, version_no)` do bug cũ, migration sẽ FAIL —
  phải dọn dữ liệu trước khi chạy.
- Chưa có concurrency test thật (N request `confirmVersion` song song đo trước/sau), khác
  `recordView` đã có `test/concurrency/record-view.concurrency.mjs` làm mẫu.

**Mục 3 (transaction `create`/`update`):**
- Chưa có test tích hợp DB thật cho partial-state: giả lập lỗi ở bước ghi `film_links` và xác
  nhận `film` KHÔNG được ghi (rollback) — unit test hiện dùng mock, chỉ chứng minh code GỌI
  đúng trong 1 `transaction(...)`, chưa chứng minh MySQL thật rollback đúng khi lỗi giữa chừng.

**Mục 4 (upload-intent):**
- Migration `AddUploadIntents1722300000000` CHƯA chạy thật (cùng đợt với mục 1).
- `sweepExpired()` chỉ có unit test dùng mock repository — chưa test tích hợp DB thật xác
  nhận câu `WHERE status='pending' AND expires_at < now` đúng trên MySQL.
- Sweep là CƠ HỘI (throttle theo lần gọi `record()`), không phải cron cố định — nếu traffic
  ký URL thấp, rác tồn đọng lâu hơn dự kiến. Xem mục 7 (log ở trên) để quyết định có cần
  `@nestjs/schedule` thật hay không — đây là quyết định hạ tầng Tier C, cố ý chưa tự quyết.

**Mục 5 (ssoToken fail-closed):** đã verify bằng build thật (`grep` bundle), không còn gì tồn.

**Mục 6 (profile-guard multi-replica):**
- Guard mới (`MULTI_REPLICA` + `RUN_MIGRATIONS_ON_BOOT`) chưa được diễn tập trên deployment
  multi-replica thật (K8s/Swarm) — hiện chỉ có unit test cho `collectConfigIssues()`. Gate 4
  đầy đủ (theo skill `production-compatibility-gate`) còn đòi thêm: migration Job tách riêng,
  Redis throttler thật, test 3-replica (auth/revocation, rate-limit, upload-intent, pod
  restart) — TẤT CẢ đều ngoài phạm vi 8 việc backlog gốc.

**Mục 7-8 (HostAdapter/AuthTransport, Tier B):**
- Đây là SEAM, không phải implementation production — `browserHostAdapter` vẫn dùng
  `?ssoToken=` (chỉ dev) + `window.AMISBridge` giả định tên hàm chưa xác nhận;
  `localStorageAuthTransport` vẫn dùng localStorage nguyên trạng. Seam chỉ đảm bảo ĐỔI
  implementation sau này không phải sửa lại `App.vue`/`authStore.ts` — KHÔNG tự động làm 2 vấn
  đề bảo mật/tích hợp gốc biến mất. Cả hai vẫn cần quyết định thật ở Gate 2 (auth storage) và
  Gate 3 (bridge contract chính thức) trước khi coi là production-ready.

## 11. E2E thật trên MySQL — BẮT ĐƯỢC 1 BUG THẬT trong migration mục 1

Đã chạy `npm run test:e2e` (106 test, DB `kho_phim_e2e` DROP+CREATE lại từ đầu, toàn bộ
migration chạy từ DB rỗng qua `migrationsRun: true` — MySQL thật của `khophim-mysql`
container, không phải mock).

- **Lần chạy đầu (trước khi biết bug):** 106/106 test FAIL. Lỗi gốc:
  ```
  QueryFailedError: Cannot drop index 'IDX_film_versions_film': needed in a foreign key constraint
  ```
  Migration `AddFilmVersionsUniqueIndex1722200000000` (mục 1) DROP `IDX_film_versions_film`
  TRƯỚC khi tạo index mới — nhưng `FK_film_versions_film` đang DÙNG chính index đó làm chỗ
  dựa. MySQL/InnoDB từ chối drop index đang là chỗ dựa duy nhất của một FK. Lỗi này **hoàn
  toàn không lộ ra** ở unit test (repository mock, không đụng constraint thật) hay
  `tsc --noEmit` (không kiểm ràng buộc DB) — chỉ e2e trên MySQL thật mới bắt được. Đây đúng
  loại lỗi mà chuẩn Backend MISA cảnh báo: "không chỉ tin logic đọc được, phải kiểm bằng DB
  thật".
- **Sửa:** đổi thứ tự trong migration — TẠO index unique mới TRƯỚC (nó phủ được `film_id` ở
  vị trí đầu nên FK chuyển sang dùng ngay được), rồi mới DROP index cũ. `down()` cũng đảo
  ngược thứ tự tương ứng.
- **File:** `backend/src/database/migrations/1722200000000-AddFilmVersionsUniqueIndex.ts`.
- **Lần chạy lại sau khi sửa:** **106/106 e2e PASS.** Điều này đồng thời xác nhận: cả 3
  migration mới của đợt retrofit này (mục 1, mục 4/`AddUploadIntents`, và migration đã có từ
  trước) chạy SẠCH từ một DB MySQL rỗng — xoá được phần lớn nghi ngờ "chưa chạy migration
  thật" đã ghi ở mục "Việc CHƯA làm" bên dưới (chỉ còn áp dụng cho kịch bản nâng cấp một DB
  ĐÃ CÓ SẴN dữ liệu `film_versions` trùng `version_no` — khác với DB rỗng mà e2e vừa test).
- **Bài học quy trình bổ sung:** mọi migration đổi/xoá index trên cột đang có foreign key
  PHẢI test trên MySQL thật (e2e hoặc chạy tay), không đủ nếu chỉ đọc lại code — thêm vào
  checklist review PR cùng với mục "8. Bug tiện thể phát hiện" ở trên.
- **Đã kiểm tra RIÊNG (read-only) trên DB dev thật `kho_phim`** (container `khophim-mysql`
  đang chạy, KHÔNG phải `kho_phim_e2e`): `SELECT film_id, version_no, COUNT(*) ... HAVING
  c>1` trả về RỖNG — không có dữ liệu trùng sẵn có sẽ làm migration fail khi áp dụng thật.
  **CHƯA rebuild/restart `khophim-backend`** để áp dụng migration lên DB dev — container này
  đang chạy code CŨ (`build: ./backend`, cần `docker compose build backend` rồi restart mới
  nạp code mới, không tự nhận thay đổi qua bind-mount), và đó là dev stack người dùng có thể
  đang dùng để demo — chủ động KHÔNG tự rebuild/restart mà không hỏi trước. Khi bạn sẵn sàng:
  ```bash
  docker compose build backend && docker compose up -d backend
  ```

**Chung cho cả 8 mục:** đã chạy đủ backend unit (231 Jest) + backend e2e (106, MySQL thật) +
frontend unit (97 Vitest) + `tsc`/`vue-tsc --noEmit` + `npm run build`. Chưa chạy frontend
e2e/Playwright (nếu repo có) và chưa test tay trên trình duyệt thật luồng upload — khuyến
nghị làm trước khi merge vào nhánh chính, đặc biệt vì `confirmVersion`/`createUploadUrl` đã
đổi nhiều nhất trong đợt này.

## Phụ lục — remediation sau independent audit (2026-08-12)

Phần trạng thái ở trên là bằng chứng của **đợt retrofit ban đầu**. Sau independent audit, đã
thực hiện remediation tiếp theo: `claimForVersion()` conditional atomic trong transaction (chặn
cross-film và replay), Redis throttler bắt buộc khi `MULTI_REPLICA=true`, K8s migration Job +
upload-intent CronJob + PDB, và native composition cho tablet/AMIS host. Các câu “chưa
rebuild/restart” hay “sweep opportunistic là trạng thái cuối” ở phần lịch sử không còn là trạng
thái hiện hành.

Evidence hiện hành: **252/252 backend unit**, **107/107 e2e trên MySQL + MinIO thật**,
**105/105 frontend unit**, typecheck/build cả hai phía, Docker image backend mới khởi động
`/api/health/ready`, test đồng thời 30 upload video + 30 thumbnail pass, và manifest K8s/Compose
validate pass.

Bổ sung reliability evidence sau audit: rehearsal hai backend độc lập cùng MySQL/MinIO/Redis
đã cho đúng mười `401` xen kẽ và request login thứ 11 `429`; dừng Redis khiến readiness `503`,
phục hồi Redis đưa cả hai replica về `ready`. `scripts/rehearse-db-restore.sh` dump/restore vào
DB mới, không ghi đè source, và đối chiếu đúng `users/films/migrations = 6/8/10`. Những evidence
local này vẫn không thay thế Redis HA thật, rehearsal migration trên backup, rollout 3 Pod và QA
bridge/OS AMIS Mobile; các external gate đó phải được vận hành MISA ký xác nhận.
