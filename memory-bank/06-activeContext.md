# AMIS Kho phim — Active Context

> "Đang làm gì ngay lúc này". File đọc đầu tiên khi mở lại phiên làm việc
> (đặc biệt sau khi clear context — đọc file này trước, không cần đọc lại lịch sử chat).

## Tóm tắt nhanh (đọc 30 giây là hiểu hết)

### ✅ VỪA XONG: GĐ 8 — MOBILE-NATIVE UI, GIAI ĐOẠN A (2026-08-07, Opus 5)

**CHỈ trên nhánh `phan-quyen-4-cap`.** Chi tiết + bằng chứng browser test ở `04-progress.md`
mục "Nhật ký GĐ 8 — Giai đoạn A"; quyết định ở **ADR-058 → ADR-060**.
**Test: 216 unit BE + 106 tích hợp BE + 82 FE = 404** (trước: 391) + 2 script đồng thời.

Năm điều quan trọng nhất cần nhớ:

- **Kiến trúc "1 route, 2 view" (ADR-058).** `films` và `film-detail` giữ NGUYÊN URL nhưng
  render component khác nhau theo `isCompact` (<600px), qua `lib/responsiveView.ts` khai báo
  ở `router/index.ts`. Bản mobile là màn DỰNG RIÊNG (`*MobileView.vue`), không phải bản
  desktop co giãn bằng CSS. **Khi thêm route mobile mới, dùng `lazyResponsiveView`, đừng tạo
  path riêng kiểu `/m/...`.**
- **Logic nghiệp vụ KHÔNG được nhân đôi.** Lọc/phân trang Kho phim nằm ở
  `features/films/useFilmListFilters.ts` — **cả hai view desktop và mobile đều dùng file
  này**. Sửa quy tắc lọc thì sửa đúng một chỗ. Tương tự `CategoryShelves` (prop `mobile`) và
  helper quyền `canManageFilm`.
- **Trên mobile, mọi thao tác gom vào nút "⋯" luôn hiển thị** (ADR-059) — KHÔNG dùng hover để
  lộ Sửa/Xoá như bản desktop, vì màn cảm ứng không có trạng thái hover. Nút Primary thì
  full-width đứng riêng một hàng; không bao giờ dàn 2 nút chữ cạnh nhau ở 320px.
- **Hai bug thật đã sửa ở màn Đăng nhập:** `MInput` thiếu `inheritAttrs:false` nên
  `autocomplete` không tới được `<input>` (autofill/password manager không chạy), và nút Đăng
  nhập vừa `type=submit` vừa `@click` nên gửi **2 request** mỗi lần bấm. Cả hai đã sửa tại
  component/màn tương ứng.
- ⛔ **GIAI ĐOẠN B CHƯA LÀM.** Thêm/Sửa phim dạng wizard + đổi popup sang bottom sheet + các
  màn còn lại (Phim tôi quản lý, Chuyên mục, Quản trị, Báo cáo, Đổi mật khẩu) VẪN dùng bản
  desktop khi xem ở compact. Cụm icon `MHeaderBar` còn 32px (chuẩn đòi 48px) — nới thẳng sẽ
  tràn ngang ở 320px, phải thiết kế lại cụm tiện ích trước. Danh sách đầy đủ ở cuối nhật ký
  GĐ 8 trong `04-progress.md`. **Đừng báo cáo các phần này là đã có.**

---

### ✅ TRƯỚC ĐÓ: ĐỢT 2 — 10 VIỆC (5, 6, 8, 9, 10, 11, 12, 13, 14, 15) (2026-08-07, Opus 5)

**CHỈ trên nhánh `phan-quyen-4-cap`.** Chi tiết + bằng chứng ở `04-progress.md` mục
"Nhật ký ĐỢT 2 — 10 việc"; quyết định ở **ADR-052 → ADR-057**.
**Test: 216 unit BE + 106 tích hợp BE + 69 FE = 391** (trước: 330) + 2 script đồng thời.

Năm điều quan trọng nhất cần nhớ:

- ⛔ **CÒN NỢ MỘT PHẦN — multipart-resume cho video (việc 15 mục 3) CHƯA LÀM.** Presigned
  `PUT` đơn lẻ **không resume được**: mất mạng/đóng trình duyệt giữa chừng là **upload lại từ
  đầu** (file tới 2GB). Đây là hoãn CÓ CHỦ ĐÍCH, đã báo người dùng, có đề xuất 5 bước sẵn sàng
  làm ở cuối nhật ký đợt 2. **Đừng báo cáo tính năng này là đã có.**
