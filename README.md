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
| `11-coding-rules.md` | Quy tắc code riêng + bẫy kỹ thuật đã biết (đọc trước khi sửa code) |

## Tài liệu bàn giao — `docs/`
| File | Nội dung |
|---|---|
| `docs/danh-gia-an-ninh.md` | Đánh giá an ninh theo chuẩn Backend MISA (9 mục baseline) |
| `docs/api-overview.md` | 25 endpoint theo module, ai gọi được |
| `docs/quy-trinh-noi-bo.md` | Hướng dẫn cho người dùng cuối & vận hành |
| `docs/devops-handoff.md` | Checklist đưa lên hạ tầng MISA (OIDC, storage, migration, go-live) |

API tương tác: `/api/docs` (Swagger) — bật ở dev, TẮT mặc định ở production.

## Trạng thái
✅ **Đã hoàn thành toàn bộ roadmap chính: GĐ 0 → GĐ 7.**

| GĐ | Nội dung | Trạng thái |
|---|---|---|
| 0 + 0.5 | Nền móng Docker + UI mock | ✅ |
| 1 | Auth & RBAC (JWT, 3 vai trò) | ✅ |
| 2 | Chuyên mục & Phim core + owner policy | ✅ |
| 3 | Storage & Thumbnail (MinIO thật) | ✅ |
| 4 | Player & Link ngoài & đếm lượt xem | ✅ |
| 5 | Thông báo + Báo cáo Quản trị (CSV) | ✅ |
| 6 | PWA & Mobile & MDS polish | ✅ |
| 6.1 | Scaffold nhúng AMIS Mobile | ⏸️ Placeholder — chờ spec bridge từ đội AMIS Mobile |
| 7 | Hardening & Handoff | ✅ |

**GĐ 7** áp dụng skill `misa-backend-standard`: sửa 12 vấn đề bảo mật/vận hành, ghi nhận 11
rủi ro còn treo kèm lý do, bổ sung 152 test tự động (trước đó dự án không có test nào), và
viết trọn bộ tài liệu bàn giao ở `docs/`.

**Việc treo duy nhất:** hoàn thiện GĐ 6.1 khi đội AMIS Mobile cung cấp spec bridge chính thức
— checklist ở `docs/devops-handoff.md` mục 6.

## Chạy thử
```bash
cp .env.example .env
docker compose up -d --build
```
→ http://localhost:8180 · đăng nhập `superadmin@misa.com.vn` / `Admin@12345` (đổi ngay ở prod).

```bash
cd backend  && npm test   # 126 test
cd frontend && npm test   # 26 test
```
