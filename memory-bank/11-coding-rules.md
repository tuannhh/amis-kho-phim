# AMIS Kho phim — Quy tắc code riêng của dự án

> **Vì sao có file này:** skill `misa-backend-standard` (Quy chuẩn Backend MISA) quy định rõ —
> quy tắc riêng của một dự án cụ thể thuộc về `memory-bank/11-coding-rules.md` của chính dự
> án đó, **không sửa vào skill chung**. File này gom lại các quy tắc riêng vốn nằm rải rác
> trong `05-decisions.md` và `06-activeContext.md`, để người/AI làm việc sau không phải đọc
> hết 36 ADR mới biết những cái bẫy đã có người vấp.
>
> **Quan hệ với quy chuẩn chung:** file này CHỈ bổ sung, không thay thế. Bộ quy tắc tổng quát
> vẫn là `~/.claude/skills/misa-backend-standard` — đọc skill đó trước, file này sau.
>
> Tạo ở GĐ7 (2026-07-29). Mỗi khi phát hiện bẫy mới, thêm vào đây kèm lý do.

---

## 1. TypeScript / build

- **KHÔNG dùng parameter property trong constructor của class lỗi** (vd `ApiError`) — khai
  báo field tường minh rồi gán trong thân constructor. FE bật kiểm tra tương đương
  `erasableSyntaxOnly` nên cú pháp rút gọn sẽ fail typecheck.
- **`tsconfig.app.json` (FE) phải giữ `paths: {"@/*": [...]}` và `allowJs: true`** — thiếu là
  `vue-tsc` không build production được. Dev server Vite vẫn chạy (chỉ transpile) nên lỗi này
  chỉ lộ ra lúc build, rất dễ mất thời gian truy tìm. Đừng xoá 2 dòng đó.
- **`retryAttempts`/`retryDelay` là mở rộng riêng của NestJS** — chỉ được truyền khi gọi
  `TypeOrmModule.forRoot`, TUYỆT ĐỐI không để trong `DataSourceOptions` dùng chung cho CLI
  migration (fail typecheck).
- **Backend có `tsconfig.build.json` riêng** loại trừ `**/*.spec.ts`. Đừng bỏ file này, nếu
  không file test sẽ bị biên dịch vào `dist` của image production.

## 2. Frontend / MDS

- **BẮT BUỘC gọi skill `misa-design-system` mỗi khi dựng hoặc sửa giao diện** — kể cả sửa nhỏ.
- **Dùng `undefined` cho trạng thái "chưa chọn", KHÔNG dùng `null`.** Component MDS gốc dùng
  `null` nhưng `MSelect` không nhận `null` trong kiểu `modelValue` khi gọi từ TypeScript.
  Toàn dự án đã thống nhất `undefined` — giữ nguyên quy ước này.
- **Tuyệt đối không dùng `v-html`** với dữ liệu do người dùng nhập (tên phim, mô tả, hashtag).
  Hiện toàn bộ FE không có `v-html` nào và đó là lý do dự án không có lỗ hổng XSS —
  xem `docs/danh-gia-an-ninh.md` mục 3.3. Nếu buộc phải dùng, phải sanitize trước và ghi ADR.
- **Kiểm UI bằng trình duyệt thật trước khi báo xong** — không kết luận bằng đọc code. Khi
  dùng công cụ browser, toạ độ click phải lấy từ `read_page`/`find` (ref), **KHÔNG áng chừng
  từ ảnh chụp**: screenshot-space và viewport-space không khớp 1:1 (đã suýt bị hiểu nhầm
  thành bug thật khi test GĐ2).

## 3. Cơ sở dữ liệu

- **Mọi thay đổi schema đều phải qua migration**, không sửa tay, không bật `synchronize`.
- **Đăng ký entity và migration TƯỜNG MINH** trong `db-options.ts` (không dùng glob) — để
  chạy đúng cả ở `dist` (.js) lẫn dev (.ts).
- **Đếm/cộng dồn phải atomic**: dùng `increment()` (sinh ra `SET x = x + 1`), không đọc-rồi-ghi.
  Xem ADR-023 (đếm lượt xem).

## 3b. Phân quyền — RBAC 4 cấp có scope phòng ban (từ 2026-08-05, ADR-040 → 044)

- **Có HAI nguồn sự thật vai trò và phải sửa CẢ HAI:** backend
  `modules/users/entities/role.entity.ts` (`RoleCode`, `ROLE_LEVEL`, `ROLE_NAME`,
  `FILM_WRITE_ROLES`) và frontend `features/auth/permissions.ts`. FE là **bản sao có chủ đích**
  để ẩn/hiện nút — lệch nhau sẽ làm người dùng thấy nút rồi bấm vào nhận 403, hoặc mất nút dù
  có quyền. Có test ở cả hai phía phủ đủ 4 cấp; sửa quy tắc phải sửa cả hai bộ test.
