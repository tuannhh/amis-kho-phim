# AMIS Kho phim — Tổng quan API

> Tài liệu tóm tắt theo module: có những endpoint nào, ai gọi được.
> **Bản tương tác (thử gọi trực tiếp): `/api/docs`** (Swagger UI) — bật mặc định ở môi
> trường dev, TẮT ở production trừ khi đặt `ENABLE_API_DOCS=true` (xem ADR-031).

## Quy ước chung

- Tiền tố: **`/api`** cho mọi endpoint, **NGOẠI TRỪ** `/media/:key` (nằm ngoài prefix để
  khớp `location /media/` của nginx và phát video theo Range — ADR-021).
- Xác thực: header `Authorization: Bearer <accessToken>`. Access token sống 15 phút, refresh
  token 7 ngày (ADR-012). Guard toàn cục `JwtAuthGuard` bảo vệ **mọi** route trừ route gắn
  `@Public`. Frontend (`lib/http.ts`) tự gắn token và tự refresh một lần khi gặp 401.
- **Vai trò — RBAC 3 CẤP PHẲNG** (cột `users.role_code`, cập nhật 2026-08-06,
  ADR-045 → 047). Vai trò `admin` cũ **KHÔNG CÒN TỒN TẠI**:

  | Cấp | `role_code` | Nhãn | Quyền |
  |---|---|---|---|
  | 1 | `viewer` | Người xem | CHỈ xem phim/chuyên mục, ghi lượt xem |
  | 2 | `employee` | Nhân viên văn phòng | + tạo phim, sửa/xoá phim **của chính mình** |
  | 3 | `super_admin` | Quản trị cao nhất | + sửa/xoá **MỌI** phim (không giới hạn phòng ban) + toàn bộ quyền quản trị hệ thống |

  **PHẲNG**: `department_id` (ở `users`/`films`/`categories`) và bảng `departments` vẫn tồn tại
  nhưng CHỈ để **truy vết**, KHÔNG tham gia quyết định quyền (ADR-046). Phim vẫn mang **snapshot**
  `films.department_id` của người tạo tại thời điểm tạo.

  > Nhánh song song `phan-quyen-4-cap` cài đặt phương án 4 cấp có scope phòng ban (thêm
  > `dept_manager`) để so sánh — xem ADR-045.
- Lỗi trả về theo chuẩn Nest: `{ statusCode, message, error }`; `message` có thể là mảng khi
  DTO validate fail. Toàn bộ thông điệp bằng tiếng Việt.
- Mã trạng thái hay gặp: `401` chưa/không hợp lệ token · `403` sai vai trò hoặc không phải
  chủ sở hữu · `404` không tồn tại · `409` trùng dữ liệu · `429` vượt giới hạn tần suất.

Ký hiệu cột "Ai gọi được": **Công khai** = không cần đăng nhập · **Đã đăng nhập** = mọi vai trò (kể
cả Cấp 1) · **Cấp 2+** = `employee`/`super_admin` · **Cấp 3** = chỉ `super_admin` ·
**Quản lý được phim** = chủ sở hữu, hoặc Cấp 3 (với bất kỳ phim nào).

---

## `auth` — Xác thực

Toàn bộ controller có giới hạn tần suất theo IP (GĐ7) — đây là bề mặt brute force duy nhất.

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| POST | `/api/auth/login` | Công khai | Đăng nhập email + mật khẩu → `{ accessToken, refreshToken, user }`. **10 lần/phút/IP**. |
| POST | `/api/auth/refresh` | Công khai | Đổi refresh token lấy cặp token mới. Tài khoản đã bị khoá sẽ bị chặn ở đây. **30/phút/IP**. |
| POST | `/api/auth/sso/amis-mobile` | Công khai | **[Placeholder GĐ6.1]** Đổi token SSO của khung AMIS Mobile lấy JWT nội bộ. **Mặc định TẮT → trả 501.** **10/phút/IP**. Xem `docs/devops-handoff.md`. |
| GET | `/api/auth/me` | Đã đăng nhập | Hồ sơ người đang đăng nhập (FE gọi khi khôi phục phiên). |
| POST | `/api/auth/change-password` | Đã đăng nhập | Tự đổi mật khẩu (phải nhập đúng mật khẩu hiện tại). Trả `204`. **10/phút/IP**. |

Ghi chú: tài khoản do admin tạo có `mustChangePassword = true`; frontend ép người dùng sang
màn `/change-password` cho tới khi đổi xong (ADR-013).

## `departments` — Danh mục phòng ban **[MỚI 2026-08-05]**

