# AMIS Kho phim — Đánh giá an ninh thông tin (GĐ7)

> **Khung đối chiếu:** skill `misa-backend-standard` → `references/02-security-baseline.md`
> (Quy chuẩn Backend MISA). Các hạng mục dưới đây bám đúng thứ tự 9 mục của baseline đó,
> không phải danh sách tự do.
>
> **Phạm vi rà soát:** backend NestJS (`backend/src/**`), frontend Vue (`frontend/src/**`),
> `nginx/nginx.conf`, `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`,
> `.env.example`. Bao gồm cả endpoint SSO AMIS Mobile mới của GĐ6.1.
>
> **Thời điểm:** 2026-07-29 · **Trạng thái mã nguồn:** sau hardening GĐ7 **và bản bổ sung
> đạt chuẩn** (kiểm thử tích hợp, kiểm thử đồng thời, CI, quét phụ thuộc).
>
> **🔄 CẬP NHẬT 2026-08-05 — RBAC 4 CẤP CÓ SCOPE PHÒNG BAN.** Mục **2. Phân quyền** đã được rà soát
> lại sau khi thay thế hoàn toàn 3 vai trò cũ bằng 4 cấp có scope phòng ban (ADR-040 → 044). Đợt này
> **bịt một lỗ hổng phân quyền THẬT** mà bản đánh giá 2026-07-29 chưa phát hiện — xem mục 2.9 mới bổ
> sung. Các mục 1, 3–9 không bị ảnh hưởng và giữ nguyên kết luận cũ.
>
> **Quy ước:** ✅ Đạt · ⚠️ Đạt một phần · ❌ Chưa đạt · ➖ Không áp dụng.
> Mọi kết luận đều kèm bằng chứng `file:dòng` — không suy đoán (nguyên tắc 3 của skill).
> Số dòng theo mã nguồn tại thời điểm lập tài liệu.

---

## Tóm tắt điều hành

| Mục baseline | Đạt | Đạt một phần | Chưa đạt | Không áp dụng |
|---|:--:|:--:|:--:|:--:|
| 1. Xác thực | 6 | 2 | 1 | 3 |
| 2. Phân quyền | 9 | 0 | 0 | 1 | ← rà soát lại 2026-08-05 (RBAC 4 cấp)
| 3. Chống injection | 6 | 1 | 0 | 1 |
| 4. Quản lý secrets | 4 | 1 | 0 | 0 |
| 5. Cấu hình sai an toàn | 6 | 1 | 0 | 0 |
| 6. Chuỗi cung ứng | 3 | 1 | 0 | 0 |
| 7. Audit log | 1 | 2 | 0 | 0 |
| 8. Security headers | 4 | 2 | 0 | 0 |
| 9. Dữ liệu cá nhân (PII) | 2 | 1 | 0 | 0 |

**Đã tự sửa trong GĐ7: 14 vấn đề** (12 ở đợt đầu + 2 lỗi ĐÚNG ĐẮN DỮ LIỆU chỉ phát hiện được
nhờ đợt bổ sung kiểm thử — xem khung dưới). **Còn treo cho DevOps/chủ dự án: 9 vấn đề** (đều
có lý do cụ thể, phần lớn là đổi kiến trúc hoặc cần quyết định nghiệp vụ).

> ### 🔴 Hai lỗi THẬT phát hiện ở đợt bổ sung — đều vô hình với kiểm thử tuần tự có mock
>
> **1. Race condition ở đếm lượt xem (`recordView`) — ĐÃ SỬA.**
> Câu đọc quyết định dedupe nằm ngoài giao dịch và không khoá dòng. Đo thật bằng
> `backend/test/concurrency/record-view.concurrency.mjs`: **1 người dùng mới gửi 20 request
> song song làm `view_count` tăng 4 thay vì 1.** Đúng mẫu lỗi mô tả ở chuẩn
> `05-database-rules.md` §3. Sửa bằng giao dịch + khoá dòng `pessimistic_write` (ADR-036).
> Đo lại sau khi sửa: tăng đúng **1**.
>
> **2. Phụ thuộc ngầm vào múi giờ giữa Node và MySQL — ĐÃ SỬA.**
> Kết nối MySQL không khai báo múi giờ, nên driver dùng múi giờ cục bộ của tiến trình Node.
> Trong Docker cả hai đều UTC nên trùng nhau và mọi thứ "có vẻ đúng"; nhưng khi tiến trình
> chạy ở múi giờ khác (máy dev VN +07), cửa sổ dedupe 30 phút lệch 7 tiếng → **cùng một
> người dùng bị tính lượt xem nhiều lần**. Phát hiện khi chạy kiểm thử tích hợp từ máy host.
> Sửa bằng `timezone: 'Z'` trong cấu hình kết nối (ADR-037), đúng `05-database-rules.md` §5.
>
> Cả hai đều là **lỗi đúng đắn dữ liệu**, không phải lỗ hổng bảo mật — nhưng ghi ở đây vì
> chúng chứng minh vì sao chuẩn bắt buộc phải có kiểm thử đồng thời và kiểm thử tích hợp,
> chứ không chấp nhận "đã có unit test là đủ".

**Kết luận tổng quát:** không tìm thấy đường leo thang đặc quyền nào từ một tài khoản nhân
viên hợp lệ. Rủi ro nghiêm trọng nhất mang tính **cấu hình triển khai** (secret mặc định
`change-me` nằm sẵn trong repo) — đã chặn bằng cơ chế từ chối khởi động, với điều kiện
DevOps xoá cờ `ALLOW_INSECURE_CONFIG`.

---

## 1. Xác thực (Authentication)