- **Nhãn "Phim mới" nay do BACKEND tính (`ApiFilm.isNew`), KHÔNG suy từ `publishedAt` ở FE.**
  `isFilmNew()` đã bị GỠ khỏi FE có chủ đích — **đừng thêm lại**. Nhãn phụ thuộc cả việc phim
  có phải bản mới nhất trong nhóm TRÙNG TIÊU ĐỀ hay không, mà trang chi tiết chỉ tải một phim
  nên FE không thể biết. Không có cột trạng thái nào để đồng bộ (ADR-052) — xoá phim mới nhất
  thì phim cũ cùng tên **nhận lại nhãn**, đó là đúng thiết kế.
- **Ảnh bìa nay upload bằng presigned PUT thẳng lên MinIO; `POST /films/:id/thumbnail`
  (multipart) ĐÃ BỊ GỠ.** Nó dùng multer `memoryStorage` — buffer cả file trong RAM Node, đây
  là điểm nghẽn thật khi nhiều người upload cùng lúc. Kiểm ảnh (16:9 + magic bytes) chuyển
  sang `confirmVersion`, đọc 64KB đầu của object. **Đừng "khôi phục" endpoint cũ cho tiện.**
- **Báo cáo `/reports` nay Cấp 3 vào được, nhưng phạm vi do SERVER ép theo `department_id` đọc
  từ DB** — tham số `departmentId` client gửi lên bị BỎ QUA với Cấp 3 (ADR-053). Cấp 3 chưa
  gán phòng ban → báo cáo RỖNG, **không được** rơi vào nhánh "không lọc".
- **Ba component FE mới dùng chung, đừng chép lại:** `FilmCard.vue` (thẻ phim, dùng ở 3 nơi),
  `FilmManageDialogs.vue` (popup Sửa + popup Xoá), `FilmForm.vue` (form Thêm/Sửa tách khỏi
  `FilmUploadView.vue`, chạy được cả ở trang riêng lẫn trong dialog qua prop `embedded`).

Màn/route mới: **"Phim tôi quản lý"** (`/my-films`, Cấp 2 trở lên) — `GET /films?scope=managed`.
Endpoint mới: `POST /films/:id/download`, `POST /films/:id/thumbnail-url`.
Migration mới: `AddDownloadCountAndTitleIndex` (cột `download_count` + index `idx_films_title`).

### Việc trước đó: ĐỢT 2 ĐỢT ĐẦU — 5 VIỆC (1, 2, 3, 4a, 7) (2026-08-06, Opus 5)

**CHỈ làm trên nhánh `phan-quyen-4-cap`** — người dùng yêu cầu sửa xong bên 4 cấp rồi mới port
sang `phan-quyen-3-cap`. Việc **5, 6, 8 để đợt sau** (chưa đụng tới). Chi tiết + bằng chứng ở
`04-progress.md`; quyết định ở **ADR-050** (nháp) và **ADR-051** (chuyên mục).

Bốn điều quan trọng nhất cần nhớ:
- **Việc 7 KHÔNG phải bug — đừng đi "sửa" nó.** Trưởng phòng SỬA/XOÁ ĐƯỢC phim của nhân viên
  cùng phòng: đã chứng minh bằng curl (200/403/204 đúng ma trận), bằng DB (`department_id` của
  phim demo đều đúng = 1), và bằng browser thật (nút Sửa/Xoá hiện, lưu thành công). Cái làm
  người dùng tưởng hỏng: phim họ thử **không có nguồn phát nào**, nên nút Lưu bị validate
  *"Cần ít nhất một nguồn"* chặn, toast lại nằm cuối trang nên dễ bỏ sót.
- **Nháp form nay gắn `userId` vào khoá localStorage** (`kho-phim:film-draft-v2:<userId>:…`).
  Đây là lỗi rò dữ liệu giữa hai tài khoản trên cùng máy, đã tái hiện và sửa. **Không bao giờ
  quay lại khoá dùng chung**, kể cả khi chưa biết người dùng là ai (khi đó bỏ qua nháp).
- **Quyền chuyên mục nay theo TẦNG, không theo một mức vai trò:** gốc = Cấp 4, con = Cấp 2 trở
  lên. ADR-051 thay phần chuyên mục của ADR-044.
- **Ưu tiên phát phim đổi thành `youtube → vimeo → storage → gdrive → misadrive`.** Một phim
  được phép có nhiều nguồn cùng lúc (backend vốn đã hỗ trợ, chỉ chữ trên giao diện mô tả sai).

