# AMIS Kho phim — Progress Log

> Nhật ký "đã làm gì". Cập nhật MỖI khi hoàn thành một việc đáng kể.
> Format: `YYYY-MM-DD — [GĐ x] mô tả — trạng thái`.

## Trạng thái tổng
- **Việc mới nhất: GĐ 8 — GIAI ĐOẠN C — SỬA 3 LỖI UI NGƯỜI DÙNG CHỤP + QUÉT TOÀN DẢI VIEWPORT
  — ✅ XONG (2026-08-07, Opus 5), CHỈ trên nhánh `phan-quyen-4-cap`.** Nhật ký ở mục
  "Nhật ký GĐ 8 — Giai đoạn C" ngay dưới; quyết định ở **ADR-063, ADR-064, ADR-065**.
  **Tổng test: 216 unit BE + 106 tích hợp BE + 82 FE = 404** (không đổi — sửa lỗi trình bày).
  Màn mới: **`CategoryMobileView.vue`** (Chuyên mục bản mobile) — trước đó `/categories` là màn
  cấp một DUY NHẤT còn render bản desktop 2 cột ở Compact và vỡ layout.
- **Việc trước đó: GĐ 8 — MOBILE-NATIVE UI, GIAI ĐOẠN B — DỰNG LẠI VỎ MOBILE
  — ✅ XONG (2026-08-07, Opus 5), CHỈ trên nhánh `phan-quyen-4-cap`.** Nhật ký đầy đủ ở mục
  "Nhật ký GĐ 8 — Giai đoạn B" ngay dưới; quyết định ở **ADR-061, ADR-062**.
  **Tổng test: 216 unit BE + 106 tích hợp BE + 82 FE = 404** (không đổi — đợt này là redesign
  thị giác, không thêm quy tắc nghiệp vụ nào cần test mới).
  **Việc lớn nhất: ở Compact ẩn HẲN header MDS** (ADR-061) và thay bằng vỏ mobile riêng
  (hero header brand + bottom nav 4 mục + FAB + màn "Tài khoản" mới).
  ⚠️ Phần "Giai đoạn B" theo nghĩa CŨ (Thêm/Sửa phim dạng wizard, popup → bottom sheet, các
  màn quản trị) **VẪN CHƯA LÀM** — đợt này chỉ làm phần VỎ + thẩm mỹ.
- **Việc trước đó: GĐ 8 — MOBILE-NATIVE UI, GIAI ĐOẠN A (Kho phim / Xem phim / Đăng nhập)
  — ✅ XONG (2026-08-07, Opus 5), CHỈ trên nhánh `phan-quyen-4-cap`.** Nhật ký đầy đủ ở mục
  "Nhật ký GĐ 8 — Giai đoạn A" ngay dưới; quyết định ở **ADR-058 → ADR-060**.
  **Tổng test: 216 unit BE + 106 tích hợp BE + 82 FE = 404** (trước đợt này 391; +13 test FE
  mới cho `pickView` và bộ lọc dùng chung) + 2 script kiểm thử đồng thời.
  ⚠️ **Giai đoạn B CHƯA LÀM** (Thêm/Sửa phim dạng wizard, popup → bottom sheet) — xem mục
  "Để lại cho Giai đoạn B" cuối nhật ký.
- **Việc trước đó: ĐỢT 2 — 10 VIỆC (5, 6, 8, 9, 10, 11, 12, 13, 14, 15) — ✅ XONG 9/10,
  hoãn có chủ đích 1 phần (2026-08-07, Opus 5), CHỈ trên nhánh `phan-quyen-4-cap`.**
  Nhật ký đầy đủ ở mục "Nhật ký ĐỢT 2 — 10 việc" ngay dưới; quyết định ở **ADR-052 → ADR-057**.
  **Tổng test: 216 unit BE + 106 tích hợp BE + 69 FE = 391** (trước đợt này 330) + 2 script
  kiểm thử đồng thời. ⚠️ **Phần DUY NHẤT hoãn: multipart-resume cho video (việc 15 mục 3)** —
  xem đề xuất cụ thể ở cuối nhật ký, KHÔNG được coi là đã làm.
- **Việc trước đó: ĐỢT 2 SỬA THEO TEST THỰC TẾ (5 việc: 1, 2, 3, 4a, 7) — ✅ XONG
  (2026-08-06, Opus 5), CHỈ trên nhánh `phan-quyen-4-cap`.** Trong đó **3 bug thật đã sửa**
  (rò nháp giữa 2 tài khoản, quyền chuyên mục quá chặt, layout/nội dung khung tải phim),
  **1 đổi nghiệp vụ** (cho dùng nhiều nguồn cùng lúc + đổi ưu tiên phát) và **1 việc xác định
  KHÔNG phải bug** (việc 7 — Trưởng phòng SỬA/XOÁ ĐƯỢC phim nhân viên cùng phòng). Xem nhật ký
  ngay dưới + ADR-050, ADR-051. **Tổng test: 182 unit BE + 85 tích hợp BE + 63 FE = 330.**
- **Việc trước đó: ĐỢT SỬA 5 VẤN ĐỀ TỪ TEST THỰC TẾ — ✅ XONG (2026-08-06, Opus 5), áp dụng
  CẢ HAI NHÁNH.** Trong đó 4 việc là bug/UX thật đã sửa (ẩn Chuyên mục với Cấp 1, bỏ chữ kỹ
  thuật, thiết kế lại nhập hashtag, YouTube Error 153) và **1 việc xác định KHÔNG phải bug**
  (nút upload/xuất bản chạy đúng — do thao tác thiếu chọn Chuyên mục). Xem nhật ký ngay dưới +
  ADR-048, ADR-049.
- ⚠️ **ĐANG CÓ HAI NHÁNH RBAC SONG SONG CHỜ NGƯỜI DÙNG CHỌN** (chưa nhánh nào merge vào `main`):
  `phan-quyen-4-cap` (4 cấp có scope phòng ban — **nhánh của file này**) và `phan-quyen-3-cap`
  (3 cấp phẳng). Xem nhật ký ngay dưới + ADR-040→044.
- **Việc PHÁT SINH mới nhất (ngoài roadmap): RBAC 4 CẤP CÓ SCOPE PHÒNG BAN — ✅ XONG
  (2026-08-05, Opus 5).** Thay thế HOÀN TOÀN 3 vai trò cũ `super_admin`/`admin`/`employee`.
  Xem "Nhật ký RBAC 4 cấp" ngay dưới + ADR-040→044. **Tổng test: 174 unit BE + 82 tích hợp
  BE trên MySQL thật + 43 FE = 299** (trước đợt này: 129 + 46 + 26 = 201).
- Giai đoạn hiện tại (roadmap chính): **GĐ 7 — Hardening & Handoff ĐÃ XONG (2026-07-29, Opus 5)**.
  Đây là **giai đoạn CUỐI của roadmap chính** — GĐ 0 → GĐ 7 đã hoàn tất toàn bộ.
  Commit local (chưa push).
- % hoàn thành tổng thể: **100% lộ trình chính (GĐ 0–7)**. Việc treo duy nhất còn lại
  không thuộc lộ trình: hoàn thiện GĐ 6.1 (SSO AMIS Mobile) khi đội AMIS Mobile cung cấp
  spec bridge thật — xem checklist đầy đủ ở `docs/devops-handoff.md` mục 6.
- **GĐ 7 áp dụng skill `misa-backend-standard`** (Quy chuẩn Backend MISA, tại
  `~/.claude/skills/misa-backend-standard`) làm khung chuẩn cho phần đánh giá an ninh,
  chiến lược kiểm thử và refactor. Phiên sau nếu sửa backend PHẢI dùng lại skill này.
- **Đã có đợt BỔ SUNG đưa GĐ7 về đúng chuẩn** (kiểm thử tích hợp 46 test trên DB thật, kiểm
  thử đồng thời, CI GitHub Actions, quét phụ thuộc) — đợt này phát hiện và sửa **2 lỗi đúng
  đắn dữ liệu thật** mà unit test không thể thấy: race condition ở `recordView` (ADR-036) và
  phụ thuộc ngầm vào múi giờ Node↔MySQL (ADR-037). **Tổng 201 test tự động.**
- Xem `06-activeContext.md` để biết chi tiết cần làm tiếp khi mở lại phiên.


## Nhật ký GĐ 8 — Giai đoạn C (Sửa 3 lỗi UI người dùng chụp + quét toàn dải viewport) — 2026-08-07, Opus 5 — ✅ XONG (CHỈ nhánh `phan-quyen-4-cap`)

**Bối cảnh:** Người dùng tự test bản mobile trên điện thoại thật, xác nhận *"đẹp hơn đáng kể
rồi"* nhưng chụp lại **3 lỗi cụ thể** kèm khoanh đỏ, và yêu cầu tối ưu trên mọi kích thước màn
hình (iPhone lẫn Android). Cả 3 lỗi đều đã **tái hiện được trên browser trước khi sửa** —
không có lỗi nào sửa theo suy đoán.

### Lỗi 1 — `/categories` VỠ LAYOUT ở Compact → thêm `CategoryMobileView.vue` (ADR-063)
- **Tái hiện (390x844):** cây chuyên mục chiếm 320px, cột chi tiết bị ép còn vài chục pixel,
  chữ "Chọn một chuyên mục để xem chi tiết" xuống dòng TỪNG KÝ TỰ trong dải dọc sát mép phải.
  Nguyên nhân: route `/categories` chưa được đưa vào `lazyResponsiveView` ở GĐ8-A/B nên bản
  desktop master-detail render nguyên xi.
- **Sửa:** `features/categories/CategoryMobileView.vue` (mới) — hero header + nút "Thêm" góc
  trên phải, danh sách cây một cột (chevron mở/thu riêng, con thụt lề 16px/cấp, dòng 56px),
  bottom sheet thêm/sửa. Route đổi sang `lazyResponsiveView`. Thêm slot `actions` cho
  `MobileHeroHeader`.
- **Kiểm thật 2 vai:** Cấp 4 (`superadmin@`) để trống cha → tạo được chuyên mục lớn; Cấp 2
  (`nv1@`) ô cha là bắt buộc, bấm Lưu khi bỏ trống → chặn kèm lời giải thích, chọn cha
  "Phim Giới thiệu công ty" → **tạo thật thành công** "GĐ8C Kiểm thử Cấp 2" (cây 3→4 mục), rồi
  **xoá thật** để dọn (4→3). Cấp 2 mở chuyên mục GỐC → không có nút Xoá/Lưu, hiện đúng câu
  "Đây là chuyên mục lớn — chỉ Quản trị cao nhất được sửa hoặc xoá."

### Lỗi 2 — Khối xám trơn cuối trang Xem phim
- **Tái hiện:** phim không có mô tả → nội dung ngắn hơn màn hình, phần thừa của vùng cuộn để lộ
  nền `--mds-bg-page` (#ecedef) thành một chữ nhật xám không nội dung. **Không phải** section
  rỗng hay UI dở dang — chỉ là khối trắng không giãn hết chiều cao.
- **Sửa (`FilmDetailMobileView.vue`):** vùng cuộn thành `flex flex-col`, khối nội dung trắng
  thêm `flex-1` → luôn phủ kín phần còn lại. Đã chụp lại xác nhận khối xám biến mất.

### Lỗi 3 — Khung "Tải ảnh bìa" lệch, không đồng nhất với "Tải phim lên"
- **Nguyên nhân:** `MUpload` ảnh bìa thiếu `full-width` + `hint-inside` (khung video đã có từ
  đợt 1). Chuỗi "JPG/PNG/WebP, tỷ lệ 16:9 · Dung lượng tối đa 15MB" đứng cùng hàng với nhãn,
  ở màn hẹp thì tràn và quấn quanh nhãn trông như một nút bấm riêng.
- **Sửa:** thêm `full-width hint-inside`, rút gọn `formats="JPG/PNG/WebP · 16:9"`; khung xem
  trước bỏ `max-w-[280px]` ở màn hẹp (`sm:max-w-[280px]`) để rộng bằng dropzone; hàng nhãn của
  `MUpload` thêm `flex-wrap` phòng các chỗ khác không bật `hintInside`. Hai khung giờ có bố cục
  y hệt nhau.

### Phát sinh khi quét toàn dải — 2 vấn đề THẬT tự tìm ra, đã sửa
- **Medium 600x960 vỡ y hệt lỗi 1** (ADR-064): sidebar 200px + cây 320px → cột chi tiết lại bị
  ép, chữ vỡ từng ký tự. Sửa: ép sidebar về rail ở Medium (`App.vue`), và CategoryView desktop
  xếp dọc dưới 720px bề rộng VÙNG NỘI DUNG bằng `@container`.
- **Vùng chạm dưới chuẩn ở `/upload`** (ADR-065): MInput 34px, MSelect 36px, MButton 32px, nút
  Back 32px, chip hashtag 21px, nút X đóng của MDrawer/MDialog 24px. Sửa ở tầng token
  (`--mds-btn-height`/`--mds-input-height` = 44px dưới 600px) + `sm:` cho các ngoại lệ.

### Kết quả quét toàn dải viewport (đo tự động, không phải nhìn bằng mắt)
Với mỗi viewport chạy qua đủ 5 màn (`/films`, chi tiết phim, `/upload`, `/categories`,
`/account`) đo `documentElement.scrollWidth` và mọi phần tử tương tác:

| Viewport | Cuộn ngang | Vùng chạm < 44px | Shell |
|---|---|---|---|
| 320x568 · 360x800 · 375x667 | không | không | mobile |
| 390x844 · 393x852 · 412x915 · 412x892 · 428x926 | không | không | mobile |
| **599x800** | không | không | **mobile** ✓ đúng ngưỡng |
| **600x960** (tablet dọc, Medium) | không | — (mật độ chuột) | **desktop + rail 56px** ✓ |
| **601x800** | không | — (mật độ chuột) | **desktop** ✓ |
| 1280x800 | không | — | desktop sidebar 200px, 2 cột — không hồi quy |

Ngưỡng 600px **không lệch**: 599 = mobile, 600/601 = desktop.

**Test:** FE build sạch (`vue-tsc` qua), **82 FE + 216 unit BE pass**, không sửa test nào.

**Còn chưa ổn (nói thẳng):** xem mục "Tự đánh giá GĐ8-C" ở `06-activeContext.md`.

**File đụng vào:** `features/categories/CategoryMobileView.vue` (mới) ·
`features/categories/CategoryView.vue` · `features/films/FilmDetailMobileView.vue` ·
`features/upload/FilmForm.vue` · `features/upload/FilmUploadView.vue` · `components/mds/MUpload.vue` ·
`components/mds/MDrawer.vue` · `components/mds/MDialog.vue` · `components/mobile/MobileHeroHeader.vue` ·
`components/HashtagInput.vue` · `assets/mds/tokens.css` · `router/index.ts` · `App.vue`


## Nhật ký GĐ 8 — Giai đoạn B (Dựng lại VỎ mobile) — 2026-08-07, Opus 5 — ✅ XONG (CHỈ nhánh `phan-quyen-4-cap`)

**Bối cảnh:** Người dùng xem ảnh chụp bản Giai đoạn A và **bác bỏ**: *"nhìn xấu, vẫn giống web
thu nhỏ chứ chưa giống app native"*, kèm ảnh tham khảo các app AMIS Mobile (Chat, Chấm công,
OneAI, Bảng tin). Hỏi lại thì có một thông tin **đổi hướng**: trên điện thoại người dùng
**không bao giờ** mở Kho phim bằng link trình duyệt trần — họ luôn bấm icon Kho phim trong app
AMIS Mobile. Tức mobile = luôn nhúng. Từ đó chốt ADR-061 (ẩn hẳn header MDS ở Compact).

**Đợt này là REDESIGN THỊ GIÁC + đổi vỏ điều hướng, KHÔNG đụng RBAC/API/schema.** Không thêm
test mới (không có quy tắc nghiệp vụ mới); 404 test cũ vẫn xanh.

### 1. Ẩn header MDS ở Compact, dựng vỏ mobile riêng (ADR-061)
- `App.vue`: `showMdsHeader = !isCompact` → `MHeaderBar` biến mất hoàn toàn dưới 600px.
  Banner Global Inline (mất mạng / có bản mới) **vẫn giữ** ở Compact.
- Nhánh "không chrome" của GĐ6.1 nay là `isChromeless = isEmbedded() && !isCompact` — nhúng ở
  Compact KHÔNG còn ẩn sạch điều hướng nữa, vì app mẹ không điều hướng hộ bên trong Kho phim.
- **File mới `components/mobile/MobileHeroHeader.vue`** — thanh đầu trang màn cấp một: gradient
  giữa hai bậc brand (`--mds-brand-600` → `700`), bo góc dưới 24px, tiêu đề 22px, chuông thông
  báo, có slot để nhét ô tìm kiếm/thẻ danh tính vào trong vùng brand.
- **File mới `components/mobile/MobileBottomNav.vue`** — thanh dưới bo góc trên 20px, bóng hắt
  lên, mục active có viên thuốc nền `--mds-brand-50` quanh icon, **FAB tròn 56px** nhô lên
  giữa thanh.
- **File mới `features/account/AccountMobileView.vue`** + route `/account` (ADR-062).

