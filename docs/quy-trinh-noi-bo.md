# AMIS Kho phim — Quy trình sử dụng nội bộ

> Dành cho **người dùng cuối và bộ phận vận hành** ở MISA. Không cần biết kỹ thuật.
> Tài liệu kỹ thuật ở `docs/api-overview.md` và `docs/devops-handoff.md`.

## 1. Kho phim dùng để làm gì

Nơi lưu trữ và tra cứu tập trung toàn bộ phim/video nội bộ của MISA: phim đào tạo, video sự
kiện, tư liệu truyền thông... Thay cho việc mỗi người giữ một bản trên Drive riêng.

Mỗi phim gồm: tên, chuyên mục, mô tả, hashtag, ảnh bìa, và **nguồn phát** — có thể là file
tải thẳng lên hệ thống, hoặc link YouTube / Vimeo / Google Drive / MISA Drive.

## 2. Ba vai trò và ai làm được gì

| Việc | Nhân viên | Admin | Super Admin |
|---|:--:|:--:|:--:|
| Xem, tìm kiếm, phát phim | ✅ | ✅ | ✅ |
| Đăng phim mới | ✅ | ✅ | ✅ |
| Sửa/xoá **phim của chính mình** | ✅ | ✅ | ✅ |
| Sửa/xoá **phim của người khác** | ❌ | ✅ | ✅ |
| Tạo/sửa/xoá chuyên mục | ❌ | ✅ | ✅ |
| Tạo tài khoản nhân viên | ❌ | ✅ | ✅ |
| Tạo tài khoản admin | ❌ | ❌ | ✅ |
| Khoá/xoá tài khoản | ❌ | chỉ nhân viên | admin + nhân viên |
| Xem và xuất báo cáo | ❌ | ✅ | ✅ |

Hai quy tắc an toàn luôn đúng: **không ai tự khoá/xoá được chính mình**, và **Super Admin
không tác động được lên Super Admin khác** (tránh trường hợp khoá lẫn nhau mất quyền quản trị).

> Phân quyền được kiểm ở máy chủ, không chỉ ẩn nút trên giao diện — không thể lách bằng
> cách gọi thẳng đường dẫn.

## 3. Đăng nhập lần đầu

1. Mở địa chỉ Kho phim do bộ phận CNTT cung cấp.
2. Nhập email MISA và mật khẩu tạm mà quản trị viên gửi cho bạn.
3. Hệ thống **bắt buộc đổi mật khẩu ngay lần đầu** — nhập mật khẩu mới tối thiểu 8 ký tự.
   Chưa đổi thì chưa vào được các màn hình khác.
4. Xong bước này bạn vào thẳng danh sách Kho phim.

**Quên mật khẩu?** Hiện chưa có chức năng tự đặt lại. Liên hệ quản trị viên để được cấp mật
khẩu tạm mới (quy trình ở mục 7).

**Nhập sai nhiều lần?** Hệ thống giới hạn 10 lần thử mỗi phút để chống dò mật khẩu. Nếu bị
chặn, chờ khoảng một phút rồi thử lại.

## 4. Tìm và xem phim

- **Kho phim** (trang chính): xem toàn bộ phim dạng thẻ, có ảnh bìa, chuyên mục, lượt xem.
- **Ô tìm kiếm** trên thanh trên cùng: gõ tên phim hoặc hashtag.
- **Chuyên mục**: lọc theo cây chuyên mục (chuyên mục cha – con).
- Nhãn **"Phim mới"** tự hiện với phim đăng hoặc cập nhật trong vòng 14 ngày, tự mất sau đó.
- Bấm vào một phim để mở trang xem. Phim lưu nội bộ phát trực tiếp trên trang (tua/seek được);
  phim từ YouTube/Vimeo nhúng sẵn; Google Drive/MISA Drive mở bằng nút liên kết sang tab mới.
- Lượt xem được tính khi bạn mở trang xem. Mở lại cùng một phim trong vòng 30 phút chỉ tính
  một lần — con số phản ánh người xem thật, không phải số lần bấm F5.

**Trên điện thoại:** giao diện tự chuyển sang dạng gọn, có thanh điều hướng dưới đáy màn hình.
Có thể "Thêm vào màn hình chính" để dùng như ứng dụng. Khi mất mạng sẽ có dải thông báo màu
báo rõ, và khi có phiên bản mới sẽ hỏi trước chứ không tự tải lại (tránh mất nội dung đang nhập).

## 5. Đăng phim mới

Vào **Thêm phim** trên thanh điều hướng.

1. **Thông tin bắt buộc:** tên phim (≥ 2 ký tự) và chuyên mục.
2. **Mô tả và hashtag:** nên điền — đây là thứ giúp đồng nghiệp tìm ra phim của bạn sau này.
3. **Chọn nguồn phát — cần ít nhất một trong hai:**
   - *Tải file lên hệ thống:* chọn file video (mp4, webm, ogg, mov, mkv). Dung lượng tối đa
     theo cấu hình hệ thống (mặc định 2GB). Có thanh tiến trình khi tải.
   - *Dán liên kết ngoài:* YouTube, Vimeo, Google Drive hoặc MISA Drive.
