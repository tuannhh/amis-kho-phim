# AMIS Kho phim — Project Brief

> File nền tảng. Mọi file memory bank khác đều bám theo file này.
> Cập nhật khi phạm vi (scope) hoặc mục tiêu thay đổi.

## 1. Bối cảnh & Vấn đề
MISA hiện có rất nhiều phim tư liệu: giới thiệu sản phẩm, giới thiệu công ty, phim sự
kiện, phim đào tạo, hoạt động văn thể mỹ, tư liệu lịch sử... nhưng **lưu trữ rải rác**
(storage nội bộ, YouTube, Vimeo, Google Drive, MISA Drive). Hệ quả:
- Phim mới không được thông báo → mọi người vẫn dùng bản cũ.
- Muốn xem lại phải hỏi link nhiều nơi.
- Nhiều bộ phận cùng quản lý → khó tìm.

## 2. Mục tiêu
Xây **AMIS Kho phim** — một cổng tập trung quản lý toàn bộ tư liệu phim của MISA, đưa vào
quy trình/quy định nội bộ. Chạy trên Docker trước (prototype), sau bàn giao DevOps để
triển khai lên AMIS Platform.

## 3. Yêu cầu chức năng cốt lõi (nguồn: chủ đầu tư)
- Phân quyền upload cho nhân viên.
- Upload phim lên storage nội bộ **và/hoặc** chèn link ngoài (YouTube, Vimeo, Google Drive, MISA Drive).
- FE hiển thị dạng video player: play/pause/next/previous, tải về (nếu có file storage),
  bắt (catch) được video từ link YouTube/Vimeo.
- Chuẩn giao diện MISA Design System (MDS 2.0).
- Tạo được **chuyên mục** để upload đúng mục.
- **Tag "Phim mới"** khi có phim vừa xuất bản.
- Upload trùng tiêu đề → **cảnh báo đã tồn tại**, hỏi có cập nhật bản mới không → sau update gắn tag phim mới.
- Tìm kiếm theo **tên phim**.
- Gắn **hashtag** → tìm kiếm theo hashtag.
- Upload **thumbnail 16:9**.
- Tối ưu mobile dạng **PWA**.
- Mỗi phim hiển thị **số lượt xem**.
- Có màn **chỉnh sửa thông tin phim**.
- Bấm vào phim → **link riêng để xem phim**; player có nút **toàn màn hình**, chỉnh **âm lượng**.
- Copy nhanh link phim theo từng nguồn (YouTube/Vimeo/GDrive/MISA Drive/Nội bộ).
- Danh sách phim có **phân trang** (20/30/50 mỗi trang) + lọc "Tất cả chuyên mục"; **phim mới nhất luôn lên đầu**.
- **Phim mới** = xuất bản/cập nhật bản mới trong `NEW_FILM_TTL_DAYS` (mặc định 14 ngày), tính động theo ngày.
- **Báo cáo Quản trị** (GĐ 5): theo giai đoạn — ai upload bao nhiêu phim, gồm phim gì; lọc theo người upload/khoảng ngày, xuất CSV.
- Text **UTF-8**, hiển thị tốt tiếng Việt có dấu.

## 4. Phân quyền (3 cấp + super)
- **Super Admin**: toàn quyền (quản trị hệ thống). Tạo Admin & Nhân viên.
- **Admin**: xem/sửa/xoá **phim bất kỳ**; được tạo bởi Super Admin; tạo được Nhân viên.
- **Nhân viên**: xem/sửa/xoá **phim của chính mình**; không can thiệp phim người khác; được tạo bởi Super Admin hoặc Admin.

## 5. Ràng buộc kỹ thuật
- Backend: **Node.js (NestJS)** · DB: **MySQL (utf8mb4)** · Storage: **MinIO (S3-compatible)**.
- FE: **Vue 3 + Vite + Tailwind CSS + MISA Design System**, **PWA**.
- Triển khai: **Docker Compose**.
- Kiến trúc **module hoá**: sửa 1 vùng, ảnh hưởng tối thiểu.

## 6. Ngoài phạm vi (giai đoạn prototype)
- SSO/OIDC thật của AMIS (dùng auth nội bộ JWT, để chỗ cắm OIDC sau).
- Transcoding/adaptive bitrate (HLS) — ghi nhận là hướng mở rộng.
- CDN — DevOps xử lý khi lên AMIS.