| # | Hạng mục baseline | Trạng thái | Bằng chứng / Ghi chú |
|---|---|:--:|---|
| 1.1 | Không tự phát minh cơ chế hash mật khẩu | ✅ | `bcryptjs` cost 10 — `users.service.ts:29` (`BCRYPT_ROUNDS = 10`), dùng ở `:114`, `:158`. Không có MD5/SHA tự chế. |
| 1.2 | Chọn session vs token theo đặc điểm hệ thống | ✅ | JWT stateless, hợp lý cho SPA tách rời + dự kiến nhúng WebView (ADR-012). |
| 1.3 | Không lưu token ở `localStorage` | ❌ | **Còn treo.** Access + refresh token nằm ở `localStorage`, đọc qua `authStore`; `http.ts:31` gắn Bearer. Baseline yêu cầu ưu tiên cookie `httpOnly`. |
| 1.4 | Chống session fixation | ➖ | Không có session phía server. Mỗi lần đăng nhập cấp token mới hoàn toàn (`auth.service.ts:issueTokens`). |
| 1.5 | SSO: xác minh chữ ký thật trước khi tin nội dung | ⚠️ | `auth.service.ts:verifySsoToken` xác minh HMAC **trước** khi parse payload — đúng thứ tự. Nhưng HMAC shared-secret là **placeholder**, không phải OIDC/JWKS thật (ADR-030). |
| 1.6 | Không có backdoor đăng nhập ở môi trường thật | ✅ | Đã rà: không có route bypass. `AMIS_SSO_SHARED_SECRET` rỗng → trả 501 (`auth.service.ts:49-51`); secret ngắn cũng → 501 (`:52-57`). Cờ tách biệt, không dùng chung cờ môi trường. |
| 1.7 | **Ép cứng thuật toán ký JWT** | ✅ | **ĐÃ SỬA GĐ7.** `JWT_ALGORITHM='HS256'` (`security.config.ts`), truyền vào `verify` ở `jwt-auth.guard.ts:41-46` + `auth.service.ts:137`, và `sign` ở `:167`, `:175`. Có test chặn `alg:none` và HS512. |
| 1.8 | Access token ngắn hạn | ✅ | 15 phút mặc định (`JWT_ACCESS_TTL`). |
| 1.9 | **Cơ chế thu hồi token trước khi hết hạn** | ❌ | **Còn treo.** Đổi mật khẩu không vô hiệu hoá refresh token đã cấp (`users.service.ts:changePassword` chỉ đổi hash). Khoá tài khoản có chặn ở `/auth/refresh` (`auth.service.ts:findActiveEntity`) nhưng access token vẫn sống ≤ 15 phút. |
| 1.10 | Rate limit endpoint xác thực | ✅ | **ĐÃ SỬA GĐ7.** `auth.controller.ts` bọc `ThrottlerGuard`; login 10/phút, refresh 30/phút, SSO 10/phút, đổi mật khẩu 10/phút. Đã test thật (xem cuối tài liệu). |
| 1.11 | CSRF token cho hành động đổi trạng thái | ➖ | Xác thực bằng Bearer header, không bằng cookie → trình duyệt không tự đính kèm chứng danh khi bị site khác gọi. CSRF cổ điển không áp dụng. **Sẽ áp dụng trở lại nếu chuyển sang cookie theo 1.3.** |
| 1.12 | Thông điệp lỗi không lộ email tồn tại | ✅ | `auth.service.ts:28,31` cùng một thông điệp; có test so sánh hai thông điệp phải giống hệt. |
| 1.13 | Chống dò tài khoản qua thời gian phản hồi | ✅ | **ĐÃ SỬA GĐ7.** Email không tồn tại vẫn chạy `bcrypt.compare` với `DUMMY_HASH` (`auth.service.ts:19-24`, dùng ở `:28`). Đo thực tế 78ms, tương đương nhánh thật. |

**Rủi ro còn treo ở mục 1**

| Mã | Rủi ro | Mức | Vì sao không tự sửa |
|---|---|:--:|---|
| R-01 | Token ở `localStorage` (1.3) | Trung bình | Đổi sang cookie `httpOnly` kéo theo phải thêm CSRF protection, sửa toàn bộ `http.ts` + `authStore` + luồng refresh. Là thay đổi kiến trúc xác thực, vượt xa phạm vi hardening và cần chủ dự án quyết định. Rủi ro thực tế hiện thấp vì chưa tìm thấy đường XSS nào (mục 3.3). |
| R-02 | Không thu hồi được refresh token (1.9) | Trung bình | Cần thêm cột `users.token_version` (migration) + kiểm ở guard → phát sinh **một truy vấn DB cho mọi request**, đổi đặc tính hiệu năng toàn hệ thống. Cần đo và quyết định, không nên làm vội ở giai đoạn cuối. |
| R-03 | SSO dùng HMAC placeholder, chưa có nonce chống replay (1.5) | Trung bình | Toàn bộ cơ chế đang chờ spec thật từ đội AMIS Mobile (ADR-029/030) và nhiều khả năng bị thay hẳn bằng OIDC. Xây kho nonce cho cơ chế sắp bị vứt là lãng phí. **Đã giảm thiểu:** trần TTL 300s + bắt buộc secret ≥ 32 ký tự + rate limit. Tính năng TẮT mặc định. |

---

## 2. Phân quyền (Authorization)