4. **Ảnh bìa:** JPG/PNG/WebP, **bắt buộc tỷ lệ 16:9** (ví dụ 1280×720). Có thể kéo thả hoặc
   dán trực tiếp ảnh đã copy bằng Ctrl+V. Không có ảnh bìa thì hệ thống hiện nền màu thay thế.
5. Bấm **Xuất bản**.

**Lưu ý hữu ích:**
- Nếu bạn rời trang khi form còn dở, hệ thống hỏi trước và cho **lưu nháp**. Nháp tự khôi phục
  khi bạn quay lại. Lưu ý nháp chỉ giữ phần chữ — **file đã chọn phải chọn lại**.
- Không tự đặt được đường dẫn (slug) của phim, hệ thống tự sinh từ tên để tránh trùng.

## 6. Cập nhật phim đã có

Mở phim → **Sửa** (chỉ hiện nếu bạn có quyền).

- Sửa được: tên, chuyên mục, mô tả, hashtag, liên kết ngoài.
- Tải lên file mới sẽ tạo **phiên bản mới**, hệ thống vẫn giữ lịch sử các phiên bản cũ.
- Chỉ thay ảnh bìa thì video cũ vẫn nguyên (và ngược lại).
- ⚠️ **Cần biết:** mỗi lần sửa, phim được gắn lại nhãn **"Phim mới"** và nhảy lên đầu danh
  sách — kể cả khi bạn chỉ sửa một dấu chấm trong phần mô tả. Nếu chỉnh sửa vặt nhiều phim
  cùng lúc, danh sách sẽ bị xáo trộn.

## 7. Việc của quản trị viên

### Quản lý chuyên mục
**Chuyên mục** → thêm/sửa/xoá. Chuyên mục có thể lồng cha – con. Lưu ý **không đổi được
chuyên mục cha sau khi đã tạo** (thiết kế có chủ đích để tránh cây bị lặp vòng).

### Cấp tài khoản mới
**Quản trị người dùng** → **Thêm người dùng**:
1. Nhập email MISA, họ tên, chọn vai trò.
2. Để trống ô mật khẩu → hệ thống sinh mật khẩu tạm 12 ký tự.
3. ‼️ **Mật khẩu tạm chỉ hiện MỘT LẦN duy nhất** ngay sau khi tạo. Sao chép và gửi cho người
   dùng qua kênh nội bộ an toàn trước khi đóng cửa sổ. Đóng rồi thì không xem lại được —
   phải xoá tài khoản và tạo lại.
4. Người dùng bắt buộc đổi mật khẩu ở lần đăng nhập đầu.

### Khoá tài khoản (khi nhân viên nghỉ việc/chuyển bộ phận)
**Quản trị người dùng** → gạt trạng thái sang khoá. Nên **khoá thay vì xoá**: xoá làm mất
liên kết người upload trên các phim cũ, còn khoá thì giữ nguyên lịch sử.

> Lưu ý kỹ thuật: người vừa bị khoá có thể còn thao tác được **tối đa 15 phút** cho tới khi
> phiên đăng nhập hiện tại hết hạn. Nếu là trường hợp khẩn cấp, báo bộ phận CNTT.

### Báo cáo
**Báo cáo** → lọc theo người upload và/hoặc khoảng thời gian → xem bảng tổng hợp
(ai đăng bao nhiêu phim, gồm những phim nào) → **Xuất CSV** để mở bằng Excel.
File đã xử lý sẵn để hiện tiếng Việt có dấu đúng trên Excel Windows.

## 8. Khi gặp sự cố

| Hiện tượng | Xử lý |
|---|---|
| "Email hoặc mật khẩu không đúng" | Kiểm tra lại; nếu chắc chắn đúng, liên hệ quản trị viên xem tài khoản có bị khoá không. |
| Bị chặn đăng nhập vì thử quá nhiều | Chờ khoảng 1 phút rồi thử lại. |
| "Bạn chỉ có thể sửa/xoá phim của chính mình" | Đúng thiết kế. Nhờ admin hoặc người đăng phim đó thao tác. |
| Tải video lên thất bại | Kiểm tra định dạng (mp4/webm/ogg/mov/mkv) và dung lượng. Mạng yếu nên thử lại từ đầu. |
| Ảnh bìa bị từ chối | Ảnh phải đúng tỷ lệ 16:9 và là JPG/PNG/WebP thật (không phải file đổi đuôi). |
| Phim đã đăng nhưng không phát được | Nếu là link ngoài, kiểm tra quyền truy cập của link đó (Google Drive thường bị giới hạn chia sẻ). |
| Chuông thông báo luôn trống | **Đúng chủ ý** — tính năng bắn thông báo đang tắt để tránh spam. |

Vấn đề không nằm trong bảng trên: liên hệ bộ phận CNTT kèm ảnh chụp màn hình và thời điểm xảy ra.