### Việc trước đó: ĐỢT SỬA 5 VẤN ĐỀ TỪ TEST THỰC TẾ CỦA NGƯỜI DÙNG (2026-08-06, Opus 5)

Người dùng tự test bản 3 cấp trên Docker và báo 5 vấn đề. **Đã sửa xong và push CẢ 2 NHÁNH**
(cả 5 đều là bug/UX chung, không dính khác biệt RBAC). Chi tiết + bằng chứng verify ở
`04-progress.md`; quyết định thiết kế ở **ADR-048** (hashtag) và **ADR-049** (YouTube).

Hai điều quan trọng nhất cần nhớ:
- **YouTube Error 153 là BUG THẬT ở tầng hạ tầng, không phải link demo giả.** `Referrer-Policy:
  no-referrer` của nginx làm iframe không gửi Referer → YouTube từ chối khởi tạo player với MỌI
  video. Đã sửa bằng `referrerpolicy="strict-origin-when-cross-origin"` đặt trên chính 2 iframe
  trong `VideoPlayer.vue`. **Đừng xoá thuộc tính này vì tưởng thừa** — lỗi sẽ tái phát và cực
  khó lần ra.
- **Nút upload/xuất bản KHÔNG có bug.** Đã tái hiện đầy đủ trên browser thật (chọn file → tạo
  phim → phát được, storage trả HTTP 206). Cái làm người dùng tưởng "nút chết" là khi **chưa
  chọn Chuyên mục** — form chặn submit và báo đỏ đúng thiết kế. Nếu người dùng báo lại, hỏi
  trước xem đã chọn Chuyên mục chưa.

Control hashtag nay là `frontend/src/components/HashtagInput.vue` (lắp từ MInput + MTag), logic
tách chuỗi thuần ở `frontend/src/features/upload/hashtags.ts`. `MCombobox` **không còn** dùng ở
màn Thêm phim.

### 🔀 ĐANG CÓ 2 NHÁNH RBAC SONG SONG — CHỜ NGƯỜI DÙNG CHỌN (2026-08-06)

**Chưa nhánh nào merge vào `main`.** Người dùng yêu cầu làm 2 bản để so sánh trực tiếp trên
GitHub rồi chốt một. `main` vẫn là bản trước RBAC.

| | `phan-quyen-4-cap` | `phan-quyen-3-cap` |
|---|---|---|
| Vai trò | viewer / employee / **dept_manager** / super_admin | viewer / employee / super_admin |
| Cấp cao nhất | Cấp 3 chỉ phim **cùng phòng ban**; Cấp 4 mọi phim | Cấp 3 sửa **MỌI** phim, không xét phòng ban |
| ADR | ADR-040 → 044 `[RBAC4]`, +051 | ADR-045 → 047 `[RBAC3]` |
| Test | **216 + 106 + 82 = 404** (sau GĐ 8 Giai đoạn A) | 163 + 80 + 47 = 290 |

> ⚠️ **Nhánh 4 cấp đang đi trước BA đợt** (đợt 5 việc + đợt 10 việc + GĐ 8 Giai đoạn A mobile). ADR-050 (nháp gắn userId — lỗi bảo mật) và các
> sửa UI của việc 3/4a là chung cho cả hai mô hình RBAC, **cần port sang `phan-quyen-3-cap`**.
> ADR-051 (chuyên mục theo tầng) phụ thuộc `FILM_WRITE_ROLES` nên khi port phải ánh xạ lại vai trò.

- **Lược đồ DB HAI NHÁNH GIỐNG HỆT NHAU** — bảng `departments` + các cột `department_id`/
  `created_by` có ở cả hai; khác nhau chỉ ở chỗ bản 3 cấp dùng chúng **thuần truy vết**, không
  quyết định quyền (ADR-046). Đổi qua lại giữa 2 phương án không phải migrate lại dữ liệu.
- **Điểm đánh đổi để người dùng cân nhắc:** bản 3 cấp đơn giản hơn hẳn nhưng **không có mức
  trung gian** — muốn cho ai đó sửa phim người khác thì phải trao luôn toàn quyền quản trị (tài
  khoản, chuyên mục, báo cáo có PII). Bản 4 cấp tách được hai thứ đó, đổi lại phức tạp hơn.
- ⚠️ **DB dev hiện tại (`localhost:8180`) đang mang trạng thái của nhánh 3 CẤP**: migration đã
  chạy, `roles` còn 3 dòng, 2 tài khoản `tp1@`/`tp2@` đã bị hạ từ `dept_manager` xuống
  `employee`. Muốn quay lại demo bản 4 cấp thì checkout nhánh đó, `docker compose up -d --build`
  và **gán lại vai trò Trưởng phòng cho `tp1@`/`tp2@`** (migration không tự khôi phục được).