- **Thêm route GHI mới ⇒ PHẢI gắn `@Roles`.** Kiểm quyền sở hữu ở service (`assertCanManage`)
  **không thay thế** được `@Roles`. Đây đúng là lỗ hổng thật đã xảy ra: `POST /films` +
  3 route storage từng không có `@Roles` nào nên **mọi tài khoản đã đăng nhập đều tạo được
  phim**. Dùng `@Roles(...FILM_WRITE_ROLES)` cho route ghi phim, `@Roles('super_admin')` cho
  route quản trị — đừng khai lại danh sách vai trò tại chỗ.
- **KHÔNG nhét `departmentId` (hay bất cứ thứ gì quyết định phạm vi quyền) vào JWT** — đọc lại
  DB mỗi lần kiểm quyền (ADR-043). Token sống 15 phút, nếu mang theo phòng ban thì người vừa
  bị chuyển phòng vẫn giữ quyền cũ tới khi token hết hạn.
- **`films.department_id` là SNAPSHOT lúc tạo, không join động qua uploader** (ADR-042). Đừng
  "sửa" thành join cho "đồng bộ hơn" — đổi phòng ban của người dùng KHÔNG được làm đổi ngữ
  cảnh phòng ban của phim họ đã tạo.
- **`null` KHÔNG trùng `null` khi so phòng ban.** Phải kiểm tường minh `actorDept != null`
  trước khi so sánh; nếu không, mọi Trưởng phòng chưa gán phòng ban sẽ quản được toàn bộ phim
  cũ có `department_id = NULL`.
- **Trạng thái "chưa gán phòng ban" trong MSelect dùng value `0`, không dùng `undefined`** —
  `undefined` đã là "chưa chọn gì" theo quy ước dự án (§2), dùng lẫn sẽ không phân biệt được
  với "chọn có chủ đích là không thuộc phòng ban nào".
- **Bỏ vai trò/thêm vai trò ⇒ grep toàn repo** (`RoleCode`, tên vai trò dạng chuỗi) kể cả
  `seed.service.ts`, test, script `test/concurrency/*.mjs`, docs và Swagger example. Vai trò
  `admin` cũ đã bị loại bỏ hoàn toàn — nếu thấy chuỗi `'admin'` ở đâu trong code vai trò thì
  đó là sót, không phải hợp lệ.

## 4. Bảo mật (bổ sung cho baseline chung)

- **Không bao giờ nhận `storage_key`/`thumbnail_key` từ client** — server tự sinh bằng
  `randomUUID()`. Đây là bài học mang sang từ dự án AMIS Kho ảnh v2.
- **Không tin `Content-Type` client khai** cho file upload — kiểm magic bytes (`image-size`).
- **Mọi bí mật đọc qua `common/config/security.config.ts`**, không đọc thẳng `process.env`
  rải rác. Thêm biến bí mật mới thì thêm luôn kiểm tra vào `collectConfigIssues()`.
- **Thêm endpoint nhận id bản ghi từ request → phải kiểm quyền sở hữu**, dùng lại
  `FilmsService.assertCanManage`/`findManageableFilm` thay vì tự viết điều kiện mới.
- **Ghi `auditLog()` cho mọi hành động nhạy cảm mới** (xoá dữ liệu, đổi quyền, xuất hàng loạt).
- **Presigned upload phải được claim atomically trước khi tạo `FilmVersion`.** Điều kiện claim
  luôn gồm `storageKey + kind + filmId + actorId + status=pending + expiresAt>now`, thực hiện
  bằng một `UPDATE` trong cùng transaction; không dùng `find` rồi `update`, và không đánh dấu
  consume sau khi đã lưu version. Đây là hàng rào ownership và chống replay/race (ADR-075).

## 5. Nghiệp vụ — những hành vi trông như bug nhưng là CHỦ ĐÍCH

Ghi ở đây để người sau không "sửa" nhầm:

- **Chuông thông báo luôn rỗng.** Việc bắn thông báo đã bị TẮT có chủ đích (2026-07-22, quyết
  định của người dùng): 3 lời gọi `notifications.notify()` trong `FilmsService` đã comment
  lại vì thực tế có rất nhiều phim đăng lên, thông báo mỗi lần cho toàn bộ nhân viên sẽ gây
  spam. Hạ tầng (bảng, service, 4 endpoint, panel FE) vẫn giữ nguyên để bật lại sau.
  **Nếu bật lại**, cân nhắc sửa luôn hành vi tự gắn lại tag "Phim mới" ở `update()`.