Cả controller gắn `@Roles('super_admin')` — **kể cả quyền ĐỌC**. Danh mục này quyết định ranh giới
phân quyền của Cấp 3 nên áp quyền tối thiểu (`02-security-baseline.md` §2).

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/departments` | Cấp 3 | Danh sách phòng ban kèm `userCount` (số người dùng đang thuộc). |
| POST | `/api/departments` | Cấp 3 | Tạo (`{ name }`). Trùng tên → `409` (unique index ở DB). |
| PATCH | `/api/departments/:id` | Cấp 3 | Đổi tên. Trùng tên → `409`. |
| DELETE | `/api/departments/:id` | Cấp 3 | Xoá. **`409` nếu còn user/phim/chuyên mục tham chiếu** — thông điệp nêu rõ số bản ghi từng loại. Trả `204` khi thành công. |

## `users` — Quản trị người dùng

Cả controller gắn `@Roles('super_admin')` — **chỉ Cấp 3**; Cấp 1/Cấp 2 gọi bất kỳ route nào cũng `403`.
(Trước đây là `super_admin`+`admin`; `admin` đã bị loại bỏ và migrate sang Cấp 3 — ADR-047.)
Chi tiết "ai quản lý được ai" kiểm thêm ở tầng service:

- Không ai được tự sửa/khoá/xoá chính mình.
- Cấp 3 quản lý được Cấp 1/Cấp 2, **không** đụng được Cấp 3 khác.
- Gán vai trò: Cấp 3 gán được `viewer`/`employee`. **Không ai gán được `super_admin` qua API**
  (DTO chặn, trả `400`) — giá trị `admin` cũ và `dept_manager` (nhánh 4 cấp) cũng bị chặn.

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/users` | Cấp 3 | Danh sách người dùng, kèm `departmentId` (không bao giờ kèm `password_hash`). |
| POST | `/api/users` | Cấp 3 | Tạo tài khoản (`{ email, fullName, roleCode, departmentId?, password? }`). `departmentId` được validate tồn tại thật. Bỏ trống `password` → hệ thống sinh mật khẩu tạm 12 ký tự và trả về **một lần duy nhất** trong response. |
| PATCH | `/api/users/:id` | Cấp 3 | **[MỚI]** Đổi vai trò và/hoặc phòng ban (`{ roleCode?, departmentId? }`). Thiếu trường = không đổi; `departmentId: null` = **bỏ gán** phòng ban. Cần thiết vì Cấp 1/Cấp 3 là hai cấp mới, không tài khoản nào tự động chuyển sang khi migrate. |
| PATCH | `/api/users/:id/status` | Cấp 3 | Khoá/mở khoá (`{ isActive: boolean }`). |
| DELETE | `/api/users/:id` | Cấp 3 | Xoá tài khoản. Trả `204`. |

## `categories` — Chuyên mục (cây cha–con)

Đọc: mọi người đã đăng nhập. **Ghi (tạo/sửa/xoá): chỉ Cấp 3** (`@Roles('super_admin')`, đổi từ
`super_admin`+`admin` — ADR-047). Chuyên mục là danh mục dùng chung toàn công ty; 2 cột
`created_by`/`department_id` chỉ để truy vết (ADR-046).

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/categories` | Đã đăng nhập | Cây chuyên mục đầy đủ. |
| POST | `/api/categories` | Cấp 3 | Tạo chuyên mục (`parentId` tuỳ chọn). Slug do BE tự sinh (ADR-015). |
| PATCH | `/api/categories/:id` | Cấp 3 | Sửa tên/mô tả. **Không đổi được chuyên mục cha** (tránh tạo vòng lặp). |
| DELETE | `/api/categories/:id` | Cấp 3 | Xoá. Trả `204`. |

## `films` — Phim (metadata, link ngoài, storage, lượt xem)

**Đọc:** mọi người đã đăng nhập (kể cả Cấp 1).
**Ghi:** ⚠️ **ĐÃ ĐỔI 2026-08-05** — toàn bộ 7 route ghi gắn `@Roles(...FILM_WRITE_ROLES)`, tức **Cấp 2
trở lên**. Trước đây các route này KHÔNG có `@Roles` nào nên **Cấp thấp nhất cũng tạo được phim** — đó
là lỗ hổng phân quyền đã được bịt (xem `docs/danh-gia-an-ninh.md` mục 2.9). Phạm vi chi tiết trong nhóm
được ghi (của mình / cùng phòng ban / mọi phòng ban) kiểm tiếp ở `FilmsService.assertCanManage`
(ADR-040, thay thế ADR-002/014).

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/films` | Đã đăng nhập | Danh sách phim (kèm chuyên mục, hashtag, link, `thumbnailUrl`, `departmentId`, `uploaderRoleCode`). |
| GET | `/api/films/:slug` | Đã đăng nhập | Chi tiết theo slug. |
| POST | `/api/films` | **Cấp 2+** | Tạo phim (metadata + link ngoài). Slug tự sinh. `department_id` **snapshot từ DB** của người tạo — KHÔNG nhận từ body. |
| PATCH | `/api/films/:id` | **Cấp 2+** & quản lý được phim | Sửa metadata. Lưu ý: thao tác này **đặt lại tag "Phim mới"**. |
| DELETE | `/api/films/:id` | **Cấp 2+** & quản lý được phim | Xoá phim. Trả `204`. |
| POST | `/api/films/:id/view` | Đã đăng nhập | Ghi nhận 1 lượt xem. Dedupe theo `user_id` trong 30 phút; tăng `view_count` atomic (ADR-023). **Cấp 1 vẫn gọi được** (là người xem hợp lệ). |
| POST | `/api/films/:id/upload-url` | **Cấp 2+** & quản lý được phim | Xin presigned PUT URL để upload video thẳng lên MinIO. Server validate MIME + dung lượng và **tự sinh** `storageKey`. |
| POST | `/api/films/:id/thumbnail` | **Cấp 2+** & quản lý được phim | Upload ảnh bìa (multipart, ≤ 15MB). Kiểm magic bytes + bắt buộc tỷ lệ 16:9. |
| POST | `/api/films/:id/versions` | **Cấp 2+** & quản lý được phim | Xác nhận tạo bản mới sau khi upload xong. Server head-check key trên MinIO, lấy dung lượng thật, **từ chối + xoá file nếu vượt `MAX_UPLOAD_MB`** (GĐ7). |

