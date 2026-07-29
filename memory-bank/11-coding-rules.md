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

## 4. Bảo mật (bổ sung cho baseline chung)

- **Không bao giờ nhận `storage_key`/`thumbnail_key` từ client** — server tự sinh bằng
  `randomUUID()`. Đây là bài học mang sang từ dự án AMIS Kho ảnh v2.
- **Không tin `Content-Type` client khai** cho file upload — kiểm magic bytes (`image-size`).
- **Mọi bí mật đọc qua `common/config/security.config.ts`**, không đọc thẳng `process.env`
  rải rác. Thêm biến bí mật mới thì thêm luôn kiểm tra vào `collectConfigIssues()`.
- **Thêm endpoint nhận id bản ghi từ request → phải kiểm quyền sở hữu**, dùng lại
  `FilmsService.assertCanManage`/`findManageableFilm` thay vì tự viết điều kiện mới.
- **Ghi `auditLog()` cho mọi hành động nhạy cảm mới** (xoá dữ liệu, đổi quyền, xuất hàng loạt).

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
  rào bảo mật. Xem cách làm ở `test/concurrency/record-view.concurrency.mjs`.

## 6. Kiểm thử

- **Chạy `npm test` ở CẢ backend lẫn frontend trước khi báo xong**, không chỉ phần vừa sửa.
- **Bốn lệnh test, đừng quên hai lệnh sau:**
  `cd backend && npm test` (129 unit) · `cd backend && npm run test:e2e` (46 tích hợp, cần
  `docker compose up -d mysql`) · `cd frontend && npm test` (26) ·
  `cd backend && npm run test:concurrency` (cần TOÀN BỘ stack chạy, mất ~2,5 phút).
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