- **Sửa metadata phim làm phim nhảy lên đầu danh sách và gắn lại nhãn "Phim mới"** — hành vi
  có từ GĐ0.5, đã biết, chưa đổi vì chưa có yêu cầu.
- **`/media/:key` là `@Public` có chủ đích** (ADR-021) — thẻ `<video src>` không gắn được
  header `Authorization`. Đây KHÔNG phải quên kiểm quyền. Rủi ro đã đánh giá và ghi nhận
  (R-09), hướng xử lý ở production là presigned GET ngắn hạn.
- **`session_hash` trong bảng `film_views` được ghi nhưng KHÔNG dùng để dedupe** (ADR-023) —
  dedupe theo `user_id`. Cột giữ lại cho nhu cầu tương lai, không phải code chết bị quên.
- **Stack dev chạy `NODE_ENV=production`** — do Dockerfile pin sẵn. Vì vậy cổng chặn cấu hình
  là `ALLOW_INSECURE_CONFIG`, không phải `NODE_ENV` (ADR-032). Đừng "dọn dẹp" chỗ này.

## 5b. Bẫy đồng thời & múi giờ (bài học GĐ7 — tốn công mới tìm ra)

- **Bất kỳ luồng nào "đọc để quyết định rồi mới ghi" đều phải nằm trong giao dịch có khoá
  dòng.** Đã dính đúng lỗi này ở `recordView`: kiểm trùng nằm ngoài giao dịch nên 20 request
  song song của cùng một người dùng đều vượt qua bước kiểm → tính 4 lượt thay vì 1. Sửa bằng
  `manager.transaction` + `lock: { mode: 'pessimistic_write' }` (ADR-036). **Nếu thêm luồng
  tương tự (vd đăng ký suất giới hạn, gán tài nguyên duy nhất) → áp dụng đúng khuôn này.**
- **Test tuần tự KHÔNG BAO GIỜ lộ ra lỗi loại trên.** Bắt buộc chạy
  `npm run test:concurrency` khi sửa bất cứ thứ gì chạm `recordView`.
- **Kết nối MySQL đã ép `timezone: 'Z'`** (`db-options.ts`) — ĐỪNG XOÁ. Không có nó, driver
  dùng múi giờ cục bộ của tiến trình Node; chạy trong Docker (UTC) thì trùng nên không thấy
  gì, nhưng chạy từ máy dev VN (+07) thì mọi so sánh thời gian lệch 7 tiếng. Đây là lý do
  cửa sổ dedupe 30 phút từng sai hoàn toàn khi chạy e2e từ host.
- **Khi test đụng rate limit, ĐỪNG nới ngưỡng cho dễ test** — giãn nhịp gọi thay vì hạ hàng
  rào bảo mật. Xem cách làm ở `test/concurrency/record-view.concurrency.mjs`. Điều này áp cả
  khi **kiểm thủ công bằng curl**: `/auth/login` giới hạn 10 lần/phút/IP, đăng nhập nhiều tài
  khoản liên tiếp sẽ nhận `429` và trả về token RỖNG → mọi request sau đó ra `401` trông như
  lỗi phân quyền. Đã mất công một lần vì chuyện này — hãy giãn ~7s giữa các lần đăng nhập.

## 5c. Bẫy mới từ ĐỢT 2 (2026-08-07)

- **KHÔNG tự tính nhãn "Phim mới" ở FE.** Dùng `ApiFilm.isNew` do backend trả (ADR-052).
  `isFilmNew(publishedAt)` đã bị gỡ khỏi FE có chủ đích — thêm lại là tạo nguồn sự thật thứ
  hai và sẽ SAI ở trang chi tiết (trang đó chỉ tải một phim, không biết có phim nào trùng tên
  mới hơn không).
- **KHÔNG dựng lại endpoint upload nhận multipart cho file người dùng.** `multer` mặc định là
  `memoryStorage` → buffer cả file trong RAM tiến trình Node. Mọi file người dùng đẩy lên đều
  phải đi presigned PUT thẳng lên MinIO (ADR-055). Nếu cần kiểm nội dung file, đọc vài chục KB
  đầu bằng GET có Range sau khi file đã nằm trên storage, đừng kéo cả file về.
