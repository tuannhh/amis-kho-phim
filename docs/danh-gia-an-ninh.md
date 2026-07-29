# AMIS Kho phim — Đánh giá an ninh thông tin (GĐ7)

> **Khung đối chiếu:** skill `misa-backend-standard` → `references/02-security-baseline.md`
> (Quy chuẩn Backend MISA). Các hạng mục dưới đây bám đúng thứ tự 9 mục của baseline đó,
> không phải danh sách tự do.
>
> **Phạm vi rà soát:** backend NestJS (`backend/src/**`), frontend Vue (`frontend/src/**`),
> `nginx/nginx.conf`, `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`,
> `.env.example`. Bao gồm cả endpoint SSO AMIS Mobile mới của GĐ6.1.
>
> **Thời điểm:** 2026-07-29 · **Trạng thái mã nguồn:** sau các sửa đổi hardening GĐ7.
>
> **Quy ước:** ✅ Đạt · ⚠️ Đạt một phần · ❌ Chưa đạt · ➖ Không áp dụng.
> Mọi kết luận đều kèm bằng chứng `file:dòng` — không suy đoán (nguyên tắc 3 của skill).
> Số dòng theo mã nguồn tại thời điểm lập tài liệu.

---

## Tóm tắt điều hành

| Mục baseline | Đạt | Đạt một phần | Chưa đạt | Không áp dụng |
|---|:--:|:--:|:--:|:--:|
| 1. Xác thực | 6 | 2 | 1 | 3 |
| 2. Phân quyền | 6 | 0 | 0 | 1 |
| 3. Chống injection | 6 | 1 | 0 | 1 |
| 4. Quản lý secrets | 4 | 1 | 0 | 0 |
| 5. Cấu hình sai an toàn | 6 | 1 | 0 | 0 |
| 6. Chuỗi cung ứng | 3 | 1 | 0 | 0 |
| 7. Audit log | 1 | 2 | 0 | 0 |
| 8. Security headers | 4 | 2 | 0 | 0 |
| 9. Dữ liệu cá nhân (PII) | 2 | 1 | 0 | 0 |

**Đã tự sửa trong GĐ7: 12 vấn đề.** **Còn treo cho DevOps/chủ dự án: 11 vấn đề** (đều có
lý do cụ thể ở từng mục, phần lớn là đổi kiến trúc hoặc cần quyết định nghiệp vụ).

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
| 2.2 | Mô hình phân quyền tương xứng nghiệp vụ | ✅ | RBAC 3 vai trò + owner policy — đúng mức, không phức tạp hoá bằng ABAC. |
| 2.3 | Cách ly dữ liệu theo đơn vị | ➖ | Kho phim dùng chung toàn công ty, không có nhiều tổ chức độc lập. Riêng thông báo có lọc theo người dùng (2.5). |
| 2.4 | Không tin trường có ý nghĩa phân quyền do client gửi | ✅ | `uploaderId` lấy từ token (`films.service.ts:154` — `uploaderId: actor.id`), không nhận từ body. `createdBy` tương tự (`users.service.ts:121`). `storage_key` sinh 100% ở server (`storage.service.ts:103`). |
| 2.5 | **IDOR — kiểm quyền sở hữu, không chỉ đăng nhập** | ✅ | `FilmsService.assertCanManage` (`films.service.ts:177-181`) so `film.uploaderId === actor.id`, gọi ở `update`/`remove`/`findManageableFilm` (dùng chung cho cả 3 endpoint storage). Thông báo lọc theo `actor.id` (`notifications.controller.ts:13,18,23,29`). Đã phủ 9 test IDOR. |
| 2.6 | Endpoint danh mục dùng chung giới hạn cấp cao | ✅ | `/categories` ghi chỉ `super_admin`/`admin` (`categories.controller.ts:17,23,29`); `/users` và `/reports` gắn `@Roles` ở cấp controller. |
| 2.7 | **Mass assignment** | ✅ | `ValidationPipe({ whitelist: true })` (`main.ts:45`) loại bỏ mọi field lạ. `CreateUserDto` chặn `roleCode: 'super_admin'` bằng `@IsIn(['admin','employee'])` (`create-user.dto.ts:14`); quyền tạo còn được kiểm lại ở service qua `creatableRoles` (`users.service.ts:104`). |
| 2.8 | Ma trận quản lý người dùng | ✅ | `UsersService.assertCanManage` (`users.service.ts:81-98`): không tự khoá mình, super_admin không đụng super_admin khác, admin chỉ quản lý employee. Phủ 9 test. |