### 2. Bù các chức năng của header đã ẩn
- **Tìm kiếm:** ô pill nền trắng ngay trong hero header màn Kho phim, `font-size: 16px` (chống
  iOS tự zoom), lọc ngay khi gõ, có nút xoá từ khoá.
- **Thông báo:** chuông trên hero header + mục trong màn Tài khoản; cả hai mở đúng
  `NotificationsPanel` full-screen sẵn có. `router-view` được gắn `@notifications` để màn con
  phát ngược lên `App.vue`.
- **Đổi mật khẩu / Đăng xuất / Quản trị:** màn Tài khoản.

### 3. Nâng cấp thẩm mỹ (phần người dùng chê "xấu")
- `FilmCardMobile`: bo góc 8px → **18px**; đổi `--mds-shadow-card` (0 0 2px, gần như phẳng)
  sang bóng khuếch tán 2 lớp; padding 10px → 14px; tiêu đề 14→14.5px semibold; chân thẻ có kẻ
  nhạt tách số liệu; **sửa lỗi thật**: tên chuyên mục dài tràn ra ngoài viên `MTag` (MTag cao
  cố định 20px, chữ xuống dòng) → thêm `truncate` trong slot; bỏ tên người đăng ở thẻ kệ.
- `CategoryShelves` (chỉ nhánh `mobile`): **bỏ hộp trắng bao ngoài** — trước đây là thẻ trắng
  lồng trong hộp trắng, nhìn bẹt. Tiêu đề kệ đứng thẳng trên nền trang. Desktop giữ nguyên.
- **Hàng ô chuyên mục** đầu trang Kho phim: lưới 4 cột, ô icon 52px bo 16px, nền tint pha
  `color-mix` từ ĐÚNG token màu của chuyên mục đó (cùng tông với `MTag` chuyên mục trên thẻ
  phim) — không có mã màu ngoài `tokens.css`. Icon lấy từ bộ Tabler đã đăng ký
  (`categoryIconFor` trong `filmTypes.ts`). Có ô "Tất cả" đứng đầu; bấm lại ô đang chọn = bỏ lọc.
- Nền vùng nội dung: gradient rất nhẹ `--mds-brand-50` → `--mds-bg-page` trong 200px đầu, để
  chỗ tiếp giáp dưới hero header không cắt phựt từ xanh đậm sang xám.
- `FilmDetailMobileView`: tiêu đề 16→18px; **2 ô KPI** (Lượt xem / Lượt tải) nền `brand-50` bo
  16px thay cho danh sách gạch đầu dòng; nút "Tải xuống" thành **pill 52px** gradient brand
  có bóng màu brand (thay `MButton` 32px vuông).
- Phân trang: nút Prev/Next thành nút tròn nền `brand-50`.

### 4. Vùng chạm & tràn ngang
- Kiểm bằng script trên trang thật ở 320px: `scrollWidth === clientWidth === 320` (không tràn
  ngang), và **không còn phần tử tương tác nào cao dưới 48px**.
- Chip bộ lọc: viên thuốc vẫn cao 32px cho gọn mắt nhưng nút bao ngoài cao 48px.
- Nhãn bottom nav rút gọn riêng cho mobile ("Phim tôi quản lý" → "Của tôi") vì ô nhãn chỉ
  rộng ~63px ở 320px.

### 5. Bằng chứng browser test (dev server 5180, dữ liệu thật qua proxy sang stack Docker 8180)
- 375px và 320px: header MDS **đã biến mất hoàn toàn**; hero header + bottom nav + FAB đúng.
- **RBAC 2 tài khoản khác cấp:** `xem@misa.com.vn` (Cấp 1) → đúng 2 tab (Kho phim, Tài khoản),
  **không có FAB**, màn Tài khoản không có nhóm "Quản trị". `superadmin@misa.com.vn` (Cấp 4) →
  4 tab + FAB, màn Tài khoản có đủ Báo cáo / Quản lý phòng ban / Quản trị người dùng.
- Tìm kiếm từ vị trí mới: gõ "oneai" → còn 2 phim, badge bộ lọc = 1, chip từ khoá hiện đúng.
- Thông báo mở được từ màn Tài khoản (panel full-screen).
- **Medium/Expanded/Large không đổi:** ở 1280px header MDS + sidebar 7 mục + kệ hộp trắng +
  thẻ desktop y hệt trước. Kéo 1280 → 375 đổi view ngay, không cần tải lại trang.

### 6. Ghi chú kỹ thuật
- `vite.config.ts`: thêm `server.proxy` cho `/api` và `/media` trỏ sang `http://localhost:8180`
  (đổi được bằng biến môi trường `DEV_API_TARGET`). **Chỉ ảnh hưởng `npm run dev`**, không
  ảnh hưởng bản build — để lần sau soi giao diện với dữ liệu thật không phải build lại image.
- ⚠️ **Phát hiện lỗi token chưa sửa:** biến `--mds-text-primary` được dùng ở ~20 file nhưng
  **chưa bao giờ được định nghĩa** (`tokens.css` chỉ có `--mds-text`). Mọi
  `color: var(--mds-text-primary)` do đó là tham chiếu không hợp lệ → thừa kế từ `body`, mà
  `style.css` đặt `body { color: var(--mds-text-primary, #1f2937) }` → **toàn app đang dùng
  #1f2937 thay vì #10141B của MDS**. Code MỚI/SỬA ở đợt này đã dùng đúng `--mds-text`. Chưa
  sửa toàn cục vì đó là thay đổi màu chữ trên MỌI màn desktop, nằm ngoài phạm vi "không đổi
  hành vi Medium+" của đợt này.

## Nhật ký GĐ 8 — Giai đoạn A (Mobile-native UI) — 2026-08-07, Opus 5 — ✅ XONG (CHỈ nhánh `phan-quyen-4-cap`)

**Bối cảnh:** GĐ6 đã làm responsive theo window size class + PWA + bottom nav tạm. GĐ8 KHÔNG
làm lại từ đầu mà THAY các trang chính bằng bộ màn hình mobile-first thật — "dựng riêng cho
mobile, cảm giác giống app native", không phải desktop co giãn. Khung lấy từ
`/Users/tuanbui/misa-design-system/ui/templates/mobile/` (`ListPageMobile.vue`,
`DetailPageMobile.vue`, `MMobileTopBar.vue`) rồi sửa theo nghiệp vụ Kho phim.

### Kiến trúc (ADR-058)
- `frontend/src/lib/responsiveView.ts` — `pickView()` (hàm thuần, có test) +
  `lazyResponsiveView()` dựng component resolver. Đặt ở `router/index.ts` cho 2 route
  `films` và `film-detail`: **cùng URL, đổi component theo `isCompact`**, giữ lazy-load nên
  máy tính không tải chunk mobile và ngược lại.
- Chống lệch logic giữa 2 view: tách `features/films/useFilmListFilters.ts` (lọc theo từ
  khoá/chuyên mục/phim mới, phân trang, `rangeText`) — **`FilmListView.vue` desktop đã được
  refactor để dùng chính composable này**, template desktop giữ nguyên 100%.
  `CategoryShelves` dùng chung qua prop `mobile` (logic gom kệ không nhân đôi).

### A1 — Kho phim bản mobile (`FilmListMobileView.vue`, mới)
- Toolbar 2 tầng: "Kho phim" + nút Primary **"Thêm"** (nhãn ngắn viết riêng cho mobile, desktop
  vẫn "Thêm phim"); tầng sau là nút **Bộ lọc** có badge đếm số bộ lọc đang bật + `rangeText`.
- Danh sách phim là **card 1 cột** (`FilmCardMobile.vue`, mới) — giữ ĐỦ trường của bản desktop:
  ảnh bìa, thời lượng, tên phim, nhãn "Phim mới", chuyên mục, hashtag, lượt xem, ngày đăng,
  người đăng. Thao tác gom vào nút **"⋯" luôn hiển thị** (ADR-059).
- **Kệ ngang theo chuyên mục cha giữ nguyên**, cuộn ngang trong đúng container của từng kệ
  (không tràn ngang cả trang); nhãn nút rút gọn "Xem tất cả" → **"Tất cả"**.
- Bộ lọc chuyển thành **bottom sheet** (`MDrawer position="bottom"`, mới thêm — xem dưới):
  cây chuyên mục bằng `MTree` (mở sẵn nhánh cha) + "Tất cả chuyên mục" + `MSwitch` "Chỉ hiển
  thị phim mới" + số phim mỗi trang bằng `MRadioGroup`. Lọc áp dụng ngay khi chọn; footer chỉ
  2 nút "Xoá lọc"/"Xong", mỗi nút nửa hàng, `whitespace-nowrap`.
  ⚠️ Dùng `MRadioGroup` chứ KHÔNG dùng `MSelect` trong sheet: dropdown `MSelect` teleport ra
  body ở `z-[1000]`, nằm DƯỚI panel bottom sheet `z-[1001]` nên sẽ bị che.
- Bộ lọc đang bật hiện thành **chip bấm để bỏ** (từ khoá / chuyên mục / phim mới).
- **Ô tìm kiếm KHÔNG dựng lại**: `MHeaderBar :compact` từ GĐ6 đã đổi ô tìm kiếm toàn cục thành
  icon mở search full-width — đúng `mobile-pwa.md` §3, tái dùng nguyên trạng.

### A2 — Xem phim bản mobile (`FilmDetailMobileView.vue`, mới)
- `MMobileTopBar.vue` (clone khung MDS vào `components/mds/`) — Back + tiêu đề rút gọn + "⋯".
  Bỏ biến thể `mode="home"` của khung gốc vì `MHeaderBar` đã là app shell cấp một.
- **Player full-bleed** hết bề ngang (`VideoPlayer` thêm prop `compact`: bỏ bo góc, hàng chọn
  nguồn thành **chip cuộn ngang** không wrap, nút mở link ngoài/copy nới vùng chạm 48px, khối
  Google Drive/MISA Drive xếp dọc full-width thay vì 2 nút cạnh nhau).
- Thông tin phim xếp DỌC dưới player; số liệu (lượt xem/lượt tải/người đăng/ngày đăng) thành
  danh sách dọc thay vì một hàng ngang 4 số liệu.
- **Hành động chính "Tải xuống" = nút full-width sticky đáy, đứng riêng một hàng** (chỉ khi
  phim có bản lưu trữ nội bộ — cùng điều kiện với desktop). Sửa/Xoá + Copy link nằm trong "⋯".

### A3 — Đăng nhập (`LoginView.vue`, sửa tại chỗ, KHÔNG tạo file mobile riêng)
Đã full-page sẵn nên chỉ bổ sung phần còn thiếu theo checklist skill:
- 🐞 **Bug thật đã sửa:** `MInput` không có `inheritAttrs: false` → `autocomplete="username"`
  rơi vào `div` bọc ngoài, KHÔNG tới `<input>`. Trình quản lý mật khẩu và autofill iOS/Android
  không nhận diện được ô nhập. Nay `v-bind="$attrs"` đặt đúng lên `<input>`.
- 🐞 **Bug thật đã sửa:** nút Đăng nhập vừa `type="submit"` vừa `@click="submit"` → một cú bấm
  gọi `submit()` **hai lần** (2 request đăng nhập). Bỏ `@click`.
- Font nhập liệu 16px trên màn cảm ứng (`MInput` + `MTextarea`, bọc `@media (pointer: coarse)`)
  chống iOS Safari tự phóng to trang khi focus — `mobile-pwa.md` §5.
- Thêm `inputmode="email"`, `autocapitalize="none"`, `autocorrect/spellcheck=off`,
  `enterkeyhint`; đổi `h-full` → `min-h-dvh` + safe-area.

### Sửa thêm ở tầng component MDS (bắt buộc để đạt chuẩn, không phải mở rộng phạm vi)
- `MDrawer.vue`: thêm `position="bottom"` = **bottom sheet** (`mobile-pwa.md` §4.5 yêu cầu bộ
  lọc dùng bottom sheet, bộ MDS chưa có component này). Bo góc trên, cao tối đa `85dvh`,
  chừa safe-area, có `prefers-reduced-motion`. Hai cạnh `left`/`right` giữ nguyên hành vi cũ.
- `MDropdownMenu.vue`: mục menu cao tối thiểu 48px trong `@media (pointer: coarse)` — menu
  teleport ra `body` nên không chỉnh được từ view cha.
- Vùng chạm 48px cho control trong màn mobile xử lý tại chỗ dùng, KHÔNG sửa `MButton` toàn
  cục (ADR-060).

### Kiểm thử trên trình duyệt thật (không chỉ đọc code)
Chạy trên stack Docker thật `http://localhost:8180`, viewport 320x568 / 375x667 / 390x844:
- **320px (khó nhất):** `document.scrollWidth === 320` — **không tràn ngang toàn trang**; rà
  toàn bộ DOM không phần tử nào rộng hơn viewport ngoài các container cuộn ngang có chủ đích.
- **Không nút nào ngắt dòng:** đo bằng `Range.getClientRects()` trên từng text node trong mọi
  `button`/`a` ở cả màn danh sách và màn chi tiết → **0 nhãn xuống 2 dòng**.
- **Touch target:** mọi control MỚI đều ≥48px. Còn lại dưới 48px chỉ là cụm icon của
  `MHeaderBar` (32px) — xem "Để lại cho Giai đoạn B".
- **Không sidebar cố định ở compact**, bottom nav hiển thị đúng theo quyền.
- **Resize Compact ↔ Medium KHÔNG cần reload**: kéo 390 → 700 thấy sidebar + view desktop trở
  lại trên CÙNG URL, kéo ngược lại về đúng view mobile.
- **RBAC không bị phá vỡ** (2 tài khoản khác cấp):
  - `tp1@` (Cấp 3): thấy nút "Thêm"; menu "⋯" trên thẻ phim và trên trang chi tiết có
    **Copy link + Sửa thông tin + Xoá phim**.
  - `xem@` (Cấp 1): **KHÔNG** có nút "Thêm", bottom nav chỉ còn "Kho phim", menu "⋯" chỉ có
    **Copy link** — không có Sửa/Xoá ở cả thẻ phim lẫn trang chi tiết.
- Bottom sheet lọc: chọn chuyên mục cha → `1–6 / 6 phim`, badge "1", chip bỏ lọc hoạt động,
  kệ ngang tự ẩn khi đang lọc (đúng ADR-056).
- Nút "Tải xuống" sticky đáy hiện đúng ở phim có tệp nội bộ, ẩn ở phim chỉ có link ngoài.

### Test
`216 unit BE + 106 tích hợp BE + 82 FE = 404` — tất cả PASS, không test cũ nào gãy.
Mới thêm 13 test FE: `lib/responsiveView.spec.ts` (chọn view theo size class) và
`features/films/useFilmListFilters.spec.ts` (lọc theo tên/hashtag/chuyên mục/phim mới, cộng
dồn bộ lọc, không đột biến mảng gốc, `rangeText` biên).

### Để lại cho Giai đoạn B (KHÔNG làm ở lượt này)
1. **Thêm/Sửa phim dạng wizard** (`FilmUploadView`/`FilmForm`) — form dài nhất app, cần chia
   bước + footer Lưu/Huỷ sticky + xử lý bàn phím ảo che field (`mobile-pwa.md` §4.2).
2. **Popup → bottom sheet**: `FilmManageDialogs`, các `MDialog` xác nhận, `MSettingsDialog`.
3. **Các màn còn lại chưa có bản mobile** (vẫn dùng bản desktop khi ở compact): Phim tôi quản
   lý, Chuyên mục, Quản trị người dùng, Quản lý phòng ban, Báo cáo, Đổi mật khẩu.
4. **Cụm icon `MHeaderBar` còn 32px** (yêu cầu 48px trên màn cảm ứng). Nới thẳng lên 48px sẽ
   làm header tràn ngang ở 320px (9 chấm + logo + tìm kiếm + chuông + "Khác" + avatar) →
   phải thiết kế lại cụm tiện ích compact trước, không phải sửa một dòng CSS.
5. Đổi qua lại mốc 600px làm màn chi tiết fetch lại phim một lần (xem ADR-058, đánh đổi đã
   chấp nhận).

## Nhật ký ĐỢT 2 — 10 việc (2026-08-07, Opus 5) — nhánh `phan-quyen-4-cap`

> Người dùng giao 10 việc theo thứ tự ưu tiên. **9 việc xong trọn vẹn, 1 phần hoãn có chủ
> đích** (multipart-resume video — mục 3 của việc 15). Mọi việc đều đã kiểm trên trình duyệt
> thật với đúng cấp tài khoản tương ứng.

### Việc 11 — Gợi ý hashtag sai (✅)
- `HashtagInput` bỏ prop `suggestions` (vốn nhận `store.films.flatMap(f => f.hashtags)`),
  thay bằng prop `examples` mặc định `['MISA', 'Agentic AI']` — **ví dụ TĨNH**, không lọc theo
  phần đang gõ (ví dụ minh hoạ định dạng thì phải luôn nhìn thấy), chỉ ẩn cái đã chọn rồi.
- **Kiểm:** trình duyệt — form Thêm phim hiện đúng "Gợi ý: #MISA #Agentic AI"; ở phim đã có
  hashtag #MISA thì chỉ còn "#Agentic AI".