- Chi tiết bản 3 cấp (nhật ký + ADR-045→047) nằm TRÊN NHÁNH `phan-quyen-3-cap`, không có trong
  file này. Chi tiết bản 4 cấp: `04-progress.md` mục "Nhật ký RBAC 4 CẤP CÓ SCOPE PHÒNG BAN".

### ⭐ VIỆC TRƯỚC ĐÓ: RBAC 4 CẤP CÓ SCOPE PHÒNG BAN — ✅ XONG (2026-08-05, Opus 5) — nhánh `phan-quyen-4-cap` (NHÁNH HIỆN TẠI)
Việc **phát sinh ngoài roadmap**, đã thay thế **HOÀN TOÀN** 3 vai trò cũ
`super_admin`/`admin`/`employee`. **Đọc ADR-040 → ADR-044 trước khi sửa bất cứ thứ gì liên quan
phân quyền.**

| Cấp | RoleCode | Nhãn | Quyền |
|---|---|---|---|
| 1 | `viewer` | Người xem | CHỈ xem |
| 2 | `employee` | Nhân viên văn phòng | + tạo phim, sửa/xoá phim **của mình** |
| 3 | `dept_manager` | Trưởng phòng | + sửa/xoá phim của **Cấp 2 CÙNG phòng ban** |
| 4 | `super_admin` | Quản trị cao nhất | + mọi phòng ban + toàn bộ quyền quản trị |

- **Vai trò `admin` KHÔNG CÒN TỒN TẠI.** Dữ liệu cũ migrate `admin` → **Cấp 4** (ADR-041 —
  vì hành vi thật của `admin` cũ là sửa được MỌI phim toàn công ty, khớp Cấp 4 chứ không phải Cấp 3).
  ⚠️ Đây là thay đổi quyền thật, đã báo cho người dùng xác nhận.
- **Lỗ hổng đã bịt:** trước đây `POST /films` và 3 route storage **không có `@Roles` nào** → mọi tài
  khoản đã đăng nhập đều tạo được phim. Nay 7 route ghi của `/films` đều gắn `@Roles(...FILM_WRITE_ROLES)`.
- **Nguồn sự thật vai trò:** BE `modules/users/entities/role.entity.ts` · FE
  `features/auth/permissions.ts`. **Sửa quy tắc phải sửa CẢ HAI** (FE là bản sao để ẩn/hiện nút).
- **`departmentId` KHÔNG nằm trong JWT** — đọc lại DB mỗi lần kiểm quyền (ADR-043), để Trưởng phòng
  bị chuyển phòng ban mất quyền NGAY, không phải chờ token 15 phút hết hạn.
- Màn mới: **"Quản lý phòng ban"** (`/admin/departments`, chỉ Cấp 4). Endpoint mới:
  `/api/departments` (CRUD) + `PATCH /api/users/:id` (đổi vai trò/phòng ban).
- **Test: 299** (174 unit BE + 82 tích hợp BE trên MySQL thật + 43 FE), tất cả pass.
- Tài khoản demo trên DB dev (mật khẩu `Test@2026x`): `xem@` Cấp 1 · `nv1@`/`nv2@` Cấp 2 (Phòng
  Truyền thông) · `tp1@` Cấp 3 (Phòng Truyền thông) · `tp2@` Cấp 3 (Phòng Kinh doanh). Chi tiết đầy
  đủ ở `04-progress.md` mục "Nhật ký RBAC 4 cấp".

### ⭐ DỰ ÁN ĐÃ HOÀN THÀNH TOÀN BỘ ROADMAP CHÍNH (GĐ 0 → GĐ 7)
- **GĐ 7 — Hardening & Handoff ĐÃ XONG (2026-07-29, Opus 5)** — đây là giai đoạn CUỐI của
  `03-roadmap.md`. Không còn giai đoạn nào phía sau.
- **Việc treo DUY NHẤT còn lại** (không thuộc roadmap chính): hoàn thiện **GĐ 6.1 — SSO AMIS
  Mobile** khi đội AMIS Mobile cung cấp spec bridge thật. Toàn bộ checklist những gì cần họ
  xác nhận và những gì cần code sau đó đã gom sẵn ở **`docs/devops-handoff.md` mục 6** —
  đọc mục đó, không cần lần lại ADR-029/030.
- **Trạng thái commit**: GĐ 4, 5, 6, 6.1, 7 đang là commit LOCAL, **CHƯA push** (chờ xác nhận
  của người dùng). GĐ 3 và trước đó đã lên GitHub `main`.