Nguồn phát của một phim (`links`): `storage` (MinIO nội bộ), `youtube`, `vimeo`, `gdrive`,
`misadrive`. Riêng `storage` trả về đường dẫn dạng `/media/<key>`.

## `notifications` — Thông báo

Mỗi người chỉ đọc được thông báo **của chính mình** (lọc theo `user_id` ở service, không cần `@Roles`).

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/notifications` | Đã đăng nhập | Danh sách thông báo của mình. |
| GET | `/api/notifications/unread-count` | Đã đăng nhập | `{ count }` — FE poll mỗi 30s để hiện chấm đỏ trên chuông. |
| PATCH | `/api/notifications/:id/read` | Đã đăng nhập | Đánh dấu đã đọc. |
| PATCH | `/api/notifications/read-all` | Đã đăng nhập | Đánh dấu đã đọc tất cả. |

> ⚠️ **Hạ tầng còn, nhưng việc bắn thông báo đang TẮT** theo quyết định của người dùng
> (2026-07-22): mọi lời gọi `notifications.notify()` trong `FilmsService` đã được comment lại
> vì thực tế có rất nhiều phim đăng lên, thông báo mỗi lần cho toàn bộ nhân viên sẽ gây spam.
> Vì vậy các endpoint trên luôn trả danh sách rỗng — **đó là chủ ý, không phải lỗi.**

## `reports` — Báo cáo quản trị

Cả controller gắn `@Roles('super_admin')` — **chỉ Cấp 3**. Cố ý KHÔNG mở cho Cấp 2: báo cáo là xuất dữ
liệu hàng loạt có PII và đặc tả không nhắc quyền báo cáo của Cấp 2. Nếu cần mở rộng thì đó là yêu cầu
mới, không tự suy diễn.

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/reports/films` | Cấp 3 | Ai upload bao nhiêu phim trong kỳ + danh sách phim. Lọc: `uploaderId`, `from`, `to` (`YYYY-MM-DD`). |
| GET | `/api/reports/films?format=csv` | Cấp 3 | Cùng endpoint, trả file CSV (BOM UTF-8 để Excel hiện tiếng Việt đúng — ADR-026). Ô bắt đầu bằng `= + - @` được vô hiệu hoá chống CSV injection (GĐ7). |

## `media` — Phát video/ảnh (NGOÀI prefix `/api`)

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/media/:key` | **Công khai** | Stream từ MinIO. Hỗ trợ `Range` → `206 Partial Content` cho tua/seek. |
| HEAD | `/media/:key` | **Công khai** | Kiểm tra tồn tại + kích thước. |

> ⚠️ **Bắt buộc công khai** vì thẻ `<video src>` không gắn được header `Authorization`.
> An toàn hiện dựa vào `key` là UUID không đoán được. **Đây là rủi ro đã ghi nhận cho
> production** (mục R-09 trong `docs/danh-gia-an-ninh.md`) — cân nhắc chuyển sang presigned GET
> ngắn hạn trước khi mở rộng cho toàn công ty.

## `health`

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/health` | **Công khai** | `{ app, status, time }` — dùng cho healthcheck của nginx/Docker. Không lộ thông tin phiên bản/hạ tầng. |
