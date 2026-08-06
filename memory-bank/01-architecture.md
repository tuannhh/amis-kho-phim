# AMIS Kho phim — System Architecture & Patterns

## 1. Tổng quan hệ thống (Docker Compose)
```
                    ┌─────────────────────────────────────────┐
                    │            nginx (reverse proxy)          │
                    │  /        → frontend (SPA/PWA)             │
                    │  /api     → backend (NestJS)               │
                    │  /media   → backend stream (range)         │
                    └───────────────┬───────────────┬───────────┘
                                    │               │
                      ┌─────────────▼──┐     ┌──────▼───────────┐
                      │  frontend       │     │  backend         │
                      │  Vue3+Vite+MDS  │     │  NestJS (modular)│
                      │  PWA            │     └───┬─────────┬────┘
                      └─────────────────┘         │         │
                                        ┌─────────▼──┐  ┌───▼────────┐
                                        │  MySQL      │  │  MinIO     │
                                        │  utf8mb4    │  │  (S3 API)  │
                                        └─────────────┘  └────────────┘
```
Services: `frontend`, `backend`, `mysql`, `minio`, `nginx`. Volumes: `mysql_data`,
`minio_data`. Mạng nội bộ `kho-phim-net`.

## 2. Nguyên tắc module hoá (quan trọng)
Backend theo **NestJS module** — mỗi domain là 1 module độc lập (controller + service +
repository + DTO + entity). Sửa 1 module không lan sang module khác. FE theo **feature
module** (thư mục `features/<domain>` gồm views + components + store + api client).

**Ranh giới:** module chỉ giao tiếp qua service interface được export, không truy cập
thẳng repository của module khác. Logic dùng chung nằm ở `common/`.

## 3. Backend modules (NestJS)
| Module | Trách nhiệm |
|---|---|
| `auth` | Login, JWT access/refresh, guard, chỗ cắm OIDC (AMIS) sau |
| `users` | CRUD người dùng, gán role, quan hệ created_by |
| `rbac` | Định nghĩa role/permission, guard `@Roles`, policy chủ sở hữu (owner) |
| `categories` | Chuyên mục (có thể lồng cấp cha–con) |
| `films` | CRUD phim, versioning, đếm view, phát hiện trùng tiêu đề, tag "mới" |
| `film-links` | Link ngoài: youtube/vimeo/gdrive/misadrive/other |
| `hashtags` | Quản lý & gán hashtag, tìm theo hashtag |
| `storage` | Tích hợp MinIO: upload, presigned URL, stream range, xoá |
| `thumbnails` | Upload/validate ảnh bìa 16:9 |
| `notifications` | Sinh thông báo khi có phim mới |
| `search` | Tìm theo tên/hashtag/chuyên mục |
| `common` | Guard, interceptor, filter, DTO base, logger, cấu hình |

## 4. Data model (MySQL, utf8mb4_unicode_ci)
- **users**(id, email, full_name, password_hash, role_code, **department_id?**, created_by, is_active, created_at, updated_at)
- **roles**(code PK: **viewer|employee|super_admin**, name)  ← seed tĩnh, RBAC 3 cấp phẳng (ADR-045)
- **departments**(id, name UNIQUE, created_at) ← danh mục phòng ban, thuần TRUY VẾT (ADR-046)
- **categories**(id, name, slug, description, parent_id?, **created_by?**, **department_id?**, created_at)
  ← 2 cột thuần TRUY VẾT, KHÔNG dùng scope quyền (ADR-046)
- **films**(id, title, slug, description, category_id, uploader_id, **department_id?**, view_count, status: draft|published, published_at, is_new, created_at, updated_at)
  ← `department_id` là SNAPSHOT phòng ban của người tạo lúc tạo phim, thuần truy vết (ADR-046)
- **film_versions**(id, film_id, version_no, storage_key?, file_size?, duration?, thumbnail_key?, note, created_by, created_at) ← lịch sử cập nhật bản mới
- **film_links**(id, film_id, platform, url, label)
- **hashtags**(id, name, slug UNIQUE)
- **film_hashtags**(film_id, hashtag_id) ← n–n
- **film_views**(id, film_id, user_id?, session_hash, viewed_at) ← chống spam đếm view
- **notifications**(id, film_id, type: new_film|updated, created_at)
- **user_notifications**(user_id, notification_id, is_read) ← trạng thái đã đọc (tuỳ chọn)