### GĐ 7 đã làm gì (chi tiết đầy đủ ở `04-progress.md` mục "Nhật ký GĐ 7")
- **Áp dụng skill `misa-backend-standard`** (Quy chuẩn Backend MISA, ở
  `~/.claude/skills/misa-backend-standard`) làm khung chuẩn. **Phiên sau sửa backend PHẢI
  dùng lại skill này.** Đánh giá an ninh bám đúng khung 9 mục của
  `references/02-security-baseline.md`.
- **Đã sửa 12 vấn đề bảo mật/vận hành.** Nghiêm trọng nhất: JWT secret mặc định `change-me`
  nằm công khai trong repo (ai đọc code cũng tự ký được token super_admin) → nay có cơ chế
  **từ chối khởi động** khi cấu hình còn giá trị mặc định. Cùng với: rate limit đăng nhập,
  ép cứng thuật toán JWT, chống CSV injection, helmet + security header, siết CORS, chống dò
  tài khoản qua thời gian phản hồi, nhật ký kiểm toán, `npm ci` chống supply-chain,
  liveness/readiness tách riêng, tắt có kiểm soát.
- **Còn treo 11 rủi ro** (đều là đổi kiến trúc / phá vỡ hợp đồng API / cần quyết định nghiệp
  vụ) — bảng đầy đủ kèm bằng chứng `file:dòng` và lý do KHÔNG tự sửa ở
  **`docs/danh-gia-an-ninh.md`**. Nghiêm trọng nhất là **R-09**: `/media/:key` công khai chỉ
  dựa vào UUID khó đoán — nên đổi sang presigned GET ngắn hạn trước khi mở cho toàn công ty
  nếu kho phim có nội dung nhạy cảm.
- **Test: từ 0 lên 201** — 129 unit BE (Jest) + **46 tích hợp trên MySQL THẬT** + 26 FE
  (Vitest), cộng script kiểm thử đồng thời riêng. Trước GĐ7 dự án **không có test nào**.
- **Đợt bổ sung đã phát hiện và sửa 2 LỖI THẬT** mà unit test có mock không thể thấy:
  (1) race condition ở `recordView` — 1 người dùng gửi 20 request song song bị tính 4 lượt
  thay vì 1, sửa bằng giao dịch + khoá dòng (ADR-036); (2) kết nối MySQL không khai báo múi
  giờ nên cửa sổ dedupe lệch 7 tiếng khi Node chạy khác múi giờ với DB, sửa bằng
  `timezone: 'Z'` (ADR-037). Đây là minh chứng vì sao chuẩn bắt buộc kiểm thử đồng thời và
  kiểm thử tích hợp.
- **Đã có CI** `.github/workflows/ci.yml` (4 job). ⚠️ **Branch protection phải bật thủ công
  trên GitHub** mới thành cổng chặn thật — workflow không tự ép được.
- **Tài liệu mới**: `docs/danh-gia-an-ninh.md`, `docs/api-overview.md`,
  `docs/quy-trinh-noi-bo.md`, `docs/devops-handoff.md`, Swagger `/api/docs` (tắt ở production),
  và `memory-bank/11-coding-rules.md` (quy tắc riêng dự án, theo mandate của skill).

### ⚠️ BA ĐIỀU DỄ HIỂU NHẦM NHẤT — đọc trước khi sửa gì
1. **Stack dev chạy `NODE_ENV=production`** (Dockerfile pin sẵn). Vì vậy cổng chặn cấu hình
   là biến riêng **`ALLOW_INSECURE_CONFIG`**, không phải `NODE_ENV` (ADR-032). Log backend in
   6 dòng cảnh báo "[CHẶN Ở MÔI TRƯỜNG THẬT]" mỗi lần khởi động — **đó là bình thường ở dev**,
   không phải lỗi.
2. **Sửa `nginx/nginx.conf` phải `docker compose restart nginx`** — file mount read-only,
   `up -d --build` không nạp lại config.
3. **Chuông thông báo luôn rỗng là CHỦ ĐÍCH** (tắt từ 2026-07-22 để tránh spam), không phải bug.
4. **`films.department_id` là SNAPSHOT lúc tạo phim, KHÔNG join động qua uploader** (ADR-042) — sửa
   phòng ban của người dùng KHÔNG làm đổi phòng ban của phim họ đã tạo. Đây là chủ đích.
   Phim tạo TRƯỚC khi có phòng ban có `department_id = NULL` → Cấp 3 không quản được, phải gán lại
   tường minh. Và **`null` không được coi là "trùng null"** khi so phòng ban.