**Không có rủi ro treo ở mục 2.** Đây là phần vững nhất của hệ thống.

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
| 6.1 | Quét lỗ hổng phụ thuộc định kỳ | ⚠️ | Đã chạy `npm audit` thủ công ở GĐ7 (kết quả ở R-05). Chưa có quét tự động trong CI — dự án chưa có pipeline CI. Đã đề xuất trong `devops-handoff.md` mục 10. |
| 6.2 | Khoá phiên bản chính xác | ✅ | **ĐÃ SỬA GĐ7.** `package-lock.json` có sẵn cho cả hai, nay được dùng thật qua `npm ci` (trước đây `npm install` có thể lệch phiên bản giữa các lần build). |
| 6.3 | Cẩn trọng khi thêm thư viện mới | ✅ | 5 thư viện thêm ở GĐ7 đều là gói chính thức, phổ biến rộng: `helmet`, `@nestjs/throttler`, `@nestjs/swagger`, `jest`/`ts-jest`/`supertest`, `vitest`/`jsdom`. Ba gói `@nestjs/*` do chính đội NestJS phát hành, khớp major version 10 đang dùng. |
| 6.4 | Không nâng major version tuỳ tiện | ✅ | Đã cố ý pin theo NestJS 10: `@nestjs/throttler@5.2.0`, `@nestjs/swagger@7.4.2`, `helmet@7.2.0` — không lấy bản mới nhất để tránh lệch peer dependency. |

**Rủi ro còn treo ở mục 6**

| Mã | Rủi ro | Mức | Vì sao không tự sửa |
|---|---|:--:|---|
| R-05 | `npm audit` còn cảnh báo, chủ yếu từ `multer@1.x` (NestJS 10 kéo theo) và chuỗi phụ thuộc build | Thông tin | Khắc phục đòi nâng NestJS lên major mới — vi phạm 6.4 nếu làm vội, và vượt xa phạm vi hardening. Nay đã có 152 test làm lưới an toàn cho việc nâng cấp đó ở một nhánh riêng. |

---

## 7. Ghi nhật ký kiểm toán (Audit Logging)

| # | Hạng mục baseline | Trạng thái | Bằng chứng / Ghi chú |
|---|---|:--:|---|
| 7.1 | Ghi các sự kiện nhạy cảm | ✅ | **ĐÃ SỬA GĐ7** (trước đó hoàn toàn không có). `common/audit/audit-log.ts` + 10 loại sự kiện: đăng nhập thành công/thất bại (3 lý do phân biệt), đổi mật khẩu, SSO, tạo/khoá/xoá người dùng, xoá phim, xuất báo cáo. |
| 7.2 | Nội dung bản ghi đủ trường | ✅ | Mỗi dòng có: thời điểm, người thực hiện, hành động, đối tượng bị tác động, kết quả — đúng 5 trường baseline yêu cầu (`formatAuditEntry`). 11 test phủ. |
| 7.3 | Lưu trữ tách biệt / chống sửa đổi | ⚠️ | **Còn treo.** Hiện ghi ra **stdout** qua Logger của Nest, không ghi vào bảng riêng, không chống sửa đổi. Xem R-06. |
| 7.4 | Thời gian lưu trữ dài hơn log gỡ lỗi | ⚠️ | **Còn treo.** Chưa tách chính sách lưu trữ — phụ thuộc hạ tầng gom log. Xem R-06. |

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
| 9.1 | Chỉ vai trò cần thiết mới xem đầy đủ | ✅ | Danh sách người dùng (email + họ tên) giới hạn `@Roles('super_admin','admin')` (`users.controller.ts:23`). |
| 9.2 | Endpoint xuất hàng loạt giới hạn chặt hơn xem lẻ | ✅ | `/reports/films` chỉ admin+ (`reports.controller.ts:9`); và **ĐÃ SỬA GĐ7**: riêng nhánh `format=csv` được ghi nhật ký kiểm toán kèm số dòng đã xuất. |
| 9.3 | Không trả nguyên object gốc chứa thừa dữ liệu | ✅ | `UsersService.toPublic` (`users.service.ts:44-55`) và `FilmsService.toPublic` lọc trường tường minh; `password_hash` khai báo `select: false` ở entity. Có test khẳng định `PublicUser` không chứa `passwordHash`. |
| 9.4 | Cân nhắc PII trong log | ⚠️ | Nhật ký kiểm toán cố ý ghi `actorId` (số) thay vì email, và che tự động trường nhạy cảm. Nhưng chưa rà toàn bộ log gỡ lỗi có sẵn từ các giai đoạn trước — rủi ro thấp vì các log đó chủ yếu là thông báo khởi động. |