**Quy tắc "phim mới":** `is_new=true` khi published; hết hạn sau N ngày (config, mặc định 14)
hoặc job dọn định kỳ. Update bản mới → tạo `film_versions` mới + set lại `is_new=true` + sinh notification.

**Đếm view:** ghi `film_views` (dedupe theo user_id hoặc session_hash trong cửa sổ 30') rồi tăng `films.view_count`.

## 5. Phân quyền — ma trận RBAC 3 CẤP PHẲNG (ADR-045 → 047)

> ⚠️ Nhánh này (`phan-quyen-3-cap`) là **một trong HAI phương án song song** đang chờ người dùng
> chọn. Nhánh `phan-quyen-4-cap` có ma trận khác (thêm Cấp 3 `dept_manager` scope theo phòng ban).
> Ma trận 3 vai trò cũ (`super_admin`/`admin`/`employee`) đã bị thay thế; `admin` không còn tồn
> tại — dữ liệu cũ migrate sang `super_admin` (ADR-047).

| Hành động | Cấp 1 `viewer` | Cấp 2 `employee` | Cấp 3 `super_admin` |
|---|---|---|---|
| Xem phim / ghi lượt xem | ✔ | ✔ | ✔ |
| Xem cây chuyên mục | ✔ | ✔ | ✔ |
| Tạo phim (upload/link ngoài) | ✘ | ✔ | ✔ |
| Sửa/Xoá phim **của mình** | ✘ | ✔ | ✔ |
| Sửa/Xoá phim của **người khác, cùng phòng ban** | ✘ | ✘ | ✔ |
| Sửa/Xoá phim của người khác, **phòng ban khác** | ✘ | ✘ | ✔ |
| Quản lý chuyên mục (ghi) | ✘ | ✘ | ✔ |
| Quản lý phòng ban | ✘ | ✘ | ✔ |
| Quản trị người dùng (tạo/sửa vai trò+phòng ban/khoá/xoá) | ✘ | ✘ | ✔ |
| Xem/xuất báo cáo | ✘ | ✘ | ✔ |

Điểm cần nhớ:
- **PHẲNG**: `department_id` KHÔNG tham gia kiểm quyền ở bất kỳ cấp nào (ADR-046) — nó chỉ là dữ
  liệu truy vết. Cấp 3 sửa được mọi phim, kể cả phòng ban khác mình.
- **Không ai gán được vai trò Cấp 3 qua API** (chốt chặn giữ từ GĐ1).
- Không có mức trung gian: trao quyền sửa phim người khác = trao luôn toàn quyền quản trị.

Guard tổ hợp: `RolesGuard` (theo `@Roles`, chặn Cấp 1 khỏi mọi route ghi phim) + kiểm quyền sở hữu
ở `FilmsService.assertCanManage` (chỉ 3 nhánh: super_admin / viewer / chính chủ).

## 6. Video Player (FE) — chiến lược "catch" đa nguồn
Component `VideoPlayer` chọn renderer theo nguồn:
- **File storage** → `<video>` HTML5, `src=/media/:key` (backend stream range), có fullscreen + volume + download.
- **YouTube** → nhúng IFrame Player API (parse videoId từ link).
- **Vimeo** → nhúng Vimeo Player.
- **Google Drive / MISA Drive** → iframe preview / nút mở link ngoài.
FE hiển thị **các nút link** tương ứng nguồn nào có. Trang xem có **URL riêng** `/films/:slug`.

## 7. Streaming & Storage
- Upload lớn: multipart / presigned PUT lên MinIO.
- Phát: backend proxy hỗ trợ **HTTP Range** (`206 Partial Content`) → tua/seek mượt; hoặc presigned GET.
- Download: nút tải chỉ bật khi version có `storage_key`.

## 8. PWA
- `vite-plugin-pwa` (Workbox): manifest, installable, cache app shell, offline fallback.
- Không cache file video (chỉ cache UI + metadata).

## 9. UTF-8 / Tiếng Việt
- MySQL `utf8mb4` + collation `utf8mb4_unicode_ci`.
- Backend trả JSON UTF-8; slug hoá tiếng Việt (bỏ dấu) cho URL.
- FE `<meta charset="utf-8">`, font MDS hỗ trợ tiếng Việt.

## 10. Hướng mở rộng (ghi nhận, ngoài prototype)
OIDC AMIS SSO · HLS transcoding · CDN · full-text search (nếu dữ liệu lớn).