| # | Hạng mục baseline | Trạng thái | Bằng chứng / Ghi chú |
|---|---|:--:|---|
| 2.1 | Kiểm quyền ở server, không tin client | ✅ | Guard toàn cục `JwtAuthGuard` + `RolesGuard` (`app.module.ts:45-47`). FE chỉ ẩn/hiện nút cho UX. |
| 2.2 | Mô hình phân quyền tương xứng nghiệp vụ | ✅ | **[Cập nhật 2026-08-05]** RBAC **4 cấp** + owner policy + **scope theo phòng ban** cho Cấp 3 (`role.entity.ts`, ADR-040). Vẫn là RBAC thuần (không ABAC): scope chỉ dựa trên 1 thuộc tính `department_id` đã lưu sẵn, không phải chính sách động — đúng mức baseline §2 khuyến nghị. |
| 2.3 | Cách ly dữ liệu theo đơn vị | ➖ | Kho phim **XEM** dùng chung toàn công ty (chủ đích nghiệp vụ: mọi nhân viên xem được mọi phim), không có nhiều tổ chức độc lập. Phòng ban chỉ giới hạn quyền **GHI** của Cấp 3, không giới hạn quyền đọc. Riêng thông báo có lọc theo người dùng (2.5). |
| 2.4 | Không tin trường có ý nghĩa phân quyền do client gửi | ✅ | `uploaderId` lấy từ token (`films.service.ts` — `uploaderId: actor.id`), không nhận từ body. **[Mới]** `films.department_id` snapshot từ DB của người tạo qua `UsersService.getDepartmentId`, **KHÔNG** nhận từ DTO — đã có e2e gửi kèm `departmentId` của phòng khác và xác nhận bị bỏ qua. `users.departmentId` được validate tồn tại thật trước khi lưu (`users.service.ts` `resolveDepartmentId`). `createdBy` tương tự. `storage_key` sinh 100% ở server. |
| 2.5 | **IDOR — kiểm quyền sở hữu, không chỉ đăng nhập** | ✅ | **[Viết lại 2026-08-05]** `FilmsService.assertCanManage` nay có 4 nhánh: Cấp 1 luôn từ chối · Cấp 2 so `film.uploaderId === actor.id` · Cấp 3 so `film.departmentId === actor.departmentId` **VÀ** `uploader.roleCode === 'employee'` · Cấp 4 cho qua. Gọi ở `update`/`remove`/`findManageableFilm` (dùng chung cho cả 3 endpoint storage). **Dữ liệu quyết định đọc từ DB, không từ JWT** (ADR-043). Thông báo lọc theo `actor.id`. Đã phủ **17 ca unit + 17 ca e2e** cho scope phòng ban. |
| 2.6 | Endpoint danh mục dùng chung giới hạn cấp cao | ✅ | **[Siết thêm 2026-08-05]** `/categories` ghi chỉ **`super_admin`** (`categories.controller.ts`, trước là `super_admin`+`admin`); `/users`, `/reports`, **`/departments`** (mới) gắn `@Roles('super_admin')` ở cấp controller. Danh mục phòng ban quyết định ranh giới phân quyền của Cấp 3 nên khoá cả quyền ĐỌC ở Cấp 4 (quyền tối thiểu). |
| 2.7 | **Mass assignment** | ✅ | `ValidationPipe({ whitelist: true })` (`main.ts`) loại bỏ mọi field lạ. **[Cập nhật]** `CreateUserDto`/`UpdateUserDto` chặn `roleCode: 'super_admin'` bằng `@IsIn(ASSIGNABLE_ROLE_CODES)` (`create-user.dto.ts`) — cũng chặn luôn giá trị `'admin'` cũ; quyền gán còn được kiểm lại ở service qua `creatableRoles`. E2E xác nhận cả `roleCode:'super_admin'` và `roleCode:'admin'` đều → 400. |
| 2.8 | Ma trận quản lý người dùng | ✅ | **[Cập nhật 2026-08-05]** `UsersService.assertCanManage`: không tự tác động chính mình, **chỉ Cấp 4** quản lý người dùng, không đụng Cấp 4 khác. Cấp 3 KHÔNG có quyền quản trị tài khoản (khác `admin` cũ — ADR-044). Endpoint mới `PATCH /users/:id` (đổi vai trò/phòng ban) dùng lại đúng `assertCanManage` + `creatableRoles`, ghi `auditLog('user.update')` kèm giá trị trước/sau. Phủ 20 test. |
| 2.9 | **Route ghi phải có `@Roles`, không dựa mỗi kiểm tra phía sau** | ✅ | **HẠNG MỤC MỚI — bịt lỗ hổng THẬT (2026-08-05).** Bản đánh giá 2026-07-29 **đã bỏ sót**: `POST /films`, `POST /films/:id/upload-url`, `POST /films/:id/thumbnail`, `POST /films/:id/versions` **không gắn `@Roles` nào**, nên **mọi tài khoản đã đăng nhập đều tạo được phim** — kể cả vai trò thấp nhất. Nguyên nhân bỏ sót: rà soát cũ chỉ kiểm "endpoint có kiểm quyền sở hữu chưa" (2.5) mà không kiểm "vai trò nào được phép GỌI endpoint này". Nay cả **7 route ghi** của `/films` (thêm cả `PATCH`/`DELETE` cho phòng thủ nhiều lớp) đều gắn `@Roles(...FILM_WRITE_ROLES)`; Cấp 1 bị chặn ngay ở guard, `assertCanManage` là lớp thứ hai. Verify: 8 ca e2e + probe API thật bằng token Cấp 1 → 403 trên cả 7 route. |

**Không có rủi ro treo ở mục 2.**

**Bài học rút ra cho các đợt rà soát sau:** kiểm IDOR (2.5) và kiểm `@Roles` (2.9) là **hai câu hỏi
khác nhau** — một endpoint có thể kiểm quyền sở hữu rất chặt nhưng vẫn thiếu chốt "ai được phép gọi",
và ngược lại. Rà soát phải liệt kê **toàn bộ route ghi** rồi đối chiếu từng route với ma trận phân
quyền, thay vì chỉ đi theo các hàm kiểm quyền đã có.

---

## 3. Chống các lỗ hổng tiêm nhiễm (Injection)

| # | Hạng mục baseline | Trạng thái | Bằng chứng / Ghi chú |
|---|---|:--:|---|
| 3.1 | Không nối chuỗi vào câu truy vấn | ✅ | Quét toàn bộ `backend/src` với `.query(`, `getRawMany`, `getRawOne`: **không có kết quả nào** ngoài `SELECT 1` cố định ở readiness probe (`health.controller.ts`, không có tham số động). Toàn bộ đi qua TypeORM repository/QueryBuilder tham số hoá, ví dụ `users.service.ts:62` (`where('u.email = :email', { email })`). |
| 3.2 | Không nối chuỗi vào lệnh hệ điều hành | ➖ | Không có chỗ nào gọi shell/`child_process` trong `backend/src`. |
| 3.3 | Chống XSS | ✅ | Không có `v-html`, `innerHTML`, `dangerouslySetInnerHTML` ở bất kỳ đâu trong `frontend/src` (đã quét). Vue tự escape khi interpolation. |
| 3.4 | **CSV / Formula injection** | ✅ | **ĐÃ SỬA GĐ7.** Baseline yêu cầu "escape đúng ngữ cảnh" — CSV mở bằng Excel là một ngữ cảnh riêng. Ô bắt đầu bằng `= + - @ Tab CR` được thêm nháy đơn dẫn đầu (`reports.service.ts:toCsv`). Có test cho từng ký tự. |
| 3.5 | SSRF | ✅ | Không có chỗ nào server tự gọi URL do client cung cấp. Link ngoài (YouTube/Drive) **chỉ được lưu và render ở client**, backend không bao giờ tự fetch — đã xác minh `films.service.ts:linksFromDto` chỉ trim và lưu chuỗi. |
| 3.6 | Giới hạn kích thước/định dạng input ở server | ✅ | Mọi DTO có `@MaxLength` (vd `film.dto.ts:28` mô tả 2000 ký tự, `:33` tối đa 20 hashtag). Ảnh bìa ≤ 15MB (`films.controller.ts:89`). Video theo `MAX_UPLOAD_MB`. |
| 3.7 | Kiểm định dạng file thật bằng magic bytes | ✅ | `films.service.ts:saveThumbnail` dùng `image-size` đọc magic bytes, từ chối nếu type không thuộc jpg/png/webp — **không tin** `Content-Type` client khai. Còn ép tỷ lệ 16:9. |
| 3.8 | **Giới hạn dung lượng thực tế của file đã upload** | ⚠️ | **ĐÃ SỬA MỘT PHẦN GĐ7.** Presigned PUT của S3 không ràng buộc `Content-Length` → client xin URL cho 1MB vẫn PUT được 50GB. Nay `confirmVersion` kiểm size THẬT do MinIO báo, vượt hạn thì từ chối **và xoá object rác** (`films.service.ts` trong nhánh `if (dto.storageKey)`). Xem R-04. |
| 3.9 | Deserialization không an toàn | ✅ | Chỉ dùng `JSON.parse` chuẩn, và chỉ sau khi đã xác minh chữ ký HMAC (`auth.service.ts:verifySsoToken` — parse ở `:82`, sau bước verify ở `:73-78`). |

