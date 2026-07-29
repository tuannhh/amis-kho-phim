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
- Vai trò: `super_admin` › `admin` › `employee` (cột `users.role_code`).
- Lỗi trả về theo chuẩn Nest: `{ statusCode, message, error }`; `message` có thể là mảng khi
  DTO validate fail. Toàn bộ thông điệp bằng tiếng Việt.
- Mã trạng thái hay gặp: `401` chưa/không hợp lệ token · `403` sai vai trò hoặc không phải
  chủ sở hữu · `404` không tồn tại · `409` trùng dữ liệu · `429` vượt giới hạn tần suất.

Ký hiệu cột "Ai gọi được": **Công khai** = không cần đăng nhập · **Đã đăng nhập** = mọi vai
trò · **Chủ sở hữu** = người upload phim đó, hoặc admin/super_admin.

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

## `users` — Quản trị người dùng

Cả controller gắn `@Roles('super_admin', 'admin')` — nhân viên gọi bất kỳ route nào cũng `403`.
Chi tiết "ai quản lý được ai" kiểm thêm ở tầng service:

- Không ai được tự khoá/xoá chính mình.
- `super_admin` quản lý được `admin` và `employee`, **không** đụng được `super_admin` khác.
- `admin` chỉ quản lý được `employee`.
- Tạo tài khoản: `super_admin` tạo được `admin`/`employee`; `admin` chỉ tạo được `employee`.

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/users` | admin+ | Danh sách người dùng (không bao giờ kèm `password_hash`). |
| POST | `/api/users` | admin+ | Tạo tài khoản. Bỏ trống `password` → hệ thống sinh mật khẩu tạm 12 ký tự và trả về **một lần duy nhất** trong response. |
| PATCH | `/api/users/:id/status` | admin+ | Khoá/mở khoá (`{ isActive: boolean }`). |
| DELETE | `/api/users/:id` | admin+ | Xoá tài khoản. Trả `204`. |

## `categories` — Chuyên mục (cây cha–con)

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/categories` | Đã đăng nhập | Cây chuyên mục đầy đủ. |
| POST | `/api/categories` | admin+ | Tạo chuyên mục (`parentId` tuỳ chọn). Slug do BE tự sinh (ADR-015). |
| PATCH | `/api/categories/:id` | admin+ | Sửa tên/mô tả. **Không đổi được chuyên mục cha** (tránh tạo vòng lặp). |
| DELETE | `/api/categories/:id` | admin+ | Xoá. Trả `204`. |

## `films` — Phim (metadata, link ngoài, storage, lượt xem)

Xem: mọi người đã đăng nhập. Tạo: mọi vai trò đều được đăng phim. Sửa/xoá và toàn bộ thao tác
storage: **chủ sở hữu** (`FilmsService.assertCanManage` — ADR-002/014).

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/films` | Đã đăng nhập | Danh sách phim (kèm chuyên mục, hashtag, link, `thumbnailUrl`). |
| GET | `/api/films/:slug` | Đã đăng nhập | Chi tiết theo slug. |
| POST | `/api/films` | Đã đăng nhập | Tạo phim (metadata + link ngoài). Slug tự sinh. |
| PATCH | `/api/films/:id` | Chủ sở hữu | Sửa metadata. Lưu ý: thao tác này **đặt lại tag "Phim mới"**. |
| DELETE | `/api/films/:id` | Chủ sở hữu | Xoá phim. Trả `204`. |
| POST | `/api/films/:id/view` | Đã đăng nhập | Ghi nhận 1 lượt xem. Dedupe theo `user_id` trong 30 phút; tăng `view_count` atomic (ADR-023). |
| POST | `/api/films/:id/upload-url` | Chủ sở hữu | Xin presigned PUT URL để upload video thẳng lên MinIO. Server validate MIME + dung lượng và **tự sinh** `storageKey`. |
| POST | `/api/films/:id/thumbnail` | Chủ sở hữu | Upload ảnh bìa (multipart, ≤ 15MB). Kiểm magic bytes + bắt buộc tỷ lệ 16:9. |
| POST | `/api/films/:id/versions` | Chủ sở hữu | Xác nhận tạo bản mới sau khi upload xong. Server head-check key trên MinIO, lấy dung lượng thật, **từ chối + xoá file nếu vượt `MAX_UPLOAD_MB`** (GĐ7). |

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

Cả controller gắn `@Roles('super_admin', 'admin')`.

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/reports/films` | admin+ | Ai upload bao nhiêu phim trong kỳ + danh sách phim. Lọc: `uploaderId`, `from`, `to` (`YYYY-MM-DD`). |
| GET | `/api/reports/films?format=csv` | admin+ | Cùng endpoint, trả file CSV (BOM UTF-8 để Excel hiện tiếng Việt đúng — ADR-026). Ô bắt đầu bằng `= + - @` được vô hiệu hoá chống CSV injection (GĐ7). |

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