Danh sách đầy đủ các bẫy loại này: **`memory-bank/11-coding-rules.md`** — đọc file đó trước
khi sửa code, sẽ tiết kiệm rất nhiều thời gian.

### Giới hạn còn lại sau đợt bổ sung (nói rõ, không giấu)
- **Chưa có test component UI** (chưa cài `@vue/test-utils`). ĐÚNG CHUẨN khi để vậy —
  `07-testing-strategy §6` cho phép xác minh thủ công có chủ đích khi tự động hoá khó, miễn
  nói rõ giới hạn. UI được kiểm trên trình duyệt thật qua từng Review Gate.
- **Chưa kiểm trên thiết bị di động thật** (iOS Safari / Android Chrome) — tồn đọng từ GĐ 6,
  môi trường phiên làm việc chỉ có trình duyệt desktop.
- **CI chưa chạy thật trên GitHub** vì chưa push (người dùng chưa đồng ý push). Đã verify cú
  pháp YAML + chạy thật mọi lệnh trong workflow ở local, gồm mô phỏng job e2e bằng đúng biến
  môi trường CI truyền.
- **Chưa có CD** — chưa biết nền tảng đích, cần xác nhận với đội hạ tầng MISA.
- **19 CVE phạm vi production ở backend** (0 critical), mọi bản vá đòi nâng major NestJS
  10→11. FE thì **0 CVE phạm vi production**. Khuyến nghị: nhánh riêng
  `chore/upgrade-nestjs-11`, dựa vào 201 test làm lưới an toàn (rủi ro R-05).
- **9 rủi ro kiến trúc còn treo** — đều có căn cứ trích dẫn quy chuẩn cho phép treo VÀ khuyến
  nghị hành động cụ thể, xem `docs/danh-gia-an-ninh.md` Phụ lục A. Đáng chú ý nhất R-09
  (`/media/:key` công khai) đã có sẵn phương án presigned GET 5 bước.

### Các giai đoạn trước (tóm tắt — chi tiết ở `04-progress.md`)
- **GĐ 6.1**: scaffold nhúng AMIS Mobile (WebView+bridge), **TẮT mặc định**, chờ spec thật.
  `POST /auth/sso/amis-mobile` + `frontend/src/lib/amisBridge.ts`. ADR-029/030.
- **GĐ 6**: PWA (`vite-plugin-pwa`, `registerType:'prompt'`), window size class, bottom
  navigation ở Compact (<600px). ADR-027/028.