**Rủi ro còn treo ở mục 3**

| Mã | Rủi ro | Mức | Vì sao không tự sửa |
|---|---|:--:|---|
| R-04 | Khoảng trống giữa lúc PUT và lúc `confirmVersion`: kẻ tấn công có quyền upload vẫn ghi được file lớn lên storage rồi không bao giờ gọi confirm → object mồ côi chiếm dung lượng (3.8) | Thấp | Chặn triệt để cần ràng buộc `Content-Length` vào chữ ký presigned (rủi ro làm hỏng luồng upload đang chạy nếu trình duyệt gửi lệch dù chỉ 1 byte) hoặc lifecycle policy phía MinIO. Là quyết định vận hành, đã ghi vào `devops-handoff.md`. Chỉ khai thác được bởi tài khoản nội bộ hợp lệ. |

---

## 4. Quản lý cấu hình nhạy cảm (Secrets Management)

| # | Hạng mục baseline | Trạng thái | Bằng chứng / Ghi chú |
|---|---|:--:|---|
| 4.1 | Không commit secret thật vào mã nguồn | ✅ | Quét `backend/src`: không còn secret nào hardcode sau khi bỏ fallback `'change-me'`. `.env` nằm trong `.gitignore`. Giá trị trong `.env.example` là mẫu dev, không phải secret thật. |
| 4.2 | Tách 2 tầng cấu hình | ✅ | `.env.example` (commit, giá trị mẫu) vs `.env` (không commit). |
| 4.3 | **Production từ chối khởi động khi còn secret mặc định** | ✅ | **ĐÃ SỬA GĐ7 — đây là sửa đổi quan trọng nhất của giai đoạn.** `assertSecureConfig()` gọi ngay đầu `bootstrap()` (`main.ts:12`), logic ở `security.config.ts`. Chặn: secret trống/mặc định/< 32 ký tự, access trùng refresh, MinIO còn `minioadmin`, endpoint còn `localhost`, mật khẩu seed còn mẫu, SSO secret yếu. 16 test phủ. |
| 4.4 | Không log giá trị bí mật | ✅ | `audit-log.ts` che tự động mọi khoá khớp `/pass\|secret\|token\|key\|hash\|authorization\|credential/i`, có 7 test. Thông điệp cấu hình chỉ nêu **tên biến**, không in giá trị (ngoại lệ có chủ đích: `MINIO_PUBLIC_ENDPOINT` — là URL, không phải bí mật). |
| 4.5 | Rotate định kỳ + quy trình khi lộ secret | ⚠️ | Chưa có quy trình rotate. Đã ghi khuyến nghị vào `devops-handoff.md`. Là việc vận hành, không phải mã nguồn. |

> ⚠️ **Cảnh báo bàn giao quan trọng:** chuỗi `change-me` / `minioadmin` / `Admin@12345` đã
> nằm trong lịch sử git công khai của repo. Theo baseline §4, mọi giá trị đã lộ phải coi là
> bị xâm phạm. Không được dùng lại bất kỳ giá trị nào trong số đó ở môi trường thật — cơ chế
> ở 4.3 chặn đúng việc này.

---

## 5. Cấu hình sai an toàn (Security Misconfiguration)

| # | Hạng mục baseline | Trạng thái | Bằng chứng / Ghi chú |
|---|---|:--:|---|
| 5.1 | Không lộ stack trace/chi tiết kỹ thuật ra response | ✅ | Bộ lọc lỗi mặc định của Nest trả `{statusCode, message, error}`, không kèm stack. Readiness probe cố ý **không** trả thông điệp lỗi DB gốc (`health.controller.ts` — chỉ `database: 'unreachable'`). |
| 5.2 | Công cụ quản trị không mở ra mạng công khai | ✅ | **ĐÃ SỬA GĐ7.** Swagger `/api/docs` mặc định TẮT ở production, chỉ bật khi `ENABLE_API_DOCS=true` (`main.ts:57`) — ADR-031. MinIO console chỉ map cổng ở compose dev. |
| 5.3 | Không để tài khoản mẫu với mật khẩu mặc định | ✅ | Tài khoản do admin tạo luôn `mustChangePassword=true` (`users.service.ts:123`); mật khẩu tạm sinh bằng `randomBytes` (`:163-169`), không phải giá trị cố định. Riêng super_admin seed dùng mật khẩu từ env — đã đưa vào chốt chặn 4.3. |
| 5.4 | Vô hiệu hoá phương thức HTTP không cần thiết | ⚠️ | Chưa tắt tường minh TRACE/OPTIONS ở nginx. Express không xử lý TRACE nên rủi ro thực tế rất thấp; đã ghi khuyến nghị. |
| 5.5 | Rà cấu hình mặc định của thư viện mới thêm | ✅ | Đã rà từng thư viện thêm ở GĐ7: `helmet` (tắt CSP có chủ đích + giải thích), `throttler` (cố ý không đăng ký toàn cục), `swagger` (tắt ở production). Lý do từng lựa chọn ghi ngay tại chỗ trong `main.ts`. |
| 5.6 | Dockerfile khớp cấu trúc thư mục thật | ✅ | Đã build lại cả hai image sau thay đổi — thành công (xem phần xác minh cuối tài liệu). |
| 5.7 | **Dockerfile pin phiên bản phụ thuộc** | ✅ | **ĐÃ SỬA GĐ7.** `backend/Dockerfile:8-9,17-18` dùng `COPY package.json package-lock.json` + `npm ci --ignore-scripts` (runtime thêm `--omit=dev`). `frontend/Dockerfile:8-9` dùng `npm ci`. |
| 5.8 | Không lộ phiên bản máy chủ | ✅ | **ĐÃ SỬA GĐ7.** `server_tokens off` (`nginx/nginx.conf`); `helmet` gỡ `X-Powered-By`. |

> **Ghi chú có chủ đích ở 5.7:** frontend **không** dùng `--ignore-scripts`. Lý do đã kiểm
> chứng: devDependency `sharp` (script sinh icon PWA) cần postinstall tải binary theo nền
> tảng; bỏ script sẽ làm gãy bước build. Đánh đổi được ghi ngay trong `frontend/Dockerfile`.

---

## 6. Bảo mật chuỗi cung ứng (Supply Chain)