---

## Phụ lục A — Bảng rủi ro còn treo (tổng hợp để quyết định)

| Mã | Mục | Rủi ro | Mức | Cần xử lý trước khi lên production? |
|---|---|---|:--:|---|
| R-09 | Ngoài baseline | `/media/:key` công khai, chỉ dựa vào UUID khó đoán (ADR-021) | **Cao ở production** | **Có**, nếu kho phim chứa nội dung nhạy cảm |
| R-01 | 1.3 | Token ở `localStorage` | Trung bình | Cân nhắc |
| R-02 | 1.9 | Không thu hồi được refresh token | Trung bình | Nên |
| R-03 | 1.5 | SSO placeholder, chưa chống replay | Trung bình | Chỉ khi bật SSO |
| R-04 | 3.8 | Object mồ côi trên storage | Thấp | Job dọn định kỳ |
| R-05 | 6.1 | `npm audit` còn cảnh báo | Thông tin | Nhánh riêng |
| R-06 | 7.3/7.4 | Audit log chưa chống sửa đổi | Thấp | Cần hạ tầng gom log |
| R-07 | 8.2 | Chưa chốt chống clickjacking | Thấp | Chốt cùng GĐ6.1 |
| R-08 | 8.7 | Rate limit không dùng chung giữa nhiều bản sao | Thấp | Khi chạy nhiều replica |
| R-10 | Ngoài baseline | Chưa có phân trang cho `/films`, `/users` (06-api-design §5) | Thấp | Sẽ thành vấn đề khi kho phim lớn |
| R-11 | Ngoài baseline | Hình dạng response không theo khuôn `{data}`/`{error}` (06-api-design §2) | Thông tin | Đổi sẽ phá vỡ toàn bộ frontend |

**Về R-09** — đây là rủi ro nghiêm trọng nhất còn treo, nằm ngoài 9 mục của baseline nên ghi
riêng: thẻ `<video src>` không gắn được header `Authorization`, nên endpoint bắt buộc phải
công khai (ADR-021). Baseline `06-api-design §7` cho phép endpoint công khai có chủ đích
**với điều kiện** định danh là chuỗi ngẫu nhiên đủ dài không đoán được — điều kiện này ĐẠT
(`randomUUID()`, `storage.service.ts:103`). Nhưng hệ quả vẫn là: link chia sẻ ra ngoài thì
mất kiểm soát vĩnh viễn và không có nhật ký ai đã xem. Cách xử lý đúng ở production là
presigned GET ngắn hạn — chi tiết ở `devops-handoff.md` mục 4.

**Về R-10 và R-11** — hai điểm lệch so với `06-api-design`, phát hiện trong lúc rà nhưng
**cố ý không sửa**: cả hai đều đổi hợp đồng API và kéo theo phải sửa toàn bộ frontend, đúng
loại thay đổi mà `11-phase-refactor-legacy §5` yêu cầu báo cáo thay vì tự làm.

---

## Phụ lục B — Xác minh thực tế (nguyên tắc 4: backtest mọi nhánh)

Không có kết luận nào trong tài liệu này chỉ dựa vào đọc mã nguồn. Chi tiết kết quả chạy
thật (kiểm thử tự động, Docker, trình duyệt, thử rate limit bằng gọi lặp, kiểm Swagger tắt ở
production) được ghi ở `memory-bank/04-progress.md` mục "Nhật ký GĐ7".

Tóm tắt: **152 test tự động** (126 backend + 26 frontend) toàn bộ pass; cả hai bản build
sạch; stack Docker 5 container chạy được sau thay đổi; luồng chính (đăng nhập → danh sách
phim → mở phim) hoạt động bình thường; rate limit chặn đúng ngưỡng khi gọi lặp thật.