- **GĐ 5**: thông báo phim mới (đã tắt) + báo cáo Quản trị CSV. ADR-024/025/026.
- **GĐ 4**: đếm lượt xem thật (`film_views`), dedupe theo user 30 phút. ADR-023.
- **GĐ 3**: MinIO thật — presigned PUT, stream Range 206, `film_versions`. ADR-019/020/021/022.
- **GĐ 2**: chuyên mục + phim core, owner policy `assertCanManage`. ADR-015/016/017/018.
- **GĐ 1**: Auth & RBAC (JWT access 15' + refresh 7d). ADR-011/012/013/014.
- **Đăng nhập** (seed từ .env): `superadmin@misa.com.vn` / `Admin@12345` (**đổi ở prod!**).
- **DB hiện có 1 phim** ("Phim Giới thiệu Tập đoàn MISA", nguồn YouTube). Dữ liệu test tạo
  trong lúc verify GĐ7 đã được dọn sạch.

## Cách chạy lại nhanh
```bash
cd /Users/tuanbui/amis-kho-phim
docker compose up -d              # chạy lại toàn stack (đã build sẵn image)
docker compose up -d --build      # nếu vừa sửa code BE/FE
docker compose down               # tắt khi không dùng (volume vẫn giữ)
```
- Truy cập: http://localhost:8180 (FE qua nginx) · http://localhost:8180/api/health (BE)
- MinIO console: http://localhost:9201 (minioadmin/minioadmin)
- Dev FE riêng (không qua Docker, hot-reload nhanh hơn khi sửa UI):
  `cd frontend && npm run dev -- --port 5180` → http://localhost:5180
  (đã có config sẵn trong `~/.claude/launch.json` tên `kho-phim-fe`)
- Dev BE riêng: `cd backend && npm install && npm run start:dev` (cần mysql chạy qua
  `docker compose up -d mysql`)

## GĐ 2 — checklist (Chuyên mục & Phim core) — ✅ ĐÃ XONG (2026-07-21)
- [x] BE CategoriesModule: entity + CRUD /api/categories (cây cha-con), @Roles super/admin cho ghi
- [x] BE FilmsModule: entity films + slug, CRUD /api/films (metadata + link ngoài, chưa file)
- [x] BE **OwnerGuard** thật: `FilmsService.assertCanManage` — nhân viên chỉ sửa/xoá phim mình (ADR-002/014)
- [x] FE: CategoryView + FilmListView + FilmDetailView + FilmUploadView nối API thật; xoá mock 2 file
- [x] Giữ UI đã duyệt; UTF-8 tiếng Việt; Review Gate (curl RBAC + browser: tạo cây chuyên mục,
  xuất bản phim YouTube, nhân viên không thấy nút Sửa/Xoá phim người khác)

## GĐ 3 — checklist (Storage & Thumbnail, MinIO thật) — ✅ ĐÃ XONG (2026-07-21)
- [x] BE StorageModule: `@aws-sdk/client-s3` tới MinIO, presigned PUT (video) + multipart (thumbnail)
- [x] BE stream Range (206 Partial Content) `/media/:key` (ngoài prefix /api, khớp nginx /media/)
- [x] Bảng `film_versions` (migration `AddFilmVersions`); films trỏ bản mới nhất → storage/thumbnail
- [x] FE FilmUploadView: luồng upload THẬT (presigned PUT có progress → thumbnail → confirmVersion), xoá TODO
- [x] FE VideoPlayer: nguồn `storage` dùng `<video src="/media/:key">` thật; FilmListView thumbnail thật
- [x] Validate thumbnail 16:9 (image-size magic bytes) + MIME video + MAX_UPLOAD_MB — enforce ở BE
- [x] RBAC dùng lại `assertCanManage` cho mọi thao tác storage (verify nhân viên→403)
- [x] Review Gate: Docker up, presigned PUT từ trình duyệt→MinIO 200 (CORS OK), Range 206, F5 vẫn còn

## GĐ 4 — checklist (Player & Link ngoài & View) — ✅ ĐÃ XONG (2026-07-21)
- [x] BE bảng `film_views` (id, film_id, user_id?, session_hash, viewed_at) + migration `AddFilmViews`
- [x] BE đếm view: `POST /films/:id/view`, dedupe theo user_id cửa sổ 30' → tăng films.view_count atomic
- [x] FE gọi API tăng view khi mở trang xem (onMounted, 1 lần/slug); hiển thị lượt xem thật ngay
- [x] Rà lại player đa nguồn + nút link theo nguồn (đã có từ GĐ0.5/GĐ3) — không có bug thật
- [x] Review Gate: Docker up, mở phim → +1; F5 nhiều lần trong 30' không tăng thêm (verify browser
  + SQL); gọi API 3 lần liên tiếp trên phim khác → chỉ tăng lần đầu; 0 lỗi console

## Cấu trúc code hiện tại (đã hết mock — API thật GĐ1→GĐ4)
- `frontend/src/features/films/filmTypes.ts` — FilmSource (gồm 'storage'), SOURCE_LABEL/ICON,
  categoryColorFor, thumbnailGradient (fallback khi chưa có ảnh bìa), isFilmNew/formatVNDate
- `frontend/src/features/films/filmsApi.ts` — CRUD + createUploadUrl/uploadThumbnail/confirmVersion +
  **[GĐ4]** `recordView(id)`; `ApiFilm` có `thumbnailUrl`. `filmsStore.ts` (Pinia, refetch sau mutation)
- `frontend/src/features/films/FilmDetailView.vue` — **[GĐ4]** gọi `recordView` 1 lần trong
  `onMounted` sau khi load phim xong (biến `viewedSlug` chống gọi lại khi chỉ re-render)
- `frontend/src/features/films/storageUpload.ts` — **[GĐ3]** putToStorage (XHR PUT presigned có
  progress), readVideoDuration (có timeout — ADR-022), formatDuration
- `frontend/src/features/upload/FilmUploadView.vue` — **[GĐ3]** luồng upload thật (progress/lỗi qua MUpload)
- `frontend/src/components/VideoPlayer.vue` — player đa nguồn; storage dùng `<video src=/media/:key>` thật
- `frontend/src/lib/http.ts` — apiFetch; **[GĐ3]** bỏ ép Content-Type khi body là FormData
- Backend `modules/storage/` — **[GĐ3]** StorageService (2 S3Client: internal+presigner),
  MediaController (`/media/:key` Range 206, @Public, ngoài prefix /api)
