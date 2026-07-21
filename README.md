# AMIS Kho phim

Cổng tập trung quản lý tư liệu phim của MISA (giới thiệu sản phẩm/công ty, sự kiện, đào
tạo, văn thể mỹ, tư liệu lịch sử...). Thay thế tình trạng lưu trữ rải rác, thông báo phim
mới, tìm kiếm dễ, phân quyền rõ ràng. Chạy Docker trước, sau bàn giao DevOps lên AMIS Platform.

## Stack
Vue 3 + Tailwind + MISA Design System (PWA) · NestJS · MySQL (utf8mb4) · MinIO · Docker.

## Tài liệu sống — đọc `memory-bank/` trước khi code
| File | Nội dung |
|---|---|
| `00-projectbrief.md` | Bối cảnh, mục tiêu, yêu cầu, phân quyền, scope |
| `01-architecture.md` | Sơ đồ hệ thống, module BE, data model, RBAC, player, streaming |
| `02-techContext.md` | Stack chi tiết, cấu trúc thư mục, .env, quy ước, bảo mật |
| `03-roadmap.md` | 8 giai đoạn (GĐ0–7) + gợi ý model Claude mỗi giai đoạn |
| `04-progress.md` | Nhật ký đã làm gì |
| `05-decisions.md` | Nhật ký quyết định (ADR) |
| `06-activeContext.md` | Đang làm gì ngay lúc này |

## Trạng thái
GĐ 0 — Nền móng. Plan + memory bank xong, chờ duyệt để scaffold Docker.