### Việc 12 — Gộp text định dạng vào trong khung dropzone (✅)
- `MUpload` thêm prop `formats`, ghép cùng dòng với chú thích dung lượng sẵn có (đúng pattern
  đang dùng, không bịa cách mới). Xoá 2 đoạn văn ngoài khung.
- Khung phim: *"Kéo/thả tệp vào đây hoặc bấm vào đây / MP4/WebM/OGG/MOV/MKV · Dung lượng tối đa
  2048MB"* (trong khung). Khung ảnh bìa: *"Tải ảnh bìa — JPG/PNG/WebP, tỷ lệ 16:9 · Dung lượng
  tối đa 15MB"* (cạnh label). Quy tắc "cần ít nhất một nguồn" rút thành caption cạnh tiêu đề
  khối; "bỏ trống dùng ảnh mặc định" gộp vào ô xem trước ảnh bìa.
- **Kiểm:** trình duyệt — ảnh chụp form Thêm phim, form ngắn hơn 2 đoạn văn.

### Việc 9 — Trùng tên phim: chỉ bản mới nhất giữ nhãn "Phim mới" (✅) — **ADR-052**
- Tính năng MỚI (đã đọc lại: chưa từng có cơ chế nào xử lý trùng tên; luồng "trùng tiêu đề →
  cập nhật bản mới" của GĐ5 là versioning cho CÙNG một phim, khác hẳn).
- Thêm trường tính toán `PublicFilm.isNew` ở backend. **Không thêm cột trạng thái** — lý do và
  các phương án đã loại ở ADR-052. `list()` tốn 0 truy vấn thêm; `getBySlug()` tốn 1 truy vấn
  dựa index `idx_films_title` (migration `AddDownloadCountAndTitleIndex`).
- **Kiểm trên hệ thống thật:** tạo phim `"  PHIM GIỚI THIỆU MISA  "` trùng với
  `"Phim giới thiệu MISA"` (khác hoa/thường + khoảng trắng thừa, cùng ngày đăng) → phim cũ
  `isNew` chuyển `true → false` ngay, phim mới `true`; phim khác tên giữ nguyên nhãn. Xoá phim
  mới → phim cũ **nhận lại nhãn** (đúng thiết kế). Kiểm cả ở danh sách VÀ trang chi tiết.
- 11 test mới (7 unit + 4 e2e).

### Việc 10 — Sửa/Xoá bằng popup thay vì chuyển trang (✅)
- Tách `FilmForm.vue` khỏi `FilmUploadView.vue` (view nay chỉ còn vỏ trang) → dùng lại được ở
  CẢ trang `/upload?edit=` (giữ link cũ) LẪN trong dialog. Prop `embedded` quyết định khác
  biệt duy nhất: lưu xong thì `emit('saved')` thay vì điều hướng, và KHÔNG đăng ký cảnh báo
  rời trang (tránh chồng hai dialog — MDS cấm).
- `FilmManageDialogs.vue` gom popup Sửa + popup xác nhận Xoá, dùng chung cho Kho phim và
  Phim tôi quản lý. Xoá theo đúng `communication.md` §3: tiêu đề *"Xoá vĩnh viễn phim này?"*,
  mô tả nêu hệ quả, nút [Huỷ] [Xoá(danger)].
- **Sửa một lỗi UX tự phát hiện khi kiểm trên trình duyệt:** ban đầu nút Lưu của form nằm lọt
  trong vùng cuộn của dialog còn dialog lại hiện nút "Đóng" mặc định. Đã chuyển Lưu/Huỷ lên
  footer của DIALOG (prop `hideFooter` + `defineExpose`) — đúng quy tắc MDS "form Thêm/Sửa ghim
  Lưu/Hủy ở cuối".
- **Kiểm:** trình duyệt — mở popup Sửa từ thẻ phim, lưu thành công (toast + ngày đăng cập nhật
  trong danh sách nền); mở popup Xoá, xoá thật, danh sách tự tải lại.

### Việc 6 — Màn "Phim tôi quản lý" (✅) — **ADR-057**
- BE: `GET /films?scope=managed` (query param, không tạo route mới vì `/films/managed` sẽ đụng
  `GET /films/:slug`). Phạm vi TRÙNG KHỚP `assertCanManage`.
- FE: `ManagedFilmsView.vue` + route `/my-films` + mục sidebar (icon `list`), Cấp 2 trở lên.
  Có lọc chuyên mục, sắp xếp, và tổng số phim/lượt xem/lượt tải trên đầu.
- **Kiểm trên trình duyệt:** `superadmin@` thấy 8 phim (toàn bộ); `tp1@` thấy đúng 5 phim, tất
  cả do Cấp 2 phòng Truyền thông tạo, không lọt phim phòng khác hay phim của Cấp 4.
- 8 test unit + 5 e2e; trong đó có ca "mọi phim trong danh sách đều THỰC SỰ sửa được" (chứng
  minh danh sách không rộng hơn quyền thật).

### Việc 13 — Filter chuyên mục hiện cả cha và con (✅)
- `MSelect` thêm hỗ trợ `depth` (thụt lề + dấu `└`), áp dụng cho MỌI role. Chuyên mục cha VẪN
  chọn được (không biến thành tiêu đề nhóm chết) — chọn cha = xem cả nhánh.
- Dropdown nay dựng từ CÂY chuyên mục thật, lọc theo `categoryId` + con cháu, thay vì so khớp
  chuỗi `categoryName` như trước (cách cũ còn bỏ sót chuyên mục chưa có phim).
- **Kiểm:** trình duyệt — dropdown hiện `Phim Giới thiệu Sản phẩm KH Doanh nghiệp` rồi
  `└ AMIS OneAI` thụt lề; chọn chuyên mục CHA ra đúng 2 phim vốn nằm trong chuyên mục CON.
- 11 test FE mới cho `categoryOptions` / `categoryIdsWithDescendants` (cây 3 cấp).

### Việc 14 — Kệ ngang theo chuyên mục ở Kho phim (✅) — **ADR-056**
- `CategoryShelves.vue`: mỗi chuyên mục CHA một kệ (gồm phim của các chuyên mục con), tối đa
  12 phim/kệ, có "Xem tất cả". Cuộn ngang nằm TRONG container của kệ, không tràn trang.
- Chỉ hiện khi chưa lọc gì; chọn lọc → về lưới như cũ (lý do ở ADR-056).
- Chỉ học Ý TƯỞNG bố cục; không lấy nội dung/thương hiệu của bên nào.
- **Kiểm:** trình duyệt — 2 kệ ("Phim Giới thiệu công ty" 6 phim, "Phim Giới thiệu Sản phẩm KH
  Doanh nghiệp" 2 phim); bấm "Xem tất cả" → kệ ẩn, lưới lọc đúng chuyên mục.

### Việc 5 — Báo cáo theo phòng ban cho Cấp 3 + Cấp 4 (✅) — **ADR-053**
- BE: `/reports` mở cho `dept_manager`; phạm vi ép cứng theo `department_id` đọc từ DB.
  Thêm lọc chuyên mục (gồm con cháu), khoảng lượt xem, sắp xếp; trả 3 nhóm dữ liệu
  (`totals` / `summary` / `films`). CSV giữ nguyên, thêm cột **Ngày đăng** và **Lượt tải**.
- FE: `ReportsView` dựng lại theo 3 tab. Cấp 3 KHÔNG thấy ô chọn phòng ban; đầu trang ghi rõ
  "Phạm vi: Phòng …".
- **Kiểm trên trình duyệt + API:**
  - `tp1@` → header "Phạm vi: Phòng Truyền thông", 5 phim / 14 lượt xem / 2 nhân viên (khớp
    chính xác dữ liệu phòng 1 trong DB); tab "Theo nhân viên" ra nv1 4 phim/13 xem, nv2 1/1.
  - `tp2@` → "Phạm vi: Phòng Kinh doanh", 0 phim (không thấy gì của phòng Truyền thông); sau
    khi tạo 1 phim thì thấy đúng 1 phim của mình.
  - `tp1@` gửi thẳng `?departmentId=2` → server vẫn trả phòng 1, 5 phim, KHÔNG có phim Kinh doanh.
  - `superadmin@` thấy cả hai phòng; lọc `departmentId` thì chỉ thấy phòng đã chọn.
  - CSV của Trưởng phòng cũng bị giới hạn đúng phạm vi (kiểm bằng e2e).
- 12 test unit + 7 e2e.

### Việc 8 — Nút Tải xuống + đếm lượt tải (✅) — **ADR-054**
- Migration thêm `films.download_count`; `POST /films/:id/download` (không `@Roles` — Cấp 1
  cũng tải được). Không dedupe, không khoá dòng (lý do ở ADR-054).
- FE: nút "Tải xuống" CHỈ hiện khi `film.links.storage`; gọi API đếm song song, không chặn
  việc tải file. Hiện thêm "N lượt tải" cạnh lượt xem. Nạp vào báo cáo việc 5.
- **Kiểm trên trình duyệt:** phim có bản nội bộ → có nút, href `/media/<key>` kèm `download`;
  phim chỉ có YouTube → **không có nút** (đúng yêu cầu tuyệt đối). Bấm 3 lần → `downloadCount`
  = 3 (không bị dedupe), số hiện đúng trên giao diện và trong báo cáo.
- 4 test unit + 4 e2e.

### Việc 15 — Chịu tải nhiều người upload cùng lúc (✅ mục 1, 2, 5 · ⛔ hoãn mục 3)
**Mục 1 — điểm nghẽn thật, đã vá (ADR-055).** Kiểm tra code xác nhận đúng nghi ngờ:
`FileInterceptor('file', …)` không khai `storage` → multer dùng `memoryStorage`, buffer TOÀN
BỘ ảnh trong RAM Node. Đã chọn **hướng (b)**: ảnh bìa chuyển sang presigned PUT thẳng lên
MinIO, **gỡ hẳn endpoint multipart** (giữ lại thì điểm nghẽn vẫn còn). Kiểm ảnh 16:9 + magic
bytes chuyển sang `confirmVersion`, chỉ đọc **64KB đầu** của object — không hạ thấp mức kiểm
tra nào. Đã kiểm: ảnh sai tỷ lệ, file giả mạo ảnh, content-type sai đều bị TỪ CHỐI và object
bị xoá khỏi MinIO (trả 404).

**Mục 2 — video: xác nhận bằng đọc code, KHÔNG giả định.** `createUploadUrl` chỉ validate MIME
+ size rồi gọi `getSignedUrl`; backend không hề chạm byte video nào (FE `putToStorage` PUT
thẳng lên MinIO). Kiến trúc đã đúng, không sửa gì.

**Mục 5 — backtest tải đồng thời thật.** Script mới
`test/concurrency/upload.concurrency.mjs` (`npm run test:concurrency:upload`), 30 request
song song. **Số liệu đo được:**
| Kịch bản | Thành công | p50 | p95 | max |
|---|---|---|---|---|
| Xin presigned URL **video** | 30/30 | 54ms | **84ms** | 85ms |
| Xin presigned URL **ảnh bìa** | 30/30 | 53ms | **81ms** | 82ms |
- Mỗi request nhận một key RIÊNG BIỆT (30 key khác nhau) — không đụng key.
- `/api/health` ngay sau đợt tải: 200 trong **2ms** (không treo).
- **RAM tiến trình backend: 50,7 MiB → 61,0 MiB** (đo bằng `docker stats`). Mức tăng ~10MiB là
  heap JS bình thường, KHÔNG tỷ lệ với kích thước file — đúng như kỳ vọng khi không byte nào
  đi qua Node. Để so sánh: với luồng cũ, 30 người upload ảnh 15MB cùng lúc sẽ là ~450MB nằm
  trong RAM (đây là phép tính từ giới hạn cấu hình, không phải số đo — luồng cũ đã bị gỡ).
- Chạy lại `npm run test:concurrency` (recordView) để chắc không hồi quy: vẫn ĐẠT.

**Mục 3 — multipart-resume cho video: ⛔ CHƯA LÀM TRONG ĐỢT NÀY, nói rõ chứ không im lặng.**
- **Hiện trạng thật cần biết:** presigned `PUT` đơn lẻ **KHÔNG resume được** theo từng byte.
  Mất mạng / đóng trình duyệt / backend restart giữa chừng ⇒ **phải upload lại từ đầu**. Với
  file tới 2GB đây là hạn chế đáng kể trên mạng không ổn định.
- **Vì sao hoãn:** đây là hạng mục lớn (5 endpoint mới, uploader chia phần ở FE, lưu tiến
  trình localStorage, dọn upload dở, CORS phải expose `ETag`, bộ test riêng). Làm vội trong
  cùng đợt với 9 việc trên có rủi ro thật là để lại luồng upload nửa vời — mà upload là đường
  đi của dữ liệu lớn, hỏng ở đây tốn kém hơn nhiều so với việc chờ thêm một đợt.
- **Đề xuất cho đợt sau (đã khảo sát, sẵn sàng làm):**
  1. BE: `POST /films/:id/multipart` (`CreateMultipartUploadCommand` → trả `uploadId` + `key`),
     `POST /films/:id/multipart/:uploadId/part-url` (ký `UploadPartCommand` cho từng
     `partNumber`), `GET /films/:id/multipart/:uploadId/parts` (`ListPartsCommand`),
     `POST …/complete` (`CompleteMultipartUploadCommand`), `DELETE …` (`AbortMultipartUpload`).
     `@aws-sdk/client-s3` đã có sẵn, MinIO tương thích S3 multipart.
  2. FE: chia phần 8–16MB tuỳ kích thước; lưu `{uploadId, key, parts:[{n,ETag}]}` vào
     localStorage theo khoá `userId + tên + size + lastModified` để nhận đúng phiên cũ khi
     người dùng chọn LẠI ĐÚNG file đó; khi khớp thì gọi `ListParts` và chỉ upload phần còn thiếu.
  3. MinIO CORS phải `ExposeHeaders: ["ETag"]`, nếu không FE không đọc được ETag từng phần.
  4. Cần job dọn `AbortIncompleteMultipartUpload` (lifecycle rule) để phần dở không tính dung lượng.
  5. Ảnh bìa (≤15MB) **không cần** multipart — upload lại từ đầu khi lỗi là chấp nhận được.

### Tổng kết test đợt 2
| Bộ | Trước | Sau |
|---|---|---|
| Unit BE (Jest) | 182 | **216** |
| Tích hợp BE (MySQL thật) | 85 | **106** |
| FE (Vitest) | 63 | **69** |
| **Tổng** | **330** | **391** |
- Thêm script `npm run test:concurrency:upload`; script `test:concurrency` cũ vẫn ĐẠT.
- Build BE (`nest build`) và FE (`vue-tsc` + `vite build`) đều sạch.

## Nhật ký ĐỢT 2 SỬA THEO TEST THỰC TẾ (việc 1, 2, 3, 4a, 7) — 2026-08-06 — ✅ XONG (CHỈ nhánh `phan-quyen-4-cap`)

> Người dùng đánh số việc theo thứ tự họ báo; việc 5, 6, 8 để đợt sau. Toàn bộ verify bằng
> browser thật trên `localhost:8180` (Docker build lại từ nhánh này) + curl + truy vấn DB.
> **Chưa port sang `phan-quyen-3-cap`** — người dùng yêu cầu sửa xong bên 4 cấp rồi mới port.

### Việc 1 — Chuyên mục cha/con phân quyền theo tầng ✅ (ADR-051)
- BE: `CategoriesService.assertCanWrite(actor, isRoot)`; controller đổi từ `@Roles('super_admin')`
  sang `@Roles(...FILM_WRITE_ROLES)`; `update`/`remove` nay nhận `actor` và suy tầng từ **bản ghi
  đã lưu**, `create` suy từ DTO.
- FE `CategoryView.vue`: nhãn đổi "Chuyên mục cha" → **"Nằm trong chuyên mục"**; với Cấp 2/3 là
  trường **bắt buộc**, dropdown không có mục gốc, kèm câu giải thích và thông báo riêng khi kho
  chưa có chuyên mục nào để chọn. Chọn trúng chuyên mục gốc thì ẩn Lưu/Xoá + nói rõ lý do.
- **Trả lời câu hỏi "làm thế nào để thêm chuyên mục cha?": KHÔNG phải bug — chỉ là UX chưa rõ.**
  Cấp 4 để trống ô "Nằm trong chuyên mục" là tạo được chuyên mục gốc; trước đây placeholder
  "Không có (chuyên mục gốc)" không nói rõ điều đó. Đã verify: Cấp 4 tạo root qua UI thành công.
- Verify: Cấp 4 tạo root qua UI OK; Cấp 2 tạo root → 403 kèm thông báo chỉ đường sang tạo con;
  Cấp 2 tạo con → 201. Test: 8 unit + 4 e2e.

### Việc 2 — BUG BẢO MẬT: nháp lộ giữa các tài khoản ✅ (ADR-050)
- **Tái hiện đúng nguyên văn trước khi sửa**: build cũ ghi khoá `kho-phim:film-draft:new`
  (không userId) — đọc thẳng từ localStorage của browser trong lúc test.
- Sửa: `features/upload/draftKey.ts` — `buildDraftKey(userId, slug)` +
  `purgeLegacyDrafts(storage)`. Khoá mới `kho-phim:film-draft-v2:<userId>:...`.
- Verify end-to-end trên browser: nv2 lưu nháp → đăng xuất → superadmin vào "Thêm phim" →
  **ô Tên phim rỗng, nháp cũ đã bị dọn** (`draftKeysLeft: []`). Test: 7 unit FE.

### Việc 3 — Layout khung "Tải phim lên" ✅
- `MUpload.vue` thêm 2 prop **opt-in**: `fullWidth` (bỏ `max-w-[420px]`) và `hintInside` (đưa
  "Dung lượng tối đa NMB" vào trong dropzone). Mặc định `false` để giữ nguyên spec MDS
  (`patterns/popup-form.md` §Đính kèm: dropzone ~280×60px) và **không đụng dropzone ảnh bìa**.
- `FilmUploadView.vue` bật cả hai cho dropzone video → khung kéo dài thẳng mép trái (cột Link
  YouTube) tới mép phải (cột Link Vimeo).

### Việc 4a — Cho dùng NHIỀU nguồn cùng lúc + đổi ưu tiên phát ✅
- **Backend đã hỗ trợ sẵn** (mỗi nguồn là 1 dòng `film_links`, `storage` lấy từ
  `film_versions.storage_key`) — chỉ giao diện mô tả sai. Verify: phim id 24 cùng lúc có
  storage + youtube + gdrive, API trả đủ 3 trong `links`.
- Sửa chữ hướng dẫn: bỏ "Chọn 1 trong 2 cách", nay là "Dùng được cùng lúc nhiều nguồn…".
- `VideoPlayer.vue`: `preferredOrder` đổi `['storage','youtube',…]` →
  **`['youtube','vimeo','storage','gdrive','misadrive']`**. Cơ chế "thiếu thì next" đã có sẵn
  qua `orderedSources` (lọc theo thứ tự này), không phải thêm gì.
- Verify browser: phim 3 nguồn hiện "Xem từ: **YouTube**(đang chọn) | Nội bộ | Google Drive" —
  YouTube là mặc định. gdrive/misadrive **giữ nguyên** hành vi chỉ mở/tải ngoài, không nhúng.

### Việc 7 — KẾT LUẬN: KHÔNG phải bug, hệ thống chạy ĐÚNG ✅
- **Dữ liệu demo cũng đúng** (loại trừ giả thuyết `department_id` NULL):
  `SELECT id,uploader_id,department_id FROM films` → phim 19/20/22/25 của nv1/nv2 đều có
  `department_id = 1`, khớp phòng ban của `tp1@`.
- **Backend đúng** (curl): `tp1@` PATCH phim 19 của nv1 → **HTTP 200**; `tp2@` (phòng khác)
  PATCH cùng phim → **403** đúng thông báo. Tạo phim mới bằng nv1 rồi `tp1@` DELETE → **204**,
  bản ghi biến mất khỏi DB.
- **Frontend đúng** (browser thật): đăng nhập `tp1@`, mở phim của nv1 → **có đủ nút Sửa và
  Xoá**; bấm Sửa mở được form; bấm Lưu thay đổi → lưu thành công và tự quay về trang chi tiết.
  `/api/films/:slug` trả đủ `departmentId` + `uploaderRoleCode`; `/auth/me` và `/auth/refresh`
  đều trả `departmentId: 1` nên `canManageFilm` tính đúng.
- **Cái gây hiểu nhầm:** phim 19 (nhiều khả năng là phim người dùng thử) **không có nguồn phát
  nào**. Bấm "Lưu thay đổi" trên phim đó luôn bị chặn bởi validate *"Cần ít nhất một nguồn"* —
  toast hiện ở cuối trang, rất dễ bỏ sót nếu đang nhìn phần đầu form → trông như "nút chết".
  Đây là hiện tượng cùng họ với ghi chú "chưa chọn Chuyên mục" ở đợt trước.
- **Không sửa code cho việc 7** (đúng nguyên tắc: không "sửa" thứ đang chạy đúng). Muốn tự
  kiểm chứng: đăng nhập nv1 tạo phim MỚI **có ít nhất 1 link**, rồi đăng nhập `tp1@` sửa/xoá.

## Nhật ký ĐỢT SỬA 5 VẤN ĐỀ TỪ TEST THỰC TẾ CỦA NGƯỜI DÙNG — 2026-08-06 — ✅ XONG (áp dụng CẢ 2 NHÁNH)

> Người dùng tự test bản 3 cấp trên Docker `localhost:8180` và báo 5 vấn đề. Cả 5 đều là
> bug/UX **chung**, không liên quan khác biệt RBAC → đã áp dụng y hệt lên cả
> `phan-quyen-3-cap` và `phan-quyen-4-cap`. ADR mới: **ADR-048** (hashtag), **ADR-049** (YouTube).

| # | Vấn đề người dùng báo | Kết luận | Đã làm |
|---|---|---|---|
| 1 | Sidebar "Chuyên mục" hiện với Cấp 1 (viewer) | Bug thật | Ẩn menu + chặn route |
| 2 | Chữ kỹ thuật "(MinIO)/storage" trong form Thêm phim | Đúng, khó hiểu | Viết lại bằng lời nghiệp vụ |
| 3 | Hashtag không thêm được | Bug thật + đổi yêu cầu | Thiết kế lại control (ADR-048) |
| 4 | Nút upload "đang không chạy" | **KHÔNG phải bug** | Đã tái hiện thật — chạy đúng |
| 5 | Video YouTube "Error 153" | **Bug thật** (không phải dữ liệu demo) | Sửa `referrerpolicy` (ADR-049) |

**1. Ẩn "Chuyên mục" với Cấp 1.** `App.vue`: mục sidebar `categories` thêm `roles:
FILM_WRITE_ROLES`. `router/index.ts`: route `/categories` thêm `meta.roles` — ẩn menu KHÔNG đủ,
phải chặn cả gõ thẳng URL. *Verify:* đăng nhập `xem@misa.com.vn` → sidebar chỉ còn đúng "Kho
phim"; gõ `/categories` → bị đẩy về `/films`.

**2. Bỏ chữ kỹ thuật.** `FilmUploadView.vue`: "Tải phim lên storage nội bộ (MinIO)" → **"Tải phim
lên"**; bỏ câu "File được lưu trực tiếp lên storage… (tua/seek)" → "Chọn 1 trong 2 cách: tải
thẳng tệp phim lên…, hoặc dán link…"; ảnh bìa bỏ "được lưu lên storage" → "Bỏ trống thì hệ thống
tự dùng ảnh mặc định theo chuyên mục". Rà thêm toàn FE: `storageUpload.ts` có 2 thông báo lỗi
**hiện thẳng lên toast** lộ "storage"/"MinIO"/"CORS" → viết lại (giữ mã lỗi để hỗ trợ kỹ thuật
tra). Các toast còn lại trong app đã thuần tiếng Việt nghiệp vụ, không phải sửa.

**3. Thiết kế lại nhập hashtag — xem ADR-048.** Nguyên nhân gốc: `MCombobox allow-create` emit
`create` nhưng màn Thêm phim **không lắng nghe** → Enter không làm gì. Không vá, mà dựng
`HashtagInput.vue` (MInput + chip MTag) + `hashtags.ts::parseHashtags` (+9 test).
*Verify thật:* gõ đúng chuỗi người dùng mô tả `"MISA, Agentic AI"` → ra **đúng 2 chip**
`#MISA` và `#Agentic AI` (khoảng trắng trong "Agentic AI" giữ nguyên, KHÔNG bị tách). Xuất bản
xong kiểm DB: `film_hashtags` của phim mới có đúng 2 dòng `MISA`, `Agentic AI`.

**4. Nút upload — KHÔNG phải bug, đã tái hiện thật.** Không "sửa" gì cho mục này. Bằng chứng:
- Bấm dropzone → click được chuyển đúng tới `<input type=file>` ẩn (đo bằng listener thật) →
  hộp chọn file của HĐH mở bình thường. `MUpload.vue` bọc input trong `<label>` + gọi
  `inputRef.click()`, cả hai đường đều hoạt động.
- Chọn 1 tệp mp4 → hiện đúng "phim-test-060826.mp4 · 64 KB" kèm dấu tích xanh.
- Bấm "Xuất bản" khi đã đủ trường → tạo phim thành công, chuyển sang màn Chi tiết, phát được
  bằng player nội bộ. Tệp lấy về từ storage trả **HTTP 206** (range request) ⇒ tua/seek chạy.
- **Điều dễ bị hiểu nhầm là "nút chết":** nếu **chưa chọn Chuyên mục** thì bấm "Xuất bản" sẽ
  KHÔNG gửi request — đúng thiết kế. App có báo đỏ "Vui lòng chọn chuyên mục" và
  `useFormValidation.focusField()` tự focus + cuộn về trường lỗi. Console sạch, không có request
  nào lỗi/treo. ⇒ Kết luận: thao tác thiếu bước, không phải lỗi code.

**5. YouTube Error 153 — LÀ BUG THẬT, không phải dữ liệu demo giả.** Giả thuyết ban đầu (link
giả / chủ video chặn nhúng) đã bị **thực nghiệm bác bỏ** — xem ADR-049 để biết cách chứng minh
A/B. Nguyên nhân: `Referrer-Policy: no-referrer` của nginx làm iframe không gửi Referer, YouTube
từ chối khởi tạo player với MỌI video. Sửa: thêm `referrerpolicy="strict-origin-when-cross-origin"`
vào 2 iframe YouTube/Vimeo trong `VideoPlayer.vue` (không nới header chung).
*Verify:* trước khi sửa phim "Phim Giới thiệu Tập đoàn MISA - Full 6 phút" hiện Error 153; sau
khi sửa + rebuild, **video MISA thật phát bình thường** trong app.

**Test sau đợt này (nhánh 4 cấp): 174 unit BE + 82 e2e BE + 52 FE = 308** (trước: 299; +9 test
`hashtags.spec.ts`). Build BE + FE sạch.

## Nhật ký RBAC 4 CẤP CÓ SCOPE PHÒNG BAN (việc phát sinh, ngoài roadmap) — 2026-08-05 — ✅ XONG

> Yêu cầu gốc: thiết kế lại phân quyền thành **4 cấp**, trong đó Cấp 3 (Trưởng phòng) quản được phim
> của Cấp 2 **cùng phòng ban**. Quyết định chi tiết + lý do ở **ADR-040 → ADR-044**; file này chỉ ghi
> đã làm gì và verify ra sao.

### Tên vai trò cuối cùng (ADR-040)
`viewer` (Cấp 1) · `employee` (Cấp 2) · `dept_manager` (Cấp 3) · `super_admin` (Cấp 4).
Vai trò **`admin` cũ bị loại bỏ hoàn toàn**, dữ liệu migrate sang Cấp 4 (ADR-041).

### LỖ HỔNG THẬT đã bịt (quan trọng nhất của đợt này)
Trước đợt này **KHÔNG có `@Roles` nào** trên `POST /films`, `POST /films/:id/upload-url`,
`POST /films/:id/thumbnail`, `POST /films/:id/versions` → **mọi tài khoản đã đăng nhập đều tạo được
phim**, kể cả vai trò thấp nhất. Nay cả 7 route GHI của `/films` (gồm cả `PATCH`/`DELETE`) đều gắn
`@Roles(...FILM_WRITE_ROLES)`; Cấp 1 bị chặn ngay ở guard. Đã verify bằng 8 ca e2e + probe API thật.

### Backend
- **Migration mới** `1722000000000-AddDepartmentsAndRbac4Levels.ts` (idempotent, `hasColumn`/`hasTable`):
  tạo bảng `departments`; thêm `users.department_id`, `films.department_id` (+ index
  `IDX_films_department`), `categories.created_by` + `categories.department_id` — tất cả FK nullable
  `ON DELETE SET NULL`; migrate vai trò cũ→mới; đồng bộ `roles` về đúng 4 dòng; backfill
  `films.department_id` từ phòng ban của uploader. Hàm `migrateLegacyRoles()` + `LEGACY_ROLE_MAP` được
  **export** để test tích hợp gọi lại được trên MySQL thật.
- **`role.entity.ts` là nguồn sự thật duy nhất**: `RoleCode`, `ROLE_LEVEL`, `ROLE_NAME`,
  `ALL_ROLE_CODES`, `FILM_WRITE_ROLES`, `isAtLeastLevel`. `seed.service.ts` đọc từ đây (không khai lại).
- **`FilmsService.assertCanManage` viết lại** thành async 4 nhánh; đọc phòng ban actor + vai trò
  uploader **từ DB** qua `UsersService` (ADR-043), không tin JWT, không tin `departmentId` từ client.
  `create()` snapshot `department_id` từ DB của người tạo.
- **Module `departments` mới** (entity/service/controller, `@Roles('super_admin')` toàn bộ): CRUD tối
  thiểu, **chặn xoá bằng 409 nếu còn user/phim/chuyên mục tham chiếu** (cố ý không dựa vào
  `ON DELETE SET NULL` — xoá âm thầm sẽ làm phim mất ngữ cảnh phòng ban và Cấp 3 lặng lẽ mất quyền).
  Trùng tên chặn bằng unique index ở DB rồi dịch lỗi sang 409 (không đọc-rồi-ghi).
- **`PATCH /users/:id` MỚI** (`UpdateUserDto`): đổi vai trò + phòng ban. **Bắt buộc phải có** vì Cấp 1
  và Cấp 3 là hai cấp mới, không tài khoản nào tự động chuyển sang khi migrate. `departmentId: null` =
  bỏ gán, thiếu trường = không đổi. Ghi `auditLog('user.update')` kèm giá trị trước/sau.
- **Thu quyền về Cấp 4** cho `/users`, `/reports`, `/departments`, ghi `/categories` (ADR-044).
- `auditLog` thêm 4 action: `user.update`, `department.create/update/delete`.

### Frontend (theo skill `misa-design-system`, bản `/Users/tuanbui/misa-design-system`)
- **`features/auth/permissions.ts` MỚI** — nguồn sự thật FE: `ROLE_LABEL`/`ROLE_HINT`/`ROLE_COLOR`,
  `FILM_WRITE_ROLES`, `ADMIN_ROLES`, `canCreateFilm`, `isSystemAdmin`, `canManageFilm` (bản sao logic
  `assertCanManage`, CHỈ để ẩn/hiện nút). Gom vào 1 chỗ vì cùng quy tắc dùng ở 5+ màn.
- **Màn "Quản lý phòng ban" MỚI** (`features/departments/`): clone bố cục danh sách chuẩn MDS — nền
  xám, bảng trong card trắng `--mds-shadow-card` + radius 8, tiêu đề trái / nút Primary ngoài cùng
  phải, ô tìm kiếm trái toolbar, action dòng hiện khi hover (đúng 2 icon, dưới hạn 3 của
  `data-table.md` §4), `MDataTable`/`MDialog`/`MInput`/`MTag` — không HTML thô.
- `UserAdminView`: thêm cột **Phòng ban**, `MSelect` phòng ban ở form tạo, **dialog "Sửa vai trò và
  phòng ban"** mới, gợi ý quyền theo vai trò đang chọn, cảnh báo mềm khi Cấp 2/3 chưa có phòng ban.
  Option "Chưa gán" dùng value `0` (KHÔNG dùng `undefined` — `undefined` là "chưa chọn" theo quy ước
  dự án, dùng lẫn sẽ không phân biệt được với "chọn có chủ đích là không thuộc phòng ban nào").
- `App.vue`: thêm mục sidebar **"Quản lý phòng ban"** (icon Tabler `building` đã đăng ký, không tự vẽ
  SVG) chỉ hiện Cấp 4; "Thêm phim" chỉ từ Cấp 2; nhãn vai trò mới.
- `router`: route `/admin/departments`; `/upload` giới hạn `FILM_WRITE_ROLES`; các route admin về Cấp 4.
- `FilmListView` ẩn nút "Thêm phim" với Cấp 1; `FilmDetailView` dùng `canManageFilm` dùng chung.
- `CategoryView`: ẩn nút ghi với cấp không phải Cấp 4 (trước đây hiện cho mọi vai trò rồi để backend
  trả 403 — nay ẩn hẳn cho khớp ADR-044).
- `filmsApi.ApiFilm` thêm `departmentId` + `uploaderRoleCode` (`toPublic` lấy từ relation `uploader`
  đã load sẵn — không thêm truy vấn nào) để FE quyết định ẩn/hiện nút cho Cấp 3.

### Kiểm thử & verify
- **BE unit 174/174 pass** (từ 129): viết lại toàn bộ `films.service.spec` cho 4 cấp × tổ hợp phòng
  ban (gồm ca `null` không trùng `null`, ca Cấp 3 bị chuyển phòng mất quyền ngay), `users.service.spec`
  cho ma trận mới, `departments.service.spec` MỚI, `roles.guard.spec` cập nhật.
- **BE tích hợp 82/82 pass trên MySQL thật** (từ 46): thêm nhóm "Migration RBAC 4 cấp" (kiểm bảng
  `roles` đúng 4 dòng, các cột mới tồn tại & nullable, **chèn tài khoản `admin` cũ rồi chạy
  `migrateLegacyRoles()` thật → thành `super_admin`, chạy lại lần 2 vẫn đúng**), nhóm "CẤP 1" (8 ca),
  nhóm "Scope phòng ban" (17 ca), nhóm phòng ban/sửa tài khoản.
- **FE 43/43 pass** (từ 26) — thêm `permissions.spec.ts` phủ đủ 4 cấp.
- `backend npm run build` + `frontend npm run build` (`vue-tsc`) sạch.
- **Migration chạy thật trên DB dev đang có** (`docker compose up -d --build`): `roles` còn đúng 4
  dòng (`admin` đã biến mất), tài khoản seed `super_admin` giữ nguyên, phim seed giữ nguyên với
  `department_id = NULL` (đúng giới hạn đã ghi ở ADR-042), bảng `departments` + 4 cột mới tồn tại.
- **Probe API thật 27 ca bằng curl với 6 tài khoản** — khớp 100% kỳ vọng. Trích các ca cốt lõi trên
  cùng 1 phim của Cấp 2 phòng Truyền thông: Cấp 1 → 403 · Cấp 2 khác **cùng phòng** → 403 · chính chủ
  → 200 · Cấp 3 **cùng phòng** → 200 · Cấp 3 **phòng khác** → 403 · Cấp 4 → 200. Cấp 3 sửa phim của
  Cấp 4 → 403. Cấp 1 gọi upload-url/versions/thumbnail/DELETE → 403 cả 4.
- **Browser test thật (Docker, localhost:8180) với đủ 4 cấp:** Cấp 1 → sidebar chỉ Kho phim + Chuyên
  mục, không có nút "Thêm phim", màn chi tiết không có Sửa/Xoá · Cấp 2 → có "Thêm phim", **KHÔNG** có
  Sửa/Xoá trên phim của đồng nghiệp cùng phòng · Cấp 3 → **CÓ** Sửa/Xoá trên phim của Cấp 2 cùng
  phòng · Cấp 4 → thấy đủ 3 mục quản trị, màn Quản lý phòng ban render đúng MDS, tạo phòng ban OK
  (toast + số người dùng thật), **xoá phòng ban đang có 3 người dùng bị chặn 409** với thông điệp
  backend hiện nguyên văn, dialog "Sửa vai trò và phòng ban" nâng Cấp 1 → Cấp 3 + gán phòng ban lưu
  thành công. Dropdown vai trò **chỉ có 3 lựa chọn** (không có "Quản trị cao nhất").

### Dữ liệu demo còn lại trên DB dev (để người dùng tự kiểm)
- 3 phòng ban: Phòng Truyền thông, Phòng Kinh doanh, Phòng Hành chính.
- 6 tài khoản (mật khẩu 4 tài khoản test: `Test@2026x`): `superadmin@misa.com.vn` (Cấp 4, seed) ·
  `xem@` (Cấp 1) · `nv1@`, `nv2@` (Cấp 2, phòng Truyền thông) · `tp1@` (Cấp 3, phòng Truyền thông) ·
  `tp2@` (Cấp 3, phòng Kinh doanh).
- 3 phim: 1 phim seed cũ + 2 phim demo của Cấp 2 phòng Truyền thông. Phim rác sinh ra lúc probe đã dọn.

## Nhật ký GĐ 7 — BỔ SUNG "đạt chuẩn misa-backend-standard" — 2026-07-29 — ✅ XONG

> Người dùng đọc báo cáo GĐ7 đợt đầu và yêu cầu: các thiếu sót đã tự nêu phải được xử lý cho
> ĐẠT chuẩn, không dừng ở mức ghi nhận. Đợt này phân loại lại toàn bộ thiếu sót thành
> **nhóm A (lệch chuẩn — phải sửa)** và **nhóm B (đúng chuẩn khi để treo, có trích dẫn điều
> khoản cho phép)**, rồi làm hết nhóm A.

### Nhóm A — đã sửa
1. **Kiểm thử đồng thời cho `recordView`** (nguyên tắc 4 + `07-testing-strategy` §1 yêu cầu
   tường minh). Viết `backend/test/concurrency/record-view.concurrency.mjs`, 3 kịch bản × 20
   request song song. **→ PHÁT HIỆN RACE CONDITION THẬT**: 1 người dùng mới gửi 20 request
   song song làm `view_count` tăng **4 thay vì 1** (check-then-act: nhiều request cùng vượt
   qua bước kiểm trùng trước khi ai kịp ghi). Sửa bằng giao dịch + khoá dòng
   `pessimistic_write` (ADR-036) đúng cách `05-database-rules` §3 quy định. Đo lại: **+1 ✅**.
   Script cố ý **tôn trọng rate limit thật** (giãn nhịp đăng nhập) thay vì nới lỏng ngưỡng cho
   test chạy nhanh — nới ngưỡng vì test bất tiện là đánh đổi bảo mật lấy tiện lợi.
2. **Kiểm thử tích hợp trên DB thật** (`07-testing-strategy` §1). Thêm `test/jest-e2e.json`,
   `test/env-e2e.ts`, `test/global-setup.ts`, `test/app.e2e-spec.ts` — **46 test** chạy trên
   MySQL thật, route thật, guard thật, database riêng `kho_phim_e2e` dựng lại sạch mỗi lần
   (ADR-039). Phủ theo rủi ro: xác thực, SSO, RBAC, quyền sở hữu/IDOR, validate đầu vào, đếm
   lượt xem, CSV, endpoint công khai, và **rate limit với guard thật**.
   **→ PHÁT HIỆN LỖI THẬT THỨ HAI**: kết nối MySQL không khai báo múi giờ nên dùng múi giờ
   cục bộ của tiến trình Node; trong Docker cả hai đều UTC nên trùng, nhưng chạy từ máy dev
   VN (+07) thì cửa sổ dedupe lệch 7 tiếng → tính trùng lượt xem. Sửa bằng `timezone: 'Z'`
   (ADR-037), đúng `05-database-rules` §5.
3. **CI** (`13-devops-lifecycle` §1 — "cổng chặn bắt buộc, không phải bước tham khảo").
   `.github/workflows/ci.yml`, 4 job: backend build+unit, backend e2e (kèm service MySQL 8.0),
   frontend build+test, audit. Cổng chặn audit đặt ở phạm vi production, ngưỡng critical, có
   giải thích và TODO hạ xuống `high` sau khi nâng NestJS 11 (ADR-038).
4. **`npm audit` chạy thật** (`02-security-baseline` §6). Kết quả: BE **19 CVE phạm vi
   production** (10 moderate, 9 high, **0 critical**), 50 nếu tính cả devDependency; FE **0
   CVE phạm vi production** (8 CVE đều là devDependency build-time của `vite-plugin-pwa`).
   Đã chạy `npm audit fix` (KHÔNG `--force`): **không có bản vá an toàn nào áp dụng được** —
   100% còn lại đòi nâng major. Không nâng major giữa đợt hardening (vi phạm §6.4 + nguyên
   tắc 2); đã ghi khuyến nghị nhánh riêng `chore/upgrade-nestjs-11`.

### Nhóm B — giữ treo, có căn cứ (chi tiết + khuyến nghị hành động ở `docs/danh-gia-an-ninh.md` Phụ lục A)
- **Audit log chống sửa đổi (R-06)**: baseline §7 yêu cầu nhật ký không bị chính đối tượng bị
  điều tra xoá. **Ở tầng ứng dụng đã đạt** (không có API/lệnh/bảng nào sửa-xoá được bản ghi đã
  ghi). Phần còn lại thuộc hạ tầng gom log — làm bảng `audit_logs` trong chính DB của app còn
  **kém an toàn hơn** vì tài khoản app có quyền ghi bảng đó nên cũng xoá được. Đã chuyển thành
  **điều kiện nghiệm thu 3 mục** trong checklist go-live thay vì để lửng lơ.
- **Test component UI**: `07-testing-strategy` §6 cho phép xác minh thủ công có chủ đích khi
  tự động hoá khó, miễn nói rõ giới hạn — đã nói rõ.
- **9 rủi ro kiến trúc còn lại** (R-01..R-11): `11-phase-refactor-legacy` §3/§5 quy định phải
  BÁO CÁO thay vì tự sửa hàng loạt. Mỗi rủi ro nay có thêm **khuyến nghị hành động cụ thể**
  (R-09 có hẳn phương án presigned GET 5 bước kèm ảnh hưởng tới FE).

### Verify đợt bổ sung
- `npm run build` BE sạch · `npm test` **129/129** · `npm run test:e2e` **46/46** ·
  FE `npm test` **26/26** + build sạch → **tổng 201 test tự động**.
- `npm run test:concurrency` **3/3 kịch bản ĐẠT** sau khi sửa (trước: 1 kịch bản LỖI).
- CI: YAML parse hợp lệ (4 job), `npm ci --dry-run` OK cả BE/FE, lệnh audit gate exit 0,
  đã mô phỏng job e2e bằng đúng biến `E2E_*` mà CI truyền → 46/46 pass. **KHÔNG push** nên
  chưa trigger CI thật trên GitHub.
- Docker rebuild + browser test lại: danh sách phim, dữ liệu cũ đọc đúng sau khi ép UTC,
  readiness `database: ok`, **0 lỗi console**.

---

## Nhật ký GĐ 7 (Hardening & Handoff) — 2026-07-29 — ✅ XONG
- **Chuẩn áp dụng**: skill `misa-backend-standard`. Đánh giá an ninh bám đúng khung 9 mục
  của `references/02-security-baseline.md`; kiểm thử theo `07-testing-strategy.md`; cách
  tiếp cận mã nguồn cũ theo `11-phase-refactor-legacy.md`; vận hành theo `09-operations-
  reliability.md`. Kết quả đánh giá: `docs/danh-gia-an-ninh.md`.

### A. Đã sửa (12 vấn đề)
1. **[CAO] JWT secret mặc định `change-me`** — trước GĐ7, `jwt-auth.guard.ts` và
   `auth.service.ts` fallback `process.env.JWT_SECRET || 'change-me'`; giá trị này nằm
   công khai trong repo nên ai đọc mã nguồn cũng tự ký được token `super_admin`. Nay gom
   về `common/config/security.config.ts`; `assertSecureConfig()` chạy đầu `bootstrap()`
   và CHẶN KHỞI ĐỘNG nếu secret trống/mặc định/<32 ký tự, access trùng refresh, MinIO còn
   `minioadmin`, endpoint còn `localhost`, mật khẩu seed còn mẫu, SSO secret yếu.
   **BẪY KỸ THUẬT đã xử lý**: Dockerfile backend pin sẵn `NODE_ENV=production` và
   docker-compose dev cũng đặt `NODE_ENV: production` → KHÔNG thể dùng `NODE_ENV` làm cổng
   chặn (làm vậy là stack dev không khởi động nổi). Cổng thật là biến `ALLOW_INSECURE_CONFIG`
   (đặt `true` trong `.env.example` cho dev; XOÁ ở production — việc số 1 của DevOps).
2. **[CAO] Chưa có rate limit đăng nhập** — thêm `@nestjs/throttler`; `AuthController` bọc
   `ThrottlerGuard`: login 10/phút/IP, refresh 30, SSO 10, đổi mật khẩu 10. CỐ Ý không
   đăng ký guard toàn cục (route `/media/:key` sinh rất nhiều request Range khi tua video,
   giới hạn toàn cục sẽ làm gãy trình phát).
3. **[CAO] Thuật toán ký JWT không được ép cứng** — phát hiện khi đối chiếu baseline §1.
   Thêm `JWT_ALGORITHM='HS256'` truyền vào cả `sign` lẫn `verify`. Có test chặn token khai
   `alg:none` và token ký HS512.
4. **[TB] CSV Injection** — tên phim do người dùng nhập, đặt tên `=cmd|'/c calc'!A1` thì
   Excel coi ô đó là công thức khi quản trị viên mở báo cáo. Ô bắt đầu bằng `= + - @ Tab CR`
   nay được thêm nháy đơn dẫn đầu. **Đã test end-to-end thật** (tạo phim tên độc hại → xuất
   CSV → xác nhận bị vô hiệu hoá → xoá phim).
5. **[TB] Presigned PUT không ràng buộc dung lượng** — client xin URL cho 1MB vẫn PUT được
   50GB. `confirmVersion` nay kiểm size THẬT từ MinIO, vượt hạn thì từ chối + xoá object rác.
6. **[TB] SSO AMIS Mobile** — secret <32 ký tự nay bị coi như TẮT (501, thà tắt còn hơn bật
   với secret yếu); thêm trần TTL `AMIS_SSO_MAX_TTL_SECONDS=300` giới hạn cửa sổ replay.
   *Đã kiểm và xác nhận ĐÚNG sẵn*: `timingSafeEqual` có so độ dài trước, và chữ ký được xác
   minh TRƯỚC khi parse JSON.
7. **[TB] Thiếu security header** — `helmet` (BE) + nosniff/Referrer-Policy/Permissions-
   Policy/`server_tokens off` (nginx). `Referrer-Policy: no-referrer` đặc biệt quan trọng
   vì URL scaffold GĐ6.1 có thể chứa `?ssoToken=`.
8. **[TB] CORS phản chiếu mọi origin** — nay production mặc định không phản chiếu, mở qua
   `CORS_ORIGINS`; dev giữ nguyên để không gãy Vite.
9. **[THẤP] Dò tài khoản qua thời gian phản hồi** — email không tồn tại nay vẫn chạy một
   lần `bcrypt.compare` giả (đo thật: 78ms, tương đương nhánh email có thật).
10. **[Baseline §7] Chưa có nhật ký kiểm toán** — thêm `common/audit/audit-log.ts`, ghi 10
    loại sự kiện nhạy cảm (đăng nhập thành/bại kèm lý do, đổi mật khẩu, SSO, tạo/khoá/xoá
    tài khoản, xoá phim, xuất CSV). Tự che trường khớp `pass|secret|token|key|hash|...`.
11. **[Baseline §5/§6] Dockerfile supply-chain** — `npm install` → `npm ci` + copy
    `package-lock.json` tường minh; backend thêm `--ignore-scripts`. **Frontend CỐ Ý KHÔNG
    dùng `--ignore-scripts`**: devDependency `sharp` cần postinstall tải binary, bỏ script
    là gãy build (đã kiểm chứng).
12. **[Baseline §9] Vận hành** — tách `/api/health` (liveness, KHÔNG chạm DB) và
    `/api/health/ready` (readiness, `SELECT 1`, trả 503 khi DB chết); bật
    `app.enableShutdownHooks()` cho tắt có kiểm soát.

### B. Còn treo (11 rủi ro) — chi tiết + lý do ở `docs/danh-gia-an-ninh.md`
R-09 `/media/:key` công khai chỉ dựa UUID (Cao, cần đổi presigned GET ở prod) · R-01 token ở
`localStorage` · R-02 không thu hồi được refresh token khi đổi mật khẩu · R-03 SSO chưa có
nonce chống replay · R-04 object mồ côi trên storage · R-05 `npm audit` còn cảnh báo
(`multer@1.x`) · R-06 audit log ghi stdout, chưa chống sửa đổi · R-07 chưa chốt
`X-Frame-Options` (chờ cách nhúng AMIS Mobile) · R-08 rate limit đếm trong bộ nhớ tiến trình
· R-10 chưa phân trang `/films` `/users` · R-11 response không theo khuôn `{data}`/`{error}`.
Tất cả đều thuộc loại đổi kiến trúc / phá vỡ hợp đồng API / cần quyết định nghiệp vụ —
đúng loại việc mà `11-phase-refactor-legacy §5` yêu cầu BÁO CÁO thay vì tự sửa.

### C. Kiểm thử — từ 0 lên 152 test
- **BE (mới hoàn toàn)**: cài `jest` + `ts-jest` + `@nestjs/testing` + `supertest`,
  `jest.config.js`, thêm `tsconfig.build.json` để spec không lọt vào `dist`.
  **126 test / 8 file**: `security.config.spec.ts` (16 — chốt chặn cấu hình),
  `jwt-auth.guard.spec.ts` (11 — gồm alg:none, HS512, refresh dùng thay access),
  `roles.guard.spec.ts` (7), `auth.service.spec.ts` (24 — login/refresh/SSO),
  `users.service.spec.ts` (21 — ma trận quản trị), `films.service.spec.ts` (17 — owner
  policy/IDOR + validate upload), `reports.service.spec.ts` (13 — CSV injection),
  `audit-log.spec.ts` (17 — gồm che dữ liệu nhạy cảm).
- **FE (mới hoàn toàn)**: `vitest` + `jsdom` + `vitest.config.ts` tách khỏi `vite.config.ts`.
  **26 test / 2 file**: `filmTypes.spec.ts` (14), `amisBridge.spec.ts` (12 — quan trọng
  nhất: mặc định KHÔNG coi là nhúng, ưu tiên native hơn query param).
- Ưu tiên theo rủi ro đúng `07-testing-strategy §1` + `11-phase-refactor-legacy §7`: phủ
  guard/RBAC/auth/SSO/cấu hình/CSV, **cố ý KHÔNG** phủ CRUD đơn giản không có logic.
- **CHƯA có**: integration test chạy DB thật, load/concurrency test, test component UI.
  Xem mục "Giới hạn" ở `06-activeContext.md`.

### D. Tài liệu tạo mới (thư mục `docs/`, trước GĐ7 rỗng)
- `docs/danh-gia-an-ninh.md` — đánh giá an ninh theo đúng khung 9 mục của baseline MISA,
  mỗi hạng mục có trạng thái + bằng chứng `file:dòng` + mức rủi ro + đã sửa hay còn treo.
- `docs/api-overview.md` — 25 endpoint theo module, ai gọi được.
- `docs/quy-trinh-noi-bo.md` — hướng dẫn người dùng cuối/vận hành (tiếng Việt, không kỹ thuật).
- `docs/devops-handoff.md` — checklist đưa lên hạ tầng MISA: gỡ `ALLOW_INSECURE_CONFIG`,
  bảng biến môi trường, `MINIO_PUBLIC_ENDPOINT`, đổi storage, **cắm OIDC AMIS (chỉ rõ seam)**,
  **checklist hoàn thiện GĐ6.1**, migration/backup/rollback, checklist go-live.
- Swagger `/api/docs` — tự sinh từ code, TẮT mặc định ở production (ADR-031).

### E. Verify thực tế (nguyên tắc 4 của skill — không kết luận bằng đọc code)
1. `cd backend && npm run build` sạch · `npm test` → **126/126 pass** · 0 file spec lọt `dist`.
2. `cd frontend && npm run build` sạch · `npm test` → **26/26 pass**.
3. `docker compose up -d --build` → 5 container chạy. Log backend in đúng 6 cảnh báo
   "[CHẶN Ở MÔI TRƯỜNG THẬT]" + dòng giải thích đang ở chế độ nới lỏng.
4. `/api/health` → 200 · `/api/health/ready` → 200 `{"database":"ok"}`.
5. Header thật qua nginx: nosniff + Referrer-Policy + Permissions-Policy có mặt,
   `Server: nginx` (đã ẩn phiên bản), không còn `X-Powered-By`.
   **BẪY**: nginx mount config read-only nên phải `docker compose restart nginx` mới nạp
   config mới — lần kiểm đầu tưởng header thiếu, thực ra là container chưa nạp lại.
6. **Rate limit test thật** (không chỉ đọc code): gọi `/auth/login` 14 lần liên tiếp →
   9 lần đầu 401, từ lần 10 trở đi **429** đúng ngưỡng.
7. **Swagger**: mặc định `/api/docs` → **404** (không lộ ở production). Bật tạm
   `ENABLE_API_DOCS=true` → 200, render đủ **25 path**, khớp `docs/api-overview.md`.
   Đã khôi phục về mặc định sau khi kiểm.
8. **JWT**: header token thật giải mã ra `{"alg":"HS256","typ":"JWT"}`.
9. **Trình duyệt thật** (1280x720): đăng xuất → đăng nhập lại bằng form thật
   `superadmin@misa.com.vn` → vào Kho phim → mở chi tiết phim (lượt xem tăng 2→3, chứng tỏ
   `recordView` vẫn chạy) → vào Báo cáo quản trị. **0 lỗi console.**
10. **CSV injection end-to-end**: tạo phim tên `=cmd|'/c calc'!A1` → xuất CSV → ô ra
    `"'=cmd|'/c calc'!A1"` (đã ép text), BOM `efbbbf` còn nguyên → xoá phim test.
    Audit log ghi đúng `report.export ... rows=2` và `film.delete ... target=8`.
11. **DB sau khi test**: đã dọn sạch phim test, còn đúng 1 phim như trước khi bắt đầu.

## Nhật ký GĐ 6.1 (AMIS Mobile Embed Readiness — scaffold, chờ DevOps) — 2026-07-27
- **Bối cảnh**: phát sinh mới ngoài roadmap gốc — người dùng muốn Kho phim sau này nhúng
  trong app khung "AMIS Mobile" (super-app nhân viên MISA) qua WebView + bridge JS, không
  phải app riêng cài từ CH Play/App Store. CHƯA có spec bridge chính thức từ đội AMIS
  Mobile → toàn bộ việc dưới đây là **scaffold/placeholder**, code sẽ chuyển DevOps tinh
  chỉnh lại theo hạ tầng MISA thật, KHÔNG dùng được ngay.
- **BE**: `POST /auth/sso/amis-mobile` trong `modules/auth/` (KHÔNG sửa login/refresh/me
  hiện có). Xác minh tạm bằng HMAC-SHA256 trên payload JSON `{email, exp}`, secret đọc từ
  env `AMIS_SSO_SHARED_SECRET` (rỗng = TẮT, trả 501 "Chưa cấu hình SSO AMIS Mobile" — không
  throw 500). Map email → user MISA hiện có (`findByEmailWithHash`), không tìm thấy → 401
  tiếng Việt. Tái dùng `issueTokens`/`AuthService` để cấp JWT y hệt luồng login thường —
  tận dụng seam có sẵn "Seam để GĐ7 thay bằng OIDC AMIS" ở đầu `auth.service.ts`. Thêm
  `AMIS_SSO_SHARED_SECRET` vào `.env.example` (rỗng) + `docker-compose.yml` (passthrough,
  mặc định rỗng).
- **FE**: `frontend/src/lib/amisBridge.ts` mới — `isEmbedded()` (đọc `?embedded=1` 1 lần,
  cache module-level), `getBridgeToken()` (ưu tiên `window.AMISBridge?.getToken?.()`,
  fallback query param `?ssoToken=...` — CẢNH BÁO lộ token trong URL, chỉ tạm cho scaffold),
  `registerBackHandler`/`notifyBackPressed` (expose `window.__khoPhimHandleNativeBack` cho
  nút back cứng app mẹ). `App.vue`: thêm `isEmbeddedMode` — ẩn `MHeaderBar`+sidebar/bottom-
  nav khi nhúng, chỉ render `router-view` full màn hình; thêm màn "Đang xác thực..." trong
  lúc thử SSO bridge. `authStore.ts`: thêm `loginViaBridge()` + tích hợp vào `restore()` —
  nếu embedded và có bridge token thì thử SSO trước, thất bại thì rơi về LoginView thường
  (không khoá chết người dùng); router guard hiện có tự động đợi đúng vì đã await
  `auth.restore()` trước khi quyết định redirect.
- **Verify đã làm**:
  1. `cd backend && npm run build` — sạch (Nest build, không lỗi TS).
  2. `cd frontend && npm run build` — sạch (`vue-tsc -b && vite build`, PWA build OK).
  3. `docker compose up -d --build backend frontend` rồi `curl -X POST
     http://localhost:8180/api/auth/sso/amis-mobile -d '{"token":"abc.def"}'` (chưa set
     secret) → **501** `{"message":"Chưa cấu hình SSO AMIS Mobile", ...}` — không phải 500.
  4. Round-trip thật: dựng container test riêng (`khophim-backend-test`, KHÔNG phải
     container chính) với `AMIS_SSO_SHARED_SECRET=test-secret-round-trip`, ký payload cùng
     secret bằng Node script, gọi endpoint → **200** kèm `accessToken`/`refreshToken`/`user`
     hợp lệ (super_admin). Xoá container test ngay sau, khởi động lại `khophim-backend`
     THẬT không có secret nào — xác nhận lại vẫn 501. `.env`/`.env.example`/
     `docker-compose.yml` trong repo KHÔNG có secret thật nào được set sẵn.
  5. Browser (sau khi unregister service worker cũ để tránh cache PWA stale — lưu ý cho
     lần sau: đổi code FE mà test qua nginx production build phải xoá SW/cache cũ trước):
     - Mặc định (không query param): giống hệt trước GĐ6.1 — header/sidebar/bottom-nav bình
       thường, 0 lỗi console.
     - `?embedded=1` (đã đăng nhập từ trước): ẩn đúng header/sidebar/bottom-nav, chỉ còn nội
       dung route full màn hình, 0 lỗi console.
     - `?embedded=1` + `localStorage.clear()` (chưa đăng nhập, chưa có bridge thật nên không
       có `ssoToken`): rơi về LoginView bình thường nhưng vẫn full-screen (không header/
       sidebar) — đúng như thiết kế fallback, 0 lỗi console.
- **Danh sách placeholder/giả định tạm — DevOps PHẢI xác nhận lại với đội AMIS Mobile trước
  khi dùng thật** (đã ghi TODO trong code):
  1. Cơ chế báo "đang nhúng" = query param `?embedded=1` — có thể AMIS Mobile dùng cách khác
     (User-Agent riêng, custom scheme...).
  2. Cơ chế truyền token = `window.AMISBridge?.getToken?.()` (object native giả định, tên
     hàm CHƯA xác nhận) hoặc fallback query param `?ssoToken=...` — **query param có RỦI RO
     LỘ TOKEN trong URL/lịch sử trình duyệt/log server**, không dùng nguyên trạng production.
  3. Cơ chế xác minh chữ ký BE = HMAC-SHA256 shared-secret tạm, KHÔNG phải OIDC/JWKS thật.
  4. Endpoint `/auth/sso/amis-mobile` mới chỉ test với secret tạm tự ký, CHƯA test với bridge
     thật/token thật từ đội AMIS Mobile.
  5. Tên hàm `window.AMISBridge?.closeWebview?.()` (điểm đóng WebView khi back ở màn gốc) và
     `window.__khoPhimHandleNativeBack` (app mẹ gọi khi back cứng) là tên GIẢ ĐỊNH, chưa xác
     nhận với đội AMIS Mobile.
- Xem ADR-029/030 (05-decisions.md) cho lý do quyết định chi tiết.

## Nhật ký GĐ 6 (PWA & Mobile & MDS polish) — 2026-07-24
- **PWA**: cài `vite-plugin-pwa` + `sharp` (chỉ devDependency, dùng để render icon lúc
  build, không đưa vào bundle chạy). `frontend/scripts/generate-pwa-icons.mjs` sinh
  4 icon PNG (`public/icons/app-192.png`, `app-512.png`, `app-maskable-512.png`,
  `apple-touch-icon.png`) từ 1 SVG vẽ tay (nền brand `#245FDF` + glyph "device-tv" style
  Tabler stroke 1.5) — chạy lại bằng `node scripts/generate-pwa-icons.mjs` khi cần đổi icon.
  `vite.config.ts`: `VitePWA({ registerType: 'prompt', ... })` — **CHỌN 'prompt' KHÔNG
  phải 'autoUpdate'** để không tự activate/reload khi form đang có nội dung chưa lưu
  (ADR-027). Manifest tối thiểu đúng mobile-pwa.md (name/short_name/theme_color
  `#245fdf`/background `#ffffff`/3 icon). Workbox: precache app shell; `runtimeCaching`
  NetworkFirst cho `/api/*` (timeout 8s, cache 1h); `/media/*` (video) `NetworkOnly` —
  KHÔNG cache video/dữ liệu nhạy cảm. `index.html` thêm `viewport-fit=cover`,
  `apple-touch-icon`, các meta `apple-mobile-web-app-*`.
- **Trạng thái PWA trong App.vue**: `src/lib/useNetworkStatus.ts` (theo dõi
  `navigator.onLine` + sự kiện online/offline), `src/lib/usePwaUpdate.ts` (bọc
  `virtual:pwa-register/vue` — `needRefresh`/`offlineReady`/`updateServiceWorker`).
  Component mới `src/components/mds/MGlobalInline.vue` ("Global Inline Notification"
  theo `communication.md` mục 2.5 — dải banner trên cùng, TRÊN header) hiển thị 3
  trạng thái: mất mạng (warning, nút "Thử lại"), có phiên bản mới (info, nút "Cập nhật"
  → `updateServiceWorker(true)`), sẵn sàng dùng ngoại tuyến (success, đóng được) — đã
  verify cả 3 bằng browser thật (mô phỏng offline qua dispatch event, offline-ready bắn
  tự nhiên ngay lần load đầu sau khi SW cài xong).
- **Window size class**: `src/lib/windowSize.ts` — composable dùng chung
  (Compact&lt;600/Medium 600-839/Expanded 840-1199/Large&gt;=1200 theo `window.innerWidth`,
  1 listener resize dùng chung qua reference-count). `App.vue`, `MHeaderBar.vue`,
  `NotificationsPanel.vue` đều dùng composable này — **đổi layout khi resize KHÔNG cần
  reload** (đã verify: kéo resize 1280→768→320 và ngược lại, panel/toolbar tự đổi ngay).
- **App.vue (Compact &lt;600px)**: **bỏ hẳn `MSidebar` cố định**, thay bằng
  **bottom navigation** (`<nav class="fixed inset-x-0 bottom-0">`, `env(safe-area-inset-bottom)`,
  5 mục `sidebarItems` hiện có vừa đúng giới hạn ≤5 của mobile-pwa.md — xem ADR-028 lý
  do chọn bottom-nav thay vì drawer). `main` có `padding-bottom` chừa chỗ cho bottom nav.
  Root layout đổi `h-full`→`100dvh` (giữ `min-height`+`height` cùng lúc để Safari cũ vẫn
  có fallback). Banner (`MGlobalInline`) + `MHeaderBar` đặt trong 1 wrapper đo chiều cao
  thật qua `ResizeObserver` (`topBarHeight`) — popover menu người dùng + `NotificationsPanel`
  dùng giá trị này làm `top` thay vì hardcode `top-[52px]` cũ (banner hiện/ẩn động sẽ đẩy
  header xuống, không được hardcode nữa).
- **MHeaderBar.vue**: thêm prop `compact` (mặc định `false` — **không đổi gì ở
  Medium/Expanded/Large**, giao diện desktop giữ nguyên 100%). Khi `compact=true`: ô tìm
  kiếm inline ẩn, thay bằng icon "Tìm kiếm" mở **overlay full-width** (input tự focus,
  nút Back đóng) đè lên toàn header; Thiết lập/AVA/Chat/Hỗ trợ gộp vào popover "More"
  (trước đó These bị `hidden md:grid` nên vô hình ở mobile — giờ hiện đúng vị trí, chỉ
  còn Thông báo + avatar trực tiếp ngoài More theo đúng mobile-pwa.md §3).
- **NotificationsPanel.vue**: thêm prop `topOffset` (thay hardcode) và `fullScreen`
  (App.vue truyền `isCompact`) — Compact: panel full-screen có top bar Back; Medium+:
  giữ nguyên popover góc trên phải như cũ.
- **FilmListView/FilmDetailView**: đã là card grid responsive + toolbar flex-wrap từ
  GĐ0.5/2 nên **không cần viết lại** — chỉ rà và xác nhận qua browser thật ở 320/375/768/
  1024/1280 không tràn ngang, touch target đủ dùng, không có bảng ngang chật cần chuyển
  card (đã là card sẵn).
- **FilmUploadView.vue**: footer sticky Lưu/Hủy thêm `padding-bottom: max(12px,
  env(safe-area-inset-bottom))` (trước đó không chừa safe-area, có thể bị thanh cử chỉ
  iOS/Android che một phần) — không đổi các quy tắc nháp/cảnh báo thoát trang đã có.
- **CSS toàn cục** (`style.css`) — áp dụng CHUNG thay vì sửa từng file: (1) `@media
  (pointer: coarse)`: icon-button `h-8 w-8` (32px, gần như toàn bộ nút icon trong app
  dùng đúng 2 class Tailwind liền kề này) được mở rộng vùng chạm ảo lên 48×48px bằng
  `::after{inset:-8px}` — **không phóng to icon/nút thật**, giữ nguyên UI đã duyệt; input/
  select/textarea `font-size:16px !important` (chặn iOS Safari tự zoom khi focus — cần
  `!important` vì class Tailwind `text-[13px]` có specificity cao hơn selector element
  thường). (2) `body{overflow-x:hidden}` chặn tràn ngang toàn trang. (3)
  `prefers-reduced-motion: reduce` tắt animation. **Hạn chế đã biết**: công cụ browser
  test dùng trong phiên này resize viewport nhưng KHÔNG giả lập `pointer: coarse` (luôn
  báo `fine`/`maxTouchPoints:0`) — đã xác nhận rule tồn tại đúng trong CSS biên dịch
  (`document.styleSheets`) nhưng KHÔNG tự bấm-thử được bằng ngón tay thật trên thiết bị
  touch thật trong phiên này; cần verify thêm trên điện thoại/tablet thật hoặc DevTools
  device toolbar (giả lập touch đầy đủ) trước khi coi 48px touch target là 100% chắc chắn.
- **Không tự động thu gọn Sidebar ở Medium/Expanded**: mobile-pwa.md gợi ý Medium dùng
  rail/drawer, nhưng `MSidebar` đã có sẵn nút thu gọn thủ công (200px⇄64px, từ GĐ0) và
  card grid đã tự co giãn cột — **quyết định KHÔNG** tự động ép rail theo breakpoint để
  tránh xung đột với lựa chọn thủ công của người dùng đã có từ trước; ghi nhận là điểm
  đơn giản hoá có chủ đích (xem ADR-028).
- **CategoryView/UserAdminView/ReportsView**: đã rà ở 320px — `MDataTable`/`MTree` đã tự
  có `overflow-auto` container riêng nên KHÔNG tràn ngang toàn trang; **chưa chuyển
  table→card** cho 2 trang admin (UserAdminView/ReportsView) vì đây là màn hình quản trị
  ít dùng trên di động, bảng đã cuộn ngang gọn trong khung riêng — ghi nhận là điểm cố ý
  bỏ qua theo đúng tinh thần "không được tự ý bỏ qua mà không nói": nếu cần dùng nhiều
  trên mobile, GĐ7 có thể bổ sung.
- **LoginView/ChangePasswordView**: đã vừa khung 320×568 không cần cuộn thêm gì, input
  vốn đã `autocomplete`/`type` đúng từ GĐ1; áp dụng chung rule font-size 16px coarse-pointer
  ở style.css nên không cần sửa riêng.
- **VideoPlayer.vue**: giữ nguyên (ADR-008 — native `<video controls>`/iframe official
  đã tự xử lý fullscreen + safe-area qua trình duyệt, không cần thêm CSS).
- **Build & verify**: `npm run build` (vue-tsc + vite build) sạch, PWA sinh
  `dist/sw.js`+`dist/workbox-*.js`+`dist/manifest.webmanifest` hợp lệ. Verify browser
  thật (Claude_Browser, KHÔNG chỉ đọc code) qua Docker (`docker compose up -d --build`,
  cổng 8180) — đăng nhập `superadmin@misa.com.vn`, tự bấm/resize qua 320×568, 375×667,
  768×1024, 1024×768, 1280×800: xác nhận không sidebar cố định ở compact, bottom nav
  5 mục hoạt động, search overlay + More popover hoạt động, NotificationsPanel
  full-screen↔popover đổi đúng theo size class không reload, banner offline/offline-ready
  hiện đúng vị trí không đè header, không trang nào tràn ngang (`scrollWidth===innerWidth`
  đo trực tiếp qua JS ở nhiều trang), form Thêm phim sticky footer không bị cắt.
  **Chưa verify được**: dev server FE riêng `npm run dev -- --port 5180` không có proxy
  `/api` (thiếu từ trước GĐ6, không phải lỗi phát sinh ở GĐ6) nên không đăng nhập được
  qua cổng 5180 trong phiên này — đã chuyển toàn bộ verify sang cổng 8180 (Docker nginx,
  build production, cùng chất lượng kiểm thử); test thiết bị iOS/Android thật (Safari/
  Chrome, Add to Home Screen, push permission, back-gesture) chưa thực hiện được vì môi
  trường phiên này chỉ có browser desktop resize — cần verify thêm trên thiết bị thật.

## Nhật ký GĐ 5 (Nghiệp vụ nâng cao) — 2026-07-21
- Versioning/tag "Phim mới"/hashtag/search theo tên-hashtag-chuyên mục: đã có sẵn từ
  GĐ2-4, verify lại — search FE (`searchState.ts` + `FilmListView.vue`) đã lọc cả
  `title` lẫn `hashtags` (dòng `inTags`), KHÔNG cần sửa thêm.
- BE module `notifications` mới: bảng `notifications`(id, film_id, type, created_at) +
  `user_notifications`(id, user_id, notification_id, is_read, created_at) — migration
  `AddNotifications`. `NotificationsService.notify()` tạo 1 notification rồi fan-out
  cho mọi user `isActive` TRỪ actor. Gọi từ `FilmsService`: `create()` → `new_film`;
  `update()` (sửa metadata, đã tự reset `publishedAt`/tag "mới" từ GĐ2) → `updated`;
  `confirmVersion()` chỉ khi `versionNo > 1` (upload lại file cho phim đã có, tránh
  thông báo trùng với `new_film` của lần xuất bản đầu) → `updated`. Endpoint
  `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`,
  `PATCH /notifications/read-all` — ai đăng nhập cũng gọi được (chỉ thấy thông báo của mình).
- FE: `notificationsStore.ts` (Pinia) poll `unread-count` mỗi 30s khi đã đăng nhập +
  load danh sách khi mở panel lần đầu. `NotificationsPanel.vue` — popover tự dựng
  (KHÔNG phải MDialog, theo hướng dẫn skill misa-design-system) góc trên phải dưới
  chuông `MHeaderBar`, giống pattern popover menu người dùng đã có ở `App.vue`. Bấm
  1 thông báo → đánh dấu đã đọc + điều hướng `/films/:slug`. Nút "Đánh dấu tất cả đã đọc".
- BE module `reports` mới: `GET /reports/films?uploaderId=&from=&to=&format=csv` —
  `@Roles('super_admin','admin')`. Trả `{ summary: [{uploaderId, uploaderName, count}],
  films: [...] }` lọc theo `films.created_at` (ngày UPLOAD, khác `published_at` có thể
  bị đẩy lại khi sửa/cập nhật bản mới). `format=csv` → cùng endpoint, trả CSV UTF-8 BOM
  (`﻿`) + header tiếng Việt (Content-Disposition attachment).
- FE trang mới `/admin/reports` (`ReportsView.vue`) — chỉ `super_admin`/`admin` (route
  `meta.roles`, sidebar `App.vue` ẩn/hiện theo role giống "Quản trị người dùng"). Bộ lọc
  `MSelect` (người upload, tái dùng `GET /users`) + `MDateRangePicker` (khoảng ngày) +
  bảng `MDataTable` + nút "Xuất CSV" (`MButton` primary) tải file qua `fetch` kèm Bearer
  token → blob → thẻ `<a download>` tạm (không dùng `apiFetch` vì nó luôn parse JSON).
- Review Gate: `docker compose up -d --build` chạy sạch (BE log đủ 6 module + migration
  `AddNotifications` tự chạy). Browser: super_admin xuất bản 1 phim mới → nhân viên khác
  (tài khoản tạo test qua API) thấy badge chuông tăng lên 1, mở panel đúng nội dung
  "Phim mới: <tên phim>" + "X phút trước", bấm vào → điều hướng đúng `/films/:slug` +
  badge về 0. `/admin/reports` với super_admin hiển thị đúng thống kê + bảng chi tiết;
  nhân viên vào `/admin/reports` bị router guard đẩy về `/films`, sidebar không hiện
  "Báo cáo"/"Quản trị người dùng". Xuất CSV qua `curl` xác nhận byte đầu `EF BB BF`
  (BOM) + nội dung tiếng Việt đúng (không lỗi font). Console chỉ có 2 lỗi
  `AbortError: play() interrupted` từ YouTube iframe player (GĐ4, không liên quan thay
  đổi GĐ5) — không có lỗi mới phát sinh từ code GĐ5.
- Dữ liệu test (phim, chuyên mục, tài khoản nhân viên tạo để verify) đã xoá qua API
  sau khi verify xong.

## Nhật ký GĐ 4 (Player & Link ngoài & View) — 2026-07-21
- BE: bảng `film_views` (id, film_id, user_id?, session_hash, viewed_at) — migration
  `AddFilmViews` (FK film_id→films CASCADE, user_id→users SET NULL, index film_id+user_id).
  Đăng ký entity/migration tường minh trong `db-options.ts` (đúng pattern GĐ3).
- BE: `POST /api/films/:id/view` — bất kỳ ai đã đăng nhập gọi được (không cần role đặc
  biệt, chỉ cần qua `JwtAuthGuard` toàn cục sẵn có). `FilmsService.recordView`: dedupe theo
  `user_id` trong cửa sổ 30' (query `MoreThan(now-30')`) → nếu trùng thì bỏ qua (không ghi
  thêm dòng, không update lại `viewed_at` — chấp nhận đơn giản theo scope); ngược lại insert
  `film_views` mới + `films.increment({id}, 'viewCount', 1)` (atomic, không đọc-rồi-ghi —
  tránh race khi nhiều tab/nhiều request cùng lúc).
- `session_hash`: sinh ở BE = `sha256(ip + '|' + user-agent)`, cột dự phòng — KHÔNG dùng
  trong logic dedupe hiện tại (mọi người dùng đều đã đăng nhập nên `user_id` là đủ). Xem ADR-023.
- FE: `filmsApi.recordView(id)` gọi `POST /films/:id/view`; `FilmDetailView.onMounted` gọi
  1 lần sau khi `getBySlug` thành công (biến `viewedSlug` nhớ đã gọi cho slug nào, tránh gọi
  lại khi component chỉ re-render); cập nhật `film.viewCount` từ response ngay (không cần F5).
- Rà soát VideoPlayer.vue/FilmDetailView.vue (player đa nguồn, nút link/copy theo nguồn,
  fullscreen/volume qua `<video controls>` gốc): **không phát hiện bug thật** — giữ nguyên,
  đúng ADR-008 đã chốt từ GĐ0.5.
- Verify: `docker compose up -d --build` (5 container Up/healthy). Backend `tsc --noEmit` +
  FE `vue-tsc --noEmit` sạch trước khi build Docker. Trình duyệt: login super_admin → mở
  phim có sẵn (view_count 0→1) → F5 lại nhiều lần cùng phim → **vẫn 1** (dedupe đúng, xác
  nhận cả qua SQL `SELECT view_count, COUNT(film_views)` khớp 1/1). Tạo phim test riêng qua
  API, gọi `POST /:id/view` 3 lần liên tiếp → chỉ tăng lần đầu (1,1,1), xoá phim test xong.
  0 lỗi console. `docker compose down` (không `-v`) sau verify.

## Nhật ký GĐ 3 (Storage & Thumbnail, MinIO thật) — 2026-07-21
- [GĐ 3] Backend `StorageModule`: `StorageService` bọc MinIO qua `@aws-sdk/client-s3` (2 client:
  internal minio:9000 + presigner localhost:9200), `MediaController` GET/HEAD `/media/:key`
  (@Public, ngoài prefix /api) stream Range 206. Deps mới: `@aws-sdk/client-s3`,
  `@aws-sdk/s3-request-presigner`, `image-size`, `multer` (+@types) — DONE.
- [GĐ 3] Data model: entity + migration `AddFilmVersions` (bảng `film_versions`, FK film CASCADE
  + created_by SET NULL). `films` không đụng dữ liệu cũ; `toPublic` lấy version mới nhất →
  `links.storage`/`thumbnailUrl`/duration. Migration chạy sạch trên volume GĐ2 cũ (không phá) — DONE.
- [GĐ 3] Endpoint (trong FilmsModule, tái dùng `assertCanManage`): POST `/films/:id/upload-url`
  (presigned PUT, validate MIME+size), POST `/films/:id/thumbnail` (multipart, validate 16:9 +
  magic bytes), POST `/films/:id/versions` (head-check key trên MinIO, lấy size thật, tạo version,
  kế thừa asset chưa thay) — DONE. storage_key/thumbnail_key sinh server-side (uuid).
- [GĐ 3] FE: `filmsApi` +createUploadUrl/uploadThumbnail(FormData)/confirmVersion; `http.ts` bỏ
  ép Content-Type khi body là FormData; `storageUpload.ts` (XHR PUT có progress + readVideoDuration
  có timeout ADR-022). `FilmUploadView` luồng upload THẬT (chọn file → xin URL → PUT MinIO có
  progress → thumbnail → confirmVersion), xoá hết ghi chú "chưa lưu". `VideoPlayer` dùng
  `<video src="/media/:key">` thật; `FilmListView` hiện thumbnail thật (fallback gradient) — DONE.
  Build BE (nest) + FE (vue-tsc) đều sạch.
- [GĐ 3] Quyết định: ADR-019 (film_versions + trỏ bản mới nhất), ADR-020 (aws-sdk S3, key
  server-side, 2 client), ADR-021 (Range 206 proxy + /media ngoài prefix, public-by-uuid),
  ADR-022 (readVideoDuration timeout). ADR-018 hết hiệu lực.
- [GĐ 3] **Verify thật `docker compose up -d --build`** (5 container Up/healthy, migration
  `AddFilmVersions` chạy, bucket `kho-phim` tự tạo). **API (curl, file thật ffmpeg)**: presigned
  PUT → MinIO 200; thumbnail 16:9 OK, ảnh 600×600 → 400 "phải tỷ lệ 16:9"; confirmVersion gắn
  storage+thumbnail+duration; GET /media full 200 + Range `bytes=0-99`→206 `0-99/113422`,
  `bytes=1000-`→206 đúng, HEAD 200, key sai→404; RBAC: nhân viên xin upload-url/thumbnail/
  confirmVersion trên phim người khác→**403**, phim mình→201; oversized/bad-type→400; no-token→401.
  **Trình duyệt (Chrome tự động)**: login super→Kho phim hiện thumbnail thật + tag "Nội bộ"; tạo
  phim mới, set file qua DataTransfer → app tự chạy `onSelectVideo`; **presigned PUT từ trình
  duyệt → MinIO 200** (CORS preflight OPTIONS trả Access-Control-Allow-Origin đúng); thumbnail
  multipart OK; confirmVersion OK → điều hướng trang chi tiết (player `<video src=/media>` mount,
  nút Tải về bật, tag Phim mới); **fetch /media trong trình duyệt: 200 full + 206 Range
  `bytes 0-999/113422` đúng số byte, canPlayType H.264 "probably"**; F5/điều hướng lại vẫn còn
  phim+ảnh (persist DB+MinIO, không phải blob URL). 0 lỗi console của app (2 AbortError là do
  chính script test gọi play() rồi điều hướng, không phải app).
  - **Quirk môi trường (không phải bug):** `<video>` trong Chrome tự động không tự decode/hiển
    thị metadata (readyState 0) dù fetch 206 hoạt động và canPlayType "probably" → seek/play thật
    kiểm bằng fetch Range thay vì phát hình. Trình duyệt người dùng thật sẽ phát+tua bình thường.
  - **Bẫy gặp khi verify:** (1) publish treo do readVideoDuration không timeout → đã fix (ADR-022);
    (2) MSelect "Chuyên mục" khó mở bằng click tự động (đã biết từ GĐ2) → chọn bằng cách gọi
    click() trên phần tử option thật qua JS (tương đương click người dùng). Sau verify đã xoá
    sạch dữ liệu test qua API (0 phim/chuyên mục, chỉ còn seed super_admin), `docker compose down`
    (KHÔNG -v, giữ volume). Object MinIO test còn sót là vô hại (prototype).

## Nhật ký sau GĐ 2 — 2026-07-21
- [Fix UI] Cây chuyên mục khi rỗng (0 chuyên mục) trước đây hiện khung trắng trơn (chủ đầu tư
  hỏi lại tưởng là lỗi) — đã thêm empty state "Chưa có chuyên mục nào. Bấm 'Thêm chuyên mục'
  để tạo mới." trong `CategoryView.vue`, verify lại trên browser sau khi rebuild Docker — DONE.

## Nhật ký GĐ 2 (Chuyên mục & Phim core) — 2026-07-21
- [GĐ 2] Backend `CategoriesModule`: entity Category (cây cha-con qua `parent_id` self-FK
  CASCADE), CRUD `/api/categories` (GET công khai cho user đăng nhập, POST/PATCH/DELETE
  `@Roles('super_admin','admin')`), slug tự sinh + unique-suffix, cây dựng từ danh sách phẳng — DONE.
- [GĐ 2] Backend `FilmsModule`: entity Film + FilmLink (youtube/vimeo/gdrive/misadrive) +
  Hashtag + join table `film_hashtags`; CRUD `/api/films` (list/getBySlug/create/update/delete);
  `FilmsService.assertCanManage` = OwnerGuard thật (super/admin bất kỳ, nhân viên chỉ phim
  mình) — DONE. Migration `InitCatalog` (5 bảng, FK cascade/set-null đúng theo kiến trúc).
- [GĐ 2] FE: `filmTypes.ts`/`filmsApi.ts`/`filmsStore.ts` (Pinia, refetch toàn bộ sau mutation),
  `categoriesApi.ts` — thay hoàn toàn `mockFilms.ts`/`mockCategories.ts` (đã xoá 2 file).
  `CategoryView`, `FilmListView`, `FilmDetailView` (+ nút Xoá giờ có handler thật + dialog xác
  nhận), `FilmUploadView` nối API thật, giữ nguyên UI đã duyệt — DONE. Build BE+FE sạch.
- [GĐ 2] Quyết định đáng chú ý (ADR-015→018): slug tự sinh ở BE; hashtag/link là bảng riêng
  theo đúng kiến trúc GĐ0 (không JSON column); màu tag/gradient chuyên mục đổi sang suy ra từ
  `categoryId` (ổn định hơn cách cũ theo vị trí danh sách); **storage/thumbnail thật CHƯA làm**
  — form vẫn có MUpload nhưng chỉ xem trước phiên làm việc, có ghi chú rõ cho người dùng
  (trung thực, không giả vờ đã lưu — đúng nguyên tắc skill MDS).
- [GĐ 2] **Verify thật `docker compose down -v && up -d --build`** (fresh volume): 2 migration
  chạy đủ (`InitAuth`+`InitCatalog`, kiểm bằng `SHOW TABLES`). Test qua curl: tạo chuyên mục
  cha-con, xoá cha→con cascade xoá, xoá chuyên mục có phim→phim chỉ mất categoryId (SET NULL,
  không mất phim); tạo/sửa/xoá phim; nhân viên sửa/xoá phim người khác→403, sửa/xoá phim mình→OK,
  admin xoá phim nhân viên→OK. Verify trình duyệt: tạo 3 chuyên mục (kể cả cây cha-con hiển thị
  đúng thụt lề), tạo phim với YouTube link → xuất bản → hiển thị đúng trong Kho phim (gradient
  theo chuyên mục, tag "Phim mới", copy link); login nhân viên khác xem phim của super_admin →
  ĐÚNG như thiết kế không thấy nút Sửa/Xoá; double-check API trực tiếp cũng chặn 403. 0 lỗi
  console. Đã `docker compose down -v && up -d` lại để trả về DB sạch trước khi bàn giao.
  **Lưu ý test:** 1 lần thao tác chọn "Chuyên mục cha" tưởng là bug (không cập nhật) hoá ra do
  tool click nhầm toạ độ (screenshot-space không khớp) — dùng `read_page`+ref để click chính
  xác thay vì đoán toạ độ từ ảnh chụp.

## Nhật ký GĐ 1 (Auth & RBAC) — 2026-07-21
- [GĐ 1] Backend: `UsersModule` (entity User+Role, `password_hash` select:false), `AuthModule`
  (login/refresh/me/change-password, JWT access 15'+refresh 7d), RBAC toàn cục
  (`JwtAuthGuard`→`RolesGuard`, `@Public`/`@Roles`/`@CurrentUser`), CRUD `/api/users` với
  kiểm quyền ở service (`assertCanManage`, `creatableRoles`) — DONE. Deps mới: `@nestjs/jwt`, `bcryptjs`.
- [GĐ 1] DB: migration `InitAuth` (users+roles, utf8mb4) tự chạy khi khởi động (`migrationsRun`);
  seed roles + super_admin idempotent từ `.env` (`SEED_SUPER_ADMIN_*`) — DONE.
- [GĐ 1] FE: Pinia `authStore` (token localStorage, restore/refresh/logout), `http.ts`
  (Bearer + auto-refresh 401), `LoginView`, `ChangePasswordView` (buộc đổi lần đầu),
  router guard (chưa đăng nhập→login, ép đổi mật khẩu, chặn theo role), menu user ở header
  (đổi mật khẩu/đăng xuất), ẩn menu "Quản trị người dùng" theo role — DONE.
- [GĐ 1] FE: `UserAdminView` nối API thật (list/create/lock/delete + dialog hiện mật khẩu tạm),
  thay `CURRENT_MOCK_USER` (ở UserAdminView/FilmDetailView/FilmUploadView) bằng `authStore`;
  xoá `mockUsers.ts` — DONE. Build FE (vue-tsc) + BE (nest build) đều sạch.
- [GĐ 1] **2 lỗi typecheck bắt sớm khi build local** (trước Docker): (1) `retryAttempts/retryDelay`
  không thuộc `DataSourceOptions` → tách ra chỉ thêm khi Nest gọi `forRoot`; (2) FE bật
  `erasableSyntaxOnly` → cấm parameter-property trong constructor (`ApiError`) → khai báo field tường minh.
- [GĐ 1] **Verify thật `docker compose up -d --build`**: 5 container Up/healthy, migration+seed chạy
  (log "Đã tạo super_admin"), routes mapped đúng. Test RBAC bằng curl: no-token→401, sai pass→401
  (thông báo mơ hồ), super tạo admin (trả mật khẩu tạm), admin đổi mật khẩu→204, admin tạo NV→OK,
  admin tạo admin→403, employee GET/POST /users→403, tự khoá mình→403, refresh flow OK.
  Verify trình duyệt: login super→Kho phim, Quản trị người dùng hiện DATA API THẬT (4 user, cột
  "Người tạo" map id→tên), hàng của chính mình không có nút khoá/xoá, menu user OK, đăng xuất OK;
  login nv2→**bị ép đổi mật khẩu**→vào app vai trò NV (ẩn menu quản trị), gõ thẳng `/admin/users`→
  guard đẩy về Kho phim; 0 lỗi console. Đã chụp ảnh Review Gate.

## Nhật ký GĐ 0 + 0.5
- 2026-07-21 — [GĐ 0] Chốt stack: NestJS + MySQL + MinIO, FE Vue3+Tailwind+MDS, PWA, Docker — DONE
- 2026-07-21 — [GĐ 0] Khởi tạo memory bank + chiến lược UI-first (Review Gate mỗi GĐ) — DONE
- 2026-07-21 — [GĐ 0] Scaffold FE: Vite Vue3-TS + Tailwind v4 + copy bộ MDS (37 file) + tokens, theme blue — DONE
- 2026-07-21 — [GĐ 0] App shell: MHeaderBar (brand) + MSidebar + vue-router (5 route) + PagePlaceholder — DONE
- 2026-07-21 — [GĐ 0] Chạy dev server (port 5180), verify: shell render đúng MDS, router hoạt động, tiếng Việt OK, 0 lỗi console — DONE
- 2026-07-21 — [GĐ 0] Backend NestJS skeleton: main.ts (prefix /api, UTF-8, CORS, ValidationPipe) + app.module (TypeORM MySQL conditional) + health controller — DONE
- 2026-07-21 — [GĐ 0] Docker: docker-compose (mysql+minio+backend+frontend+nginx), Dockerfile BE/FE, nginx reverse proxy (/api,/media range), .env.example — `docker compose config` hợp lệ — DONE
- 2026-07-21 — [GĐ 0] CHƯA chạy `docker compose up --build` đầy đủ (nặng/tốn thời gian) — chờ chủ đầu tư yêu cầu; backend chưa `npm install` — sẽ cài khi build docker / vào GĐ 1
- 2026-07-21 — [GĐ 0.5] Màn **Kho phim** (danh sách): grid card 16:9, tag Phim mới, lọc chuyên mục/tìm kiếm/chỉ-phim-mới, mock 9 phim đủ 6 chuyên mục — DONE, verify browser OK
- 2026-07-21 — [GĐ 0.5] Component **VideoPlayer** dùng chung (đa nguồn: storage `<video controls>`, YouTube/Vimeo iframe embed chính thức, GDrive/MISA Drive nút mở link ngoài) + nút chọn nguồn — DONE
- 2026-07-21 — [GĐ 0.5] Màn **Chi tiết/Xem phim** `/films/:slug`: player + mô tả + hashtag + lượt xem + tải về + nút Sửa/Xoá ghim phải theo quyền (owner/admin) — DONE, verify browser (play/pause/fullscreen/volume có sẵn qua `<video controls>` gốc, chuyển nguồn hoạt động)
- 2026-07-21 — [GĐ 0.5] Màn **Thêm/Sửa phim**: form 2 cột, MUpload file+thumbnail (preview ảnh thật qua object URL), 4 link riêng (YouTube/Vimeo/GDrive/MISA Drive), hashtag MCombobox allowCreate, cảnh báo trùng tiêu đề + MDialog xác nhận cập nhật bản mới → gắn lại tag Phim mới — DONE, verify browser (publish thành công, phim mới xuất hiện ngay trong Kho phim nhờ `reactive` store)
- 2026-07-21 — [GĐ 0.5] Màn **Chuyên mục**: Master-Detail (MTree cha-con bên trái + form thêm/sửa/xoá bên phải) — DONE, verify browser (chọn node con load đúng form)
- 2026-07-21 — [GĐ 0.5] Màn **Quản trị người dùng**: MDataTable + MTag vai trò (Super Admin/Admin/Nhân viên màu khác nhau) + dialog tạo user (option vai trò theo đúng ma trận phân quyền — Super Admin tạo Admin+NV, Admin chỉ tạo NV) + khoá/mở khoá/xoá theo quyền — DONE, verify browser (tạo user mới thành công, quyền ẩn/hiện nút đúng)
- 2026-07-21 — [GĐ 0.5] **3 lỗi thật phát hiện & sửa khi verify trên trình duyệt** (không chỉ đọc code):
  1. `MIcon :size="14"` sai (chỉ nhận 12/16/20/28...) — dùng ở nhiều nơi kể cả trong 2 file gốc của skill (MUpload.vue, MTree.vue) → sửa hết về `12`.
  2. Cho phép "Xuất bản" phim không có file/link nào → trang chi tiết hiển thị rỗng vô nghĩa → thêm validate bắt buộc ≥1 nguồn trước khi xuất bản + fallback UI "Chưa có nguồn phát nào" trong VideoPlayer.
  3. `MDialog v-model="!!deleteTarget"` là lỗi cú pháp (v-model cần ref gán được) → chuyển sang `:model-value`/`@update:model-value`.

- 2026-07-21 — [GĐ 0.5] Feedback chủ đầu tư sau khi xem preview → sửa 2 điểm UI (FilmListView + VideoPlayer):
  1. Tag "Phim mới" chuyển từ đè lên thumbnail xuống hàng tag cạnh chuyên mục (luôn thấy rõ kể cả khi có ảnh bìa thật, không lẫn màu).
  2. Thêm nút **Copy link** cho từng nguồn (Nội bộ/YouTube/Vimeo/GDrive/MISA Drive) — ở cả thẻ danh sách (Kho phim) và player (Chi tiết phim), dùng `navigator.clipboard.writeText` + toast xác nhận. Đã verify browser cả 2 trang, không lỗi.

- 2026-07-21 — [GĐ 0.5] Feedback đợt 2 (chủ đầu tư):
  1. **Gộp về 1 ô tìm kiếm duy nhất**: bỏ ô search trong toolbar trang Kho phim; dùng ô search trên MHeaderBar (Enter để tìm) qua state chung `features/films/searchState.ts` (`filmSearchQuery`). Trang Kho phim hiện chip từ khoá đang lọc + nút xoá. Verify browser: gõ "MISA Cup" + Enter → còn 1 phim, xoá chip → 9 phim.
     - *Hạn chế đã biết*: ô header giữ text sau khi xoá chip (MHeaderBar quản text nội bộ, không expose v-model — không sửa sâu vào component MDS gốc). Chấp nhận ở GĐ 0.5.
  2. **Định nghĩa "Phim mới"**: bỏ cờ tĩnh `isNew`, thay bằng hàm `isFilmNew(film)` tính động theo `publishedAt` + `NEW_FILM_TTL_DAYS=14` (khớp .env.example). Phim = "mới" nếu xuất bản/cập nhật bản mới trong vòng 14 ngày. Áp dụng ở FilmListView + FilmDetailView + form upload (chỉ set `publishedAt=hôm nay`). GĐ 2+ backend tính đúng qua query/job.

- 2026-07-21 — [GĐ 0.5] Feedback đợt 3 (chủ đầu tư) → sửa & verify browser:
  1. Filter chuyên mục thêm option **"Tất cả chuyên mục"** (value null) ở đầu → quay lại xem toàn bộ được. Verify: chọn "Giới thiệu sản phẩm" (2 phim) → "Tất cả" (9 phim).
  2. **Logo/tên app trên header bấm về trang chủ** (@logo-click → route films). Verify từ trang Chuyên mục → /films.
  3. **Phân trang trang chủ**: chọn 20/30/50 phim/trang + prev/next (chuẩn MDS không đánh số trang) + dòng "1–N / tổng phim". **Luôn sắp phim mới nhất (publishedAt giảm dần) lên đầu.**
- 2026-07-21 — [GĐ 0.5] Ghi nhận yêu cầu tương lai: **báo cáo Quản trị người dùng theo giai đoạn** (ai upload bao nhiêu phim, gồm phim gì) — thêm vào roadmap GĐ 5, chưa làm ở GĐ 0.5.
- 2026-07-21 — [GĐ 0.5] ✅ CHỐT UI — chủ đầu tư duyệt "còn lại OK". Chuyển sang GĐ 1.
- 2026-07-21 — [mốc] Push GitHub **github.com/tuannhh/amis-kho-phim** (PRIVATE, nhánh main). Force push đè bản MVP cũ (commit 14/07/2026 — chủ đầu tư đồng ý thay hoàn toàn). Remote `origin` đã cấu hình.

- 2026-07-21 — [Docker] ✅ Verify toàn bộ stack chạy thật trong Docker (`docker compose up -d --build`), 3 lỗi thật phát hiện & sửa:
  1. `tsconfig.app.json` thiếu `paths: {"@/*": ["./src/*"]}` → `vue-tsc` build production fail (dev server Vite chỉ transpile nên không lộ lỗi này). Thêm `paths` (không dùng `baseUrl` — TS mới deprecate).
  2. Thiếu `allowJs: true` → `vue-tsc` không hiểu các component MDS gốc là `<script setup>` JS thuần (MSelect, MTree, toast.js...).
  3. MSelect không nhận `null` trong kiểu `modelValue` → đổi toàn bộ state "chưa chọn" từ `null` sang `undefined` (categoryFilter, form.category/parentId/role). `useFormValidation.js` (JS) trả `errors: {}` không type → ép kiểu tường minh ở 3 nơi dùng. MDataTable slot `row` kiểu `unknown` → hàm `asUser()` ép kiểu tại điểm dùng (UserAdminView).
  4. **Backend**: thiếu `class-validator`/`class-transformer` trong `package.json` dù `main.ts` dùng `ValidationPipe` → container restart-loop (exit code 1) không log rõ nguyên nhân. Thêm 2 dependency, `npm install` lại.
  5. Port `9000/8080` trùng tiến trình khác đang chạy trên máy → đổi `NGINX_PORT=8180`, `MINIO_API_PORT=9200`, `MINIO_CONSOLE_PORT=9201` (cả `.env` và `.env.example`).
  - Kết quả: `docker compose ps` cả 5 container `Up`/`healthy`; `curl localhost:8180/api/health` → 200; FE qua nginx (build production, không phải dev server) hiển thị đúng, 0 lỗi console.

- 2026-08-10 — [GĐ8-D, nhánh `phan-quyen-4-cap`] Sửa 2 lỗi phát hiện khi kiểm chứng: (1) trang
  Kho phim hiện trùng cùng phim 2 lần (kệ chuyên mục + lưới đầy đủ ngay dưới) khi chưa lọc gì —
  ẩn lưới đầy đủ theo mô hình YouTube, chỉ hiện khi có bộ lọc/tìm kiếm đang bật (ADR-063), áp
  cho cả `FilmListView.vue` và `FilmListMobileView.vue`; (2) trong lúc verify bằng đăng nhập
  thật, phát hiện nút "Đăng nhập" KHÔNG submit được form (không có request nào tới
  `/auth/login`) — `MButton.vue` hard-code `type="button"`, không forward prop `type` nên
  `type="submit"` truyền từ `LoginView.vue` vô hiệu; thêm prop `type` tường minh (ADR-066). Đã
  build lại Docker, verify bằng đăng nhập + bấm nút chuyên mục/switch "Chỉ hiển thị phim mới"
  thật trên trình duyệt (không chỉ đọc code) — xác nhận cả desktop và mobile view đều đúng.
  **Chưa port sang `phan-quyen-3-cap`.**
- 2026-08-10 — [GĐ8-D tiếp, nhánh `phan-quyen-4-cap`] Người dùng chụp ảnh báo tiếp: thanh bộ
  lọc (dropdown chuyên mục + switch "Chỉ hiển thị phim mới") bị đẩy xuống tít cuối trang do
  nằm chung khối với kệ chuyên mục — nhiều kệ thì phải cuộn hết mới thấy. Tách thanh bộ lọc ra
  card riêng, cố định ở ĐẦU khu vực nội dung (trước kệ chuyên mục); khối lưới+phân trang tách
  card riêng, chỉ hiện khi có lọc, đặt SAU kệ (ADR-067). Chỉ áp cho `FilmListView.vue` (desktop)
  — mobile không bị lỗi này vì bộ lọc vốn đã ở đầu màn hình từ GĐ8-B. Verify lại bằng trình
  duyệt thật (bật/tắt switch, xem thanh lọc không còn di chuyển theo số lượng kệ).
- 2026-08-10 — [GĐ8-D tiếp nữa, nhánh `phan-quyen-4-cap`] Người dùng gửi ảnh chụp thật từ
  iPhone (Chrome DevTools mô phỏng) + ảnh so sánh app AMIS Mobile/YouTube: (1) kệ chuyên mục
  mobile đổi từ thẻ cuộn ngang → danh sách DỌC từng dòng kiểu YouTube (thumbnail trái + tên
  phim/nhãn "Phim mới"/ngày đăng bên phải), mỗi kệ chỉ 3 phim mới nhất, thêm biến thể
  `variant="row"` cho `FilmCardMobile.vue` (ADR-068); "Xem tất cả" GIỮ NGUYÊN hành vi cũ (hiện
  lưới đầy đủ dùng đúng cấu trúc trang chủ khi có lọc). (2) Ô "Lượt xem"/"Lượt tải" ở trang Xem
  phim gộp nhãn+số về 1 dòng thay vì 2 dòng xếp chồng (ADR-069). Build lại Docker, verify bằng
  trình duyệt thật ở viewport 440×956 (iPhone 16 Pro Max theo tỉ lệ ảnh người dùng gửi): kệ
  hiện đúng 3 dòng dọc, "Xem tất cả"/chip chuyên mục mở đúng lưới đầy đủ, ô KPI 1 dòng không
  còn tràn. **Chưa port sang `phan-quyen-3-cap`.**

## Việc tiếp theo (next actions)
1. **GĐ 5 (Nghiệp vụ nâng cao)** — Sonnet 5 (+ Opus 4.8 cho phần versioning nếu cần đào sâu).
   Còn thiếu theo 03-roadmap.md: thông báo phim mới (bảng `notifications`/`user_notifications`
   đã có trong 01-architecture.md §4, chưa có module `notifications` thật); báo cáo Quản trị
   theo giai đoạn ai upload bao nhiêu phim + gồm phim gì (lọc theo người upload/khoảng ngày,
   xuất CSV). Trùng tiêu đề/versioning + tag "Phim mới" đã có 1 phần từ GĐ2/GĐ3.
2. Docker stack đã verify chạy tốt — có thể `docker compose down` khi không cần chạy liên tục (đỡ chiếm cổng/RAM), `up -d` lại khi cần.
