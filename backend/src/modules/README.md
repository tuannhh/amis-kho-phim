# Modules (NestJS) — thêm dần theo giai đoạn

Mỗi domain là 1 module độc lập (controller + service + repository + dto + entity).
Module chỉ giao tiếp qua service được export; logic dùng chung ở `../common`.

| Module | Giai đoạn tạo | Trách nhiệm |
|---|---|---|
| `auth` | GĐ 1 | Login JWT, guard, chỗ cắm OIDC AMIS |
| `users` | GĐ 1 | CRUD người dùng, gán role |
| `rbac` | GĐ 1 | Role/permission, RolesGuard + OwnerGuard |
| `categories` | GĐ 2 | Chuyên mục (lồng cấp) |
| `films` | GĐ 2 | CRUD phim, versioning, đếm view, trùng tiêu đề, tag mới |
| `storage` | GĐ 3 | MinIO: upload, stream range, download |
| `thumbnails` | GĐ 3 | Ảnh bìa 16:9 |
| `film-links` | GĐ 4 | Link ngoài: youtube/vimeo/gdrive/misadrive |
| `hashtags` | GĐ 5 | Gán & tìm theo hashtag |
| `notifications` | GĐ 5 | Thông báo phim mới |
| `search` | GĐ 5 | Tìm theo tên/hashtag/chuyên mục |

> Tạo module khi thực sự triển khai (không tạo shell rỗng) để giữ code sạch.