- Backend `modules/films/` — Film/FilmLink/Hashtag + FilmVersion (GĐ3) + **[GĐ4]** FilmView entity
  (`film-view.entity.ts`); FilmsController thêm upload-url/thumbnail/versions + **[GĐ4]** `:id/view`;
  FilmsService.toPublic lấy version mới nhất → storage/thumbnail; `recordView`/`sessionHashOf` (GĐ4)
- Backend `modules/categories/` — cây cha-con (ADR-016 bảng riêng, không JSON column)
- Migrations: InitAuth → InitCatalog → AddFilmVersions → AddFilmViews → AddNotifications →
  **AddDepartmentsAndRbac4Levels** (đăng ký tường minh trong `db-options.ts`)
- Backend `modules/departments/` — **[RBAC4]** danh mục phòng ban (chỉ Cấp 4), chặn xoá khi còn tham chiếu
- Frontend `features/departments/` — **[RBAC4]** `DepartmentAdminView.vue` + `departmentsApi.ts`
- Frontend `features/auth/permissions.ts` — **[RBAC4]** nguồn sự thật vai trò/quyền phía FE

## Quyết định đã chốt (xem đầy đủ ở 05-decisions.md)
- ORM: **TypeORM**. Nginx dùng từ GĐ 0. Tailwind **v4**. Theme MDS blue mặc định.
- Slug (category/film) tự sinh ở BE + hậu tố số nếu trùng — FE không tự gửi slug (ADR-015).
- Cổng Docker: `NGINX_PORT=8180`, `MINIO_API_PORT=9200`, `MINIO_CONSOLE_PORT=9201` — đã đổi
  khỏi mặc định vì trùng tiến trình khác trên máy dev (ADR-010).
- `tsconfig.app.json` cần `paths: {"@/*": [...]}` + `allowJs: true` để `vue-tsc` build production
  qua được (dev server Vite không cần, chỉ transpile) — đừng xoá 2 dòng này.
- Component MDS gốc dùng `null` cho "chưa chọn" nhưng MSelect không nhận `null` trong kiểu
  `modelValue` khi dùng từ TS — toàn bộ state "chưa chọn" trong dự án dùng `undefined`, không `null`.
- Backend TypeScript bật `erasableSyntaxOnly`-tương-tự ở FE (vue-tsc) — KHÔNG dùng parameter
  property trong constructor class lỗi (`ApiError`), khai báo field tường minh.
- `retryAttempts`/`retryDelay` là mở rộng riêng của Nest — chỉ thêm khi gọi `TypeOrmModule.forRoot`,
  KHÔNG để trong `DataSourceOptions` dùng chung cho CLI migration (fail typecheck).

## Lưu ý khi làm việc
- UI: BẮT BUỘC gọi skill `misa-design-system` mỗi khi dựng/sửa giao diện.
- Kế thừa bài học bảo mật từ project AMIS Kho ảnh v2 (kiểm quyền ở BE, owner policy).
- Mọi thay đổi schema → migration, không sửa tay.
- Sau mỗi việc đáng kể: cập nhật `04-progress.md`; quyết định lớn → `05-decisions.md`.
- Trước khi báo "xong" UI: tự bấm/test thật trên browser — đừng chỉ đọc code hoặc tin cấu hình
  đúng trên giấy. Lưu ý công cụ browser tool: toạ độ click phải lấy từ `read_page`/`find` (ref),
  KHÔNG áng chừng toạ độ từ ảnh chụp — screenshot-space và viewport-space có thể không khớp 1:1,
  suýt bị hiểu nhầm thành bug thật khi test GĐ2 (chọn dropdown "Chuyên mục cha" không cập nhật).
- Đừng để form "giả vờ đã lưu" khi thực ra chưa có backend support (vd storage GĐ2→GĐ3) —
  luôn ghi chú rõ giới hạn cho người dùng (ADR-018).

## Con trỏ nhanh
- Brief: `00-projectbrief.md` · Kiến trúc: `01-architecture.md` · Stack: `02-techContext.md`
- Roadmap+model: `03-roadmap.md` · Tiến độ: `04-progress.md` · Quyết định: `05-decisions.md`
- **Quy tắc code riêng + bẫy kỹ thuật: `11-coding-rules.md`** (tạo ở GĐ7 — đọc trước khi sửa code)
- Tài liệu bàn giao (ngoài memory-bank): `docs/danh-gia-an-ninh.md` · `docs/api-overview.md`
  · `docs/quy-trinh-noi-bo.md` · `docs/devops-handoff.md`
- Quy chuẩn backend BẮT BUỘC: skill `misa-backend-standard`