- **Thêm bộ đếm mới: cân nhắc có cần dedupe không, đừng sao chép mù `recordView`.**
  `recordView` phức tạp (giao dịch + khoá dòng) vì nó "đọc để quyết định rồi mới ghi".
  `recordDownload` chỉ có một câu `increment()` nên không cần gì thêm (ADR-054). Chép nguyên
  khuôn khoá dòng vào chỗ không cần chỉ làm chậm và khó đọc.
- **Mở một endpoint cho thêm vai trò ⇒ phải quyết định PHẠM VI DỮ LIỆU ở server, không phải ẩn
  bớt ở FE.** Xem `ReportsService.resolveDepartmentScope`: tham số phạm vi client gửi lên bị
  bỏ qua với Cấp 3. FE ẩn ô chọn phòng ban chỉ để giao diện không hứa điều làm không được.
- **Cấp 3 chưa gán phòng ban → trả RỖNG, không được rơi vào nhánh "không lọc".** Cùng họ với
  bẫy "`null` không trùng `null`" ở §3b, nhưng hậu quả nặng hơn: rò dữ liệu toàn công ty.
- **Nút chính của form nhúng trong dialog phải nằm ở footer của DIALOG**, không để trong vùng
  cuộn của form (dùng prop `hideFooter` + `defineExpose` của `FilmForm`). Đã vấp đúng lỗi này
  khi kiểm trên trình duyệt: nút Lưu bị trôi khỏi tầm nhìn còn dialog lại hiện nút "Đóng" thừa.

## 6. Kiểm thử

- **Chạy `npm test` ở CẢ backend lẫn frontend trước khi báo xong**, không chỉ phần vừa sửa.
- **Bốn lệnh test, đừng quên hai lệnh sau:**
  `cd backend && npm test` (252 unit) · `cd backend && npm run test:e2e` (107 tích hợp, cần
  `docker compose up -d mysql minio`) · `cd frontend && npm test` (105) ·
  `cd backend && npm run test:concurrency` (cần TOÀN BỘ stack chạy, mất ~2,5 phút) ·
  `cd backend && npm run test:concurrency:upload` (tải đồng thời luồng upload, ~10 giây).
- **e2e dùng database RIÊNG `kho_phim_e2e`**, tự DROP+CREATE mỗi lần chạy. Có chốt an toàn
  chặn nếu ai đó trỏ nhầm vào `kho_phim` của dev.
- **Ưu tiên theo rủi ro, không chạy đua tỷ lệ bao phủ**: guard, phân quyền, auth, SSO, chốt
  chặn cấu hình, xuất CSV. Cố ý không test cơ học CRUD không có logic.
- **Không mock kiểu che lỗi**: nếu một test cần mock quá nhiều mới chạy được, xem lại thiết kế
  thay vì nới assertion.
- `bcryptjs` **không `spyOn` được** (export không configurable). Muốn khẳng định có gọi bcrypt
  thì đo hành vi (thời gian) thay vì spy — xem `auth.service.spec.ts`.

## 7. Docker / vận hành

- **Sửa `nginx/nginx.conf` xong phải `docker compose restart nginx`** — file mount read-only,
  `up -d --build` KHÔNG nạp lại config. Đã một lần tưởng nhầm là header bị thiếu.
- **Dockerfile dùng `npm ci`, không `npm install`** (khoá phiên bản, chống supply-chain).
  Backend có `--ignore-scripts`; **frontend CỐ Ý KHÔNG có** vì `sharp` cần postinstall.
- **Docker Compose hiện tại chỉ dành cho dev** — không dùng cho production
  (xem `docs/devops-handoff.md` mục 2).
- **`MULTI_REPLICA=true` bắt buộc có `REDIS_URL`.** Rate limit phải dùng Redis dùng chung; job
  migration chạy một lần tách khỏi web Deployment; cleanup upload-intent chạy bằng CronJob,
  không theo request ở từng Pod. Xem `deploy/k8s/README.md` và ADR-075.
- **Multi-replica chỉ được coi là verified sau rehearsal 2 process.** Dùng
  `scripts/rehearse-multi-replica.sh` (tự dựng overlay + flush Redis) rồi chạy assertion;
  kết quả bắt buộc là mười `401` xen kẽ và request 11 là `429`. Readiness phải hạ `503` khi Redis
  không reachable; không dùng liveness để restart mù vì lỗi dependency.
- **Rehearsal backup/restore không được ghi đè source.** Chạy `scripts/rehearse-db-restore.sh`;
  target phải có prefix `kho_phim_restore_rehearsal`, script fail nếu target tồn tại và không tự
  DROP database. Điều này là bằng chứng backup restore, khác với migration rehearsal pre-release.
