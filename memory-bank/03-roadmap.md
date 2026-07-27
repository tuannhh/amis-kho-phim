# AMIS Kho phim — Roadmap theo giai đoạn

Mỗi giai đoạn = một lát cắt dọc (BE + FE + Docker) chạy được & test được trước khi sang bước sau.
Cột "Model" là gợi ý model Claude Code nên dùng (KHÔNG dùng Fable 5).

> **Chiến lược UI-first (chốt 2026-07-21):** ưu tiên dựng UI xem được sớm bằng mock data,
> chốt giao diện khi còn rẻ, rồi backend chỉ thay mock bằng API thật. MỖI giai đoạn có UI
> đều có **Review Gate**: chạy preview trình duyệt → chụp ảnh cho chủ đầu tư duyệt → mới đi tiếp.
> Mục tiêu: giảm token & thời gian, tránh làm xong hết mới sửa.

> **Trạng thái (2026-07-21):** ✅ GĐ 0, 0.5, 1, 2, 3, 4, 5 ĐÃ XONG & verify end-to-end.
> Đang tới: **GĐ 6 — PWA & Mobile & MDS polish**.

| GĐ | Tên | Kết quả bàn giao | Model gợi ý |
|---|---|---|---|
| 0 ✅ | Nền móng | docker-compose (mysql+minio+nginx+skeleton BE/FE) chạy `up` được; FE shell + layout MDS xem được trên preview; memory bank; .env.example | **Sonnet 5** (scaffold) + **Opus 4.8** rà kiến trúc |
| 0.5 ✅ | **UI Prototype (mock data)** | Dựng TẤT CẢ màn hình chính bằng mock data, xem được trên trình duyệt: danh sách phim, chi tiết/xem phim (player), form upload/sửa, chuyên mục, quản trị người dùng/phân quyền, tìm kiếm/hashtag. **Review Gate → chốt UI trước khi làm backend.** | **Sonnet 5** (+ skill MDS) |
| 1 ✅ | Auth & RBAC | Đăng nhập JWT; seed super_admin; 3 role; guard Role+Owner; CRUD users (Super/Admin tạo user) — thay mock màn login/admin bằng API thật | **Opus 4.8** (bảo mật/phân quyền nhạy cảm) |
| 2 ✅ | Chuyên mục & Phim (core) | CRUD chuyên mục; CRUD phim (metadata) + slug; danh sách + chi tiết; UTF-8 tiếng Việt | **Sonnet 5** |
| 3 ✅ | Storage & Thumbnail | Upload file lên MinIO (presigned PUT); stream Range 206; download; upload thumbnail 16:9 (validate tỷ lệ); film_versions | **Opus 4.8** (streaming/range dễ sai) |
| 4 ✅ | Player & Link ngoài & View | VideoPlayer đa nguồn (file/YouTube/Vimeo/GDrive/MISA Drive); trang xem `/films/:slug`; nút link theo nguồn; đếm lượt xem; fullscreen+volume | **Opus 4.8** (player đa nguồn) → **Sonnet 5** (nút/link) |
| 5 ✅ | Nghiệp vụ nâng cao | Trùng tiêu đề → cảnh báo + update bản mới (versioning); tag "Phim mới"; hashtag; tìm theo tên/hashtag/chuyên mục; thông báo phim mới; **báo cáo Quản trị: theo giai đoạn ai upload bao nhiêu phim + gồm phim gì (lọc theo người upload/khoảng ngày, xuất CSV)** | **Sonnet 5** + **Opus 4.8** cho versioning |
| 6 | PWA & Mobile & MDS polish | vite-plugin-pwa (installable, offline shell); responsive mobile; chuẩn hoá UI theo skill misa-design-system | **Sonnet 5** (dùng skill MDS) |
| 6.1 | **GĐ 6.1 — AMIS Mobile Embed Readiness (scaffold, chờ DevOps)** | **SCAFFOLD/PLACEHOLDER — CHƯA phải tích hợp thật.** BE: `POST /auth/sso/amis-mobile` (xác minh HMAC tạm, tắt mặc định qua `AMIS_SSO_SHARED_SECRET` rỗng). FE: `lib/amisBridge.ts` (phát hiện `?embedded=1`, lấy token bridge, back cứng), `App.vue` ẩn header/sidebar khi nhúng, auth flow ưu tiên SSO bridge có fallback LoginView. Chờ đội AMIS Mobile cung cấp spec bridge/JWKS chính thức trước khi DevOps hoàn thiện. | **Sonnet 5** |
| 7 | Hardening & Handoff | security-review; test coverage; tài liệu API + quy trình nội bộ; hướng dẫn DevOps đưa lên AMIS (cắm OIDC, đổi storage) | **Opus 4.8** (review) + **Haiku 4.5** (docs/format) |

## Nguyên tắc chọn model (tổng quát)
- **Opus 4.8**: kiến trúc, phân quyền/bảo mật, streaming/range, versioning, review, gỡ lỗi khó.
- **Sonnet 5**: CRUD, wiring FE-BE, dựng UI theo MDS, phần lớn công việc thường ngày (nhanh, tiết kiệm).
- **Haiku 4.5**: sửa cơ học nhỏ, config, format, viết docs đơn giản, đổi text.
- Bật `/fast` (Opus) khi cần vòng lặp nhanh ở các phần suy luận nặng.

## Định nghĩa "Done" mỗi giai đoạn
1. Chạy được trong Docker. 2. **Review Gate**: preview trình duyệt + ảnh chụp cho chủ đầu tư duyệt (nếu có UI).
3. Có test cơ bản. 4. Cập nhật `04-progress.md` + `05-decisions.md`.
5. Không phá vỡ module khác (ranh giới module giữ nguyên).