| # | Hạng mục baseline | Trạng thái | Bằng chứng / Ghi chú |
|---|---|:--:|---|
| 6.1 | Quét lỗ hổng phụ thuộc định kỳ | ✅ | **ĐÃ SỬA (bổ sung GĐ7).** `.github/workflows/ci.yml` job `audit` chạy `npm audit` mỗi lần push/PR vào `main`. **Cổng chặn đặt ở phạm vi production** (`--omit=dev --audit-level=critical`) — đúng thứ thật sự vào image; devDependency chỉ báo cáo, không chặn. Kết quả đo hiện tại ở R-05. |
| 6.2 | Khoá phiên bản chính xác | ✅ | **ĐÃ SỬA GĐ7.** `package-lock.json` có sẵn cho cả hai, nay được dùng thật qua `npm ci` (trước đây `npm install` có thể lệch phiên bản giữa các lần build). |
| 6.3 | Cẩn trọng khi thêm thư viện mới | ✅ | 5 thư viện thêm ở GĐ7 đều là gói chính thức, phổ biến rộng: `helmet`, `@nestjs/throttler`, `@nestjs/swagger`, `jest`/`ts-jest`/`supertest`, `vitest`/`jsdom`. Ba gói `@nestjs/*` do chính đội NestJS phát hành, khớp major version 10 đang dùng. |
| 6.4 | Không nâng major version tuỳ tiện | ✅ | Đã cố ý pin theo NestJS 10: `@nestjs/throttler@5.2.0`, `@nestjs/swagger@7.4.2`, `helmet@7.2.0` — không lấy bản mới nhất để tránh lệch peer dependency. |

**Rủi ro còn treo ở mục 6**

| Mã | Rủi ro | Mức | Vì sao không tự sửa |
|---|---|:--:|---|
| R-05 | Lỗ hổng tồn đọng trong cây phụ thuộc | Thông tin | **Số liệu đo 2026-07-29:** backend **19 CVE ở phạm vi production** (10 moderate, 9 high; 0 critical) và 50 nếu tính cả devDependency; frontend **0 CVE ở phạm vi production** (8 CVE đều nằm trong devDependency build-time của `vite-plugin-pwa`). Đã chạy `npm audit fix` (không `--force`): **không có bản vá an toàn nào áp dụng được** — 100% bản vá còn lại đòi nâng major (`@nestjs/*` 10→11, `typeorm`, `multer` 1→2). Nâng major giữa đợt hardening vi phạm 6.4 và nguyên tắc 2. **Khuyến nghị cụ thể:** mở nhánh `chore/upgrade-nestjs-11`, nâng đồng bộ `@nestjs/*` + `typeorm` + `multer`, dựa vào 175 test hiện có làm lưới an toàn, rồi hạ ngưỡng cổng chặn CI từ `critical` xuống `high`. |

---

## 7. Ghi nhật ký kiểm toán (Audit Logging)

| # | Hạng mục baseline | Trạng thái | Bằng chứng / Ghi chú |
|---|---|:--:|---|
| 7.1 | Ghi các sự kiện nhạy cảm | ✅ | **ĐÃ SỬA GĐ7** (trước đó hoàn toàn không có). `common/audit/audit-log.ts` + 10 loại sự kiện: đăng nhập thành công/thất bại (3 lý do phân biệt), đổi mật khẩu, SSO, tạo/khoá/xoá người dùng, xoá phim, xuất báo cáo. |
| 7.2 | Nội dung bản ghi đủ trường | ✅ | Mỗi dòng có: thời điểm, người thực hiện, hành động, đối tượng bị tác động, kết quả — đúng 5 trường baseline yêu cầu (`formatAuditEntry`). 11 test phủ. |
| 7.3 | Lưu trữ tách biệt / chống sửa đổi | ⚠️ | **Đạt ở tầng ứng dụng, phụ thuộc hạ tầng để đạt trọn vẹn.** Nhật ký ghi ra **stdout** với tiền tố `[Audit]`, **ứng dụng không có bất kỳ đường nào sửa hay xoá được bản ghi đã ghi** (không API, không lệnh, không bảng DB để UPDATE) — đây chính là điều baseline yêu cầu. Phần còn lại (gom log tập trung, quyền chỉ-ghi) **về bản chất chỉ giải quyết được ở tầng hạ tầng**, đã ghi thành điều kiện nghiệm thu bắt buộc trong `devops-handoff.md`. Xem R-06. |
| 7.4 | Thời gian lưu trữ dài hơn log gỡ lỗi | ⚠️ | Cùng lý do 7.3 — chính sách lưu trữ thuộc hệ thống gom log, đã ghi thành mục checklist go-live cụ thể. Xem R-06. |

**Rủi ro còn treo ở mục 7**

| Mã | Rủi ro | Mức | Vì sao không tự sửa |
|---|---|:--:|---|
| R-06 | Nhật ký kiểm toán chưa có lưu trữ chống sửa đổi và chính sách giữ riêng (7.3, 7.4) | Thấp | Baseline yêu cầu nhật ký không bị chính đối tượng bị điều tra xoá được — điều này **về bản chất phải giải quyết ở tầng hạ tầng** (gom log tập trung, quyền chỉ-ghi), không phải ở tầng ứng dụng. Phương án trong ứng dụng (bảng `audit_logs` riêng) cần migration + chính sách dọn dữ liệu + quyết định thời hạn lưu, tức cần chủ dự án chốt. Đã ghi rõ giới hạn này ngay trong docstring của `audit-log.ts` để người sau không tin nhầm. |

---

## 8. Security Headers và lớp bảo vệ tầng HTTP

| # | Hạng mục baseline | Trạng thái | Bằng chứng / Ghi chú |
|---|---|:--:|---|
| 8.1 | Chặn MIME sniffing | ✅ | **ĐÃ SỬA GĐ7.** `helmet` (`main.ts`) + `add_header X-Content-Type-Options "nosniff" always` (`nginx.conf`). |
| 8.2 | Chặn nhúng iframe (clickjacking) | ⚠️ | **Cố ý chưa chốt.** Xem R-07. |
| 8.3 | Hạn chế rò rỉ qua Referrer | ✅ | **ĐÃ SỬA GĐ7.** `Referrer-Policy: no-referrer` ở cả helmet lẫn nginx — đặc biệt quan trọng vì URL scaffold GĐ6.1 có thể chứa `?ssoToken=`. |
| 8.4 | HSTS | ⚠️ | Đã chuẩn bị sẵn dòng cấu hình (comment) trong `nginx.conf`, **cố ý chưa bật** vì compose dev chạy HTTP thuần — baseline nói rõ chỉ bật khi có HTTPS thật. |
| 8.5 | CORS không mở rộng không cần thiết | ✅ | **ĐÃ SỬA GĐ7.** Trước: `origin: true` phản chiếu mọi origin. Nay `corsOrigins()` — production mặc định không phản chiếu, chỉ mở khi khai báo `CORS_ORIGINS`. Dev giữ nguyên để không gãy Vite. 3 test. |
| 8.6 | **Rate limit endpoint xác thực** | ✅ | **ĐÃ SỬA GĐ7.** Xem 1.10. Đã xác minh bằng gọi thật, không chỉ đọc code. |
| 8.7 | Rate limit trên môi trường nhiều bản sao | ⚠️ | Bộ đếm nằm trong bộ nhớ tiến trình → mỗi bản sao đếm riêng. Xem R-08. |

**Rủi ro còn treo ở mục 8**

| Mã | Rủi ro | Mức | Vì sao không tự sửa |
|---|---|:--:|---|
| R-07 | Chưa chốt `X-Frame-Options`/CSP `frame-ancestors` (8.2) | Thấp | GĐ6.1 dự kiến nhúng app vào khung AMIS Mobile. Đặt `DENY` sẽ làm hỏng việc nhúng nếu app mẹ dùng iframe; nếu dùng WebView thật thì header không ảnh hưởng. **Không thể quyết đúng khi chưa biết cách nhúng** — đúng nguyên tắc "không tự suy diễn". Vị trí sẵn sàng kèm hướng dẫn đã đặt trong `nginx.conf`. |
| R-08 | Rate limit dùng bộ nhớ tiến trình, chạy nhiều bản sao sẽ đếm rời rạc (8.7) | Thấp | Cần Redis chia sẻ bộ đếm. Chỉ có ý nghĩa khi đã biết mô hình triển khai thật (hiện chưa xác nhận được với đội hạ tầng MISA). Đã ghi vào `devops-handoff.md`. |

> **Về CSP đầy đủ:** cố ý chưa áp CSP nghiêm ngặt cho tài liệu HTML. Frontend là SPA Vue +
> Tailwind + service worker; một CSP sai một dòng sẽ làm trắng trang toàn ứng dụng. Việc này
> cần một vòng kiểm thử riêng trên trình duyệt thật, không nên gộp vào đợt hardening cuối.

---

## 9. Phân loại dữ liệu nhạy cảm (PII)

| # | Hạng mục baseline | Trạng thái | Bằng chứng / Ghi chú |
|---|---|:--:|---|
| 9.1 | Chỉ vai trò cần thiết mới xem đầy đủ | ✅ | **[Siết thêm 2026-08-05]** Danh sách người dùng (email + họ tên + phòng ban) giới hạn `@Roles('super_admin')` — chỉ Cấp 4 (`users.controller.ts`; trước là `super_admin`+`admin`). |
| 9.2 | Endpoint xuất hàng loạt giới hạn chặt hơn xem lẻ | ✅ | **[Siết thêm 2026-08-05]** `/reports/films` chỉ **Cấp 4** (`reports.controller.ts`); và **ĐÃ SỬA GĐ7**: riêng nhánh `format=csv` được ghi nhật ký kiểm toán kèm số dòng đã xuất. |
| 9.3 | Không trả nguyên object gốc chứa thừa dữ liệu | ✅ | `UsersService.toPublic` (`users.service.ts:44-55`) và `FilmsService.toPublic` lọc trường tường minh; `password_hash` khai báo `select: false` ở entity. Có test khẳng định `PublicUser` không chứa `passwordHash`. |
| 9.4 | Cân nhắc PII trong log | ⚠️ | Nhật ký kiểm toán cố ý ghi `actorId` (số) thay vì email, và che tự động trường nhạy cảm. Nhưng chưa rà toàn bộ log gỡ lỗi có sẵn từ các giai đoạn trước — rủi ro thấp vì các log đó chủ yếu là thông báo khởi động. |

---

## Phụ lục A — Rủi ro còn treo: mức độ, căn cứ được phép treo, và việc cần làm

Mỗi mục dưới đây gồm 4 phần: **mức rủi ro** · **vì sao được phép treo** (trích điều khoản của
quy chuẩn) · **khuyến nghị hành động cụ thể** cho người sẽ xử lý.

Căn cứ chung cho phép treo: `11-phase-refactor-legacy.md` §3 ("không tự ý sửa hàng loạt ngay
khi phát hiện — vì sửa hàng loạt vi phạm nguyên tắc phạm vi ảnh hưởng nhỏ nhất và có thể phá
vỡ hành vi đang vận hành ổn định mà không ai yêu cầu thay đổi") và §5 ("phát hiện hành vi có
vẻ là lỗi → ghi nhận, báo cho người phụ trách, xử lý ở một thay đổi riêng sau khi được xác
nhận"). Ngược lại, mọi thứ quy chuẩn yêu cầu **tường minh** đều đã được sửa trong GĐ7.

---

### R-09 · `/media/:key` công khai, chỉ bảo vệ bằng UUID — **Cao ở production**

**Hiện trạng.** `media.controller.ts` gắn `@Public()`; ai có link là xem/tải được video mà
không cần đăng nhập, link chia sẻ ra ngoài thì mất kiểm soát vĩnh viễn và không có nhật ký ai
đã xem. Mọi byte video còn đi xuyên qua tiến trình Node.

**Vì sao được phép treo.** Đây là ràng buộc kỹ thuật thật, không phải sơ suất: thẻ
`<video src>` của trình duyệt **không gắn được header `Authorization`**. Quyết định đã ghi
thành ADR-021 từ GĐ3. `06-api-design.md` §7 cho phép endpoint công khai có chủ đích **với
điều kiện** định danh là chuỗi ngẫu nhiên đủ dài không đoán được — điều kiện này ĐẠT
(`randomUUID()`, `storage.service.ts:103`). Sửa triệt để là đổi kiến trúc phát video, chạm cả
backend lẫn `VideoPlayer.vue`, cần test lại toàn bộ luồng phát/tua/tải — đúng loại việc §5
yêu cầu tách thành thay đổi riêng.

**Khuyến nghị hành động — phương án presigned GET ngắn hạn:**

1. **Backend — thêm endpoint cấp URL, không đổi endpoint phát.**
   Thêm `GET /api/films/:id/playback-url` (CÓ xác thực, đi qua `JwtAuthGuard` như mọi route
   thường). Handler: lấy phim → lấy `storage_key` của version mới nhất → gọi
   `getSignedUrl(presigner, new GetObjectCommand(...), { expiresIn: 600 })` → trả
   `{ url, expiresIn }`. Tái dùng `StorageService.presigner` đã có sẵn từ ADR-020, **không
   cần thêm thư viện gì**.
2. **Frontend — đổi nguồn của thẻ video.**
   `VideoPlayer.vue` hiện dùng `src="/media/<key>"`. Đổi thành: gọi `playback-url` khi mở
   trang chi tiết, gán URL nhận được vào `src`. Cần xử lý **hết hạn giữa chừng**: bắt sự kiện
   `error` của thẻ `<video>`, xin URL mới rồi gán lại (giữ `currentTime` để người dùng không
   mất vị trí đang xem).
3. **Ảnh bìa** dùng chung `/media/:key` — cân nhắc giữ công khai (ảnh bìa ít nhạy cảm hơn
   video) để không phải ký URL cho từng thẻ ảnh trong danh sách, hoặc ký hàng loạt khi trả
   danh sách phim. **Cần quyết định nghiệp vụ**, không nên tự chọn.
4. **Service worker:** `vite.config.ts` đang đặt `/media/*` là `NetworkOnly` (ADR-027). Nếu
   đường dẫn phát video đổi sang domain storage, phải rà lại quy tắc này để **không** vô tình
   cache video có chữ ký vào máy người dùng.
5. **Sau khi chuyển xong:** bỏ `@Public()` khỏi `MediaController`, hoặc gỡ hẳn controller nếu
   không còn ai dùng — và cập nhật ADR-021 thành "đã thay thế".

**Giảm thiểu tạm nếu chưa làm ngay:** đặt kho phim sau VPN/mạng nội bộ MISA.

---

### R-01 · Token lưu ở `localStorage` — Trung bình

**Vì sao được phép treo.** `02-security-baseline.md` §1 dùng từ "ưu tiên... **nếu kiến trúc
cho phép**", không phải cấm tuyệt đối. Đổi sang cookie `httpOnly` kéo theo **phải thêm CSRF
protection** (§1 cuối) — tức là gỡ một rủi ro và tạo ra một bề mặt rủi ro mới cần làm đúng.
ADR-012 đã ghi nhận đây là nợ kỹ thuật ngay từ GĐ1. Rủi ro thực tế hiện **thấp** vì không tìm
thấy đường XSS nào (mục 3.3: 0 `v-html` trong toàn bộ FE).

**Khuyến nghị.** Gộp chung với việc cắm OIDC AMIS (`devops-handoff.md` mục 5) — lúc đó luồng
xác thực vốn đã phải viết lại, đổi sang cookie `httpOnly` + `sameSite=lax` + CSRF token gần
như không tốn thêm chi phí. Làm riêng lẻ bây giờ là tốn công hai lần.

---

### R-02 · Không thu hồi được refresh token khi đổi mật khẩu — Trung bình

**Vì sao được phép treo.** Cần thêm cột `users.token_version` (migration) + đưa vào payload
JWT + kiểm ở guard. Bước kiểm ở guard kéo theo **một truy vấn DB cho mọi request** — đổi đặc
tính hiệu năng của toàn hệ thống. `05-database-rules.md` §6 yêu cầu nêu rõ đánh đổi loại này
cho người phụ trách trước, không âm thầm chấp nhận.

**Khuyến nghị cụ thể.** (a) Migration thêm `users.token_version INT NOT NULL DEFAULT 0`;
(b) `issueTokens` nhét `tv` vào payload; (c) `changePassword` và `setActive(false)` tăng
`token_version`; (d) **chỉ kiểm ở `/auth/refresh`** (không kiểm ở mọi request) — như vậy
không tốn thêm truy vấn nào ở đường đi nóng, đổi lại refresh token bị vô hiệu trong tối đa
`JWT_ACCESS_TTL` (15 phút) thay vì tức thì. Đây là đánh đổi hợp lý cho ứng dụng nội bộ.

---

### R-03 · SSO AMIS Mobile chưa chống replay bằng nonce — Trung bình (chỉ khi bật)

**Vì sao được phép treo.** Toàn bộ cơ chế là **placeholder chờ spec thật** (ADR-029/030) và
**TẮT mặc định**. `01-core-principles.md` §3 cấm tự suy diễn: xây kho nonce cho một cơ chế
nhiều khả năng bị thay hẳn bằng OIDC/JWKS là vừa lãng phí vừa dựa trên giả định chưa được xác
nhận. Đã giảm thiểu: trần TTL 300s, bắt buộc secret ≥ 32 ký tự, rate limit 10/phút.

**Khuyến nghị.** Xử lý cùng lúc với checklist `devops-handoff.md` mục 6. Nếu spec thật vẫn
dùng token tự phát hành, thêm trường `jti` + lưu jti đã dùng vào Redis với TTL = TTL token.

---

### R-04 · Object mồ côi trên storage — Thấp

**Vì sao được phép treo.** Là quyết định vận hành (chu kỳ dọn, thời hạn giữ), không phải lỗi
mã nguồn. Chỉ khai thác được bởi tài khoản nội bộ hợp lệ.

**Khuyến nghị.** Bật lifecycle policy của MinIO/S3: xoá object có tiền tố `video-`/`thumb-`
tạo quá 24h mà không được `film_versions` tham chiếu. Hoặc job định kỳ đối chiếu danh sách
key trong bucket với `film_versions.storage_key`.

---

### R-06 · Nhật ký kiểm toán chưa có lưu trữ chống sửa đổi — Thấp

**Vì sao được phép treo.** Yêu cầu của baseline §7 là nhật ký "không thể bị chính đối tượng
đang bị điều tra tự ý xoá dấu vết". Ở **tầng ứng dụng điều này đã đạt**: không có API, lệnh,
hay bảng nào cho phép sửa/xoá bản ghi kiểm toán đã ghi. Phần còn lại — nơi log được lưu và ai
có quyền xoá — **nằm hoàn toàn ngoài phạm vi mã nguồn**. Làm bảng `audit_logs` trong chính DB
của ứng dụng thậm chí còn **kém an toàn hơn** (tài khoản DB của ứng dụng có quyền ghi bảng đó
nên cũng có thể xoá), tức là tạo cảm giác an toàn giả.

**Khuyến nghị.** Đã đưa thành **điều kiện nghiệm thu bắt buộc** trong checklist go-live của
`devops-handoff.md`: gom log `[Audit]` về hệ thống log tập trung với quyền chỉ-ghi, thời hạn
lưu dài hơn log gỡ lỗi. Nếu MISA có yêu cầu tuân thủ chặt hơn, bổ sung ghi song song sang một
kho append-only bên ngoài (không phải DB của chính ứng dụng).

---

### R-07 · Chưa chốt `X-Frame-Options`/CSP `frame-ancestors` — Thấp

**Vì sao được phép treo.** Không thể quyết đúng khi chưa biết AMIS Mobile nhúng bằng WebView
hay iframe — đặt `DENY` sẽ làm hỏng việc nhúng nếu là iframe. `01-core-principles.md` §3 cấm
đoán. Vị trí sẵn sàng kèm hướng dẫn đã đặt trong `nginx/nginx.conf`.

**Khuyến nghị.** WebView thật → đặt `X-Frame-Options: DENY` (header không ảnh hưởng WebView).
Iframe → dùng `Content-Security-Policy: frame-ancestors <origin của app mẹ>`, **không** dùng
`X-Frame-Options` (không hỗ trợ allowlist theo origin).

---

### R-08 · Rate limit đếm trong bộ nhớ tiến trình — Thấp

**Vì sao được phép treo.** Chỉ thành vấn đề khi chạy nhiều bản sao, mà mô hình triển khai thật
thì **chưa xác nhận được với đội hạ tầng MISA**.

**Khuyến nghị.** Nếu chạy ≥ 2 bản sao: cài `@nest-lab/throttler-storage-redis`, trỏ
`ThrottlerModule.forRoot({ storage: ... })` sang Redis dùng chung. Không đổi gì ở decorator.

---

### R-10 · Chưa phân trang `/films` và `/users` — Thấp

**Vì sao được phép treo.** `06-api-design.md` §5 yêu cầu phân trang cho danh sách "có khả năng
phát triển lớn". Thêm phân trang **đổi hình dạng response** (mảng → object có `meta`), phá vỡ
hợp đồng với frontend hiện có — đúng loại thay đổi `11-phase-refactor-legacy.md` §5 yêu cầu
báo cáo thay vì tự làm. Hiện kho phim có 1 phim; chưa phải vấn đề thực tế.

**Khuyến nghị.** Làm trước khi kho phim vượt ~200 phim. Frontend `FilmListView.vue` đã có sẵn
UI phân trang (đang phân trang phía client), nên chi phí chủ yếu ở việc đổi hợp đồng API và
`filmsStore`. Dùng offset-based là đủ ở quy mô này.

---

### R-11 · Response không theo khuôn `{data}`/`{error}` — Thông tin

**Vì sao được phép treo.** `06-api-design.md` §2 nhấn mạnh **"điều quan trọng nhất là NHẤT
QUÁN xuyên suốt, không phải đúng chính xác tên khoá dưới đây"**. Dự án đang nhất quán: trả
thẳng object/mảng khi thành công, `{statusCode, message, error}` chuẩn Nest khi lỗi. Đổi sẽ
phải sửa toàn bộ frontend mà không thu được lợi ích thực tế nào.

**Khuyến nghị.** Giữ nguyên. Chỉ cân nhắc khi có bên thứ ba ngoài frontend của chính dự án
tích hợp vào API này.

---

### Các mục nhỏ còn lại

| Rủi ro | Mức | Căn cứ treo | Khuyến nghị |
|---|:--:|---|---|
| Access token sống ≤ 15 phút sau khi khoá tài khoản | TB | Hệ quả tất yếu của JWT stateless (baseline §1 chấp nhận, chỉ yêu cầu có cơ chế thu hồi — xử lý cùng R-02) | Rút `JWT_ACCESS_TTL` xuống 5m nếu nghiệp vụ cần chặt hơn |
| Chính sách mật khẩu chỉ ≥ 8 ký tự | Thấp | Rate limit (A2) đã chặn brute force; baseline không quy định độ phức tạp cụ thể | Tự hết khi cắm OIDC — chính sách do IAM MISA quản lý tập trung |
| Không quét virus file tải lên | Thấp | Baseline không yêu cầu; ứng dụng nội bộ, người upload đều định danh được | Tích hợp ClamAV ở bước `confirmVersion` nếu yêu cầu tuân thủ đòi hỏi |
| Chưa tắt tường minh HTTP TRACE | Thấp | Express không xử lý TRACE → không có bề mặt thật | Thêm chặn ở nginx khi rà cấu hình TLS |
| Chưa có quy trình rotate secret định kỳ | Thấp | Việc vận hành, phụ thuộc secret manager chưa chọn | Chốt chu kỳ cùng đội hạ tầng khi chọn secret manager |

---

## Phụ lục B — Xác minh thực tế (nguyên tắc 4: backtest mọi nhánh)

Không có kết luận nào trong tài liệu này chỉ dựa vào đọc mã nguồn.

| Hạng mục | Số liệu |
|---|---|
| Kiểm thử đơn vị backend (Jest, có mock) | **129 / 129 pass** — 8 file |
| Kiểm thử tích hợp backend (MySQL THẬT) | **46 / 46 pass** — database riêng `kho_phim_e2e`, dựng lại sạch mỗi lần chạy |
| Kiểm thử frontend (Vitest + jsdom) | **26 / 26 pass** — 2 file |
| **Tổng test tự động** | **201** (trước GĐ7: 0) |
| Kiểm thử đồng thời `recordView` | 3 kịch bản, 20 request song song mỗi kịch bản — **tất cả ĐẠT sau khi sửa** |
| Biên dịch | `nest build` sạch · `vue-tsc -b && vite build` sạch |
| Quét phụ thuộc | BE 19 CVE prod (0 critical) · FE **0 CVE prod** |
| CI | 4 job, cú pháp YAML hợp lệ, mọi lệnh đã chạy thật ở local |

**Chi tiết kiểm thử đồng thời** (`npm run test:concurrency`, 20 request song song/kịch bản):

| Kịch bản | Trước khi sửa | Sau khi sửa |
|---|---|---|
| A — 20 người dùng khác nhau cùng xem 1 phim | +20 ✅ (đúng sẵn) | +20 ✅ |
| B — 1 người đã xem, gửi 20 request song song | +0 ✅ (đúng sẵn) | +0 ✅ |
| C — 1 người **chưa từng xem**, gửi 20 request song song | **+4 ❌ (LỖI)** | **+1 ✅** |

**Xác minh trên hệ thống đang chạy thật** (Docker, 5 container): liveness/readiness 200 ·
security header đầy đủ qua nginx · rate limit chặn đúng từ request thứ 10 · Swagger 404 ở
mặc định và render đủ 25 path khi bật cờ · CSV injection bị vô hiệu hoá end-to-end · nhật ký
kiểm toán ghi đúng · trình duyệt thật: đăng nhập → danh sách phim → chi tiết phim → báo cáo,
**0 lỗi console** · dữ liệu sẵn có đọc đúng sau khi ép múi giờ UTC.

Nhật ký đầy đủ từng bước: `memory-bank/04-progress.md` mục "Nhật ký GĐ 7".
