# AMIS Kho phim — Decision Log (ADR rút gọn)

> Ghi lại quyết định kiến trúc quan trọng + lý do. Thêm mục mới ở trên cùng.

> ⚠️ **ĐỌC TRƯỚC — trong repo này có HAI phương án RBAC nằm trên HAI NHÁNH SONG SONG.** Các
> ADR đánh dấu `[RBAC4]` (ADR-040 → 044) chỉ đúng trên nhánh `phan-quyen-4-cap` (**nhánh hiện
> tại của file này**); các ADR đánh dấu `[RBAC3]` (ADR-045 → 047) chỉ đúng trên nhánh
> `phan-quyen-3-cap` — không có trong file này. Người dùng đang so sánh hai bản để chọn một;
> chưa nhánh nào merge vào `main`.
>
> **ADR-048 và ADR-049 KHÔNG gắn nhãn nhánh** — đây là bug/UX chung, đã áp dụng y hệt trên
> CẢ HAI nhánh.
>
> **ADR-050 (nháp localStorage) chưa gắn nhãn nhánh nhưng HIỆN MỚI CÓ TRÊN `phan-quyen-4-cap`**
> — là bug bảo mật chung, cần port sang `phan-quyen-3-cap` ở đợt sau. **ADR-051 gắn `[RBAC4]`**
> vì phụ thuộc `FILM_WRITE_ROLES` của mô hình 4 cấp.

## ADR-071 — 2 biến môi trường TƯƠNG THÍCH THÊM cho triển khai Cloud Run (không đổi hành vi cục bộ)
- **Bối cảnh:** Deploy bản test lên Google Cloud Run (xem `docs/devops-handoff.md` §0a). Hai
  chỗ code giả định môi trường Docker Compose cục bộ, không chạy được nguyên trạng trên
  Cloud Run: (1) `db-options.ts` nối MySQL qua TCP `host:port` — Cloud SQL trên Cloud Run
  khuyến nghị nối qua Unix socket `/cloudsql/INSTANCE_CONNECTION_NAME` (tự mount khi deploy có
  `--add-cloudsql-instances`), an toàn hơn TCP public IP; (2) `storage.service.ts` luôn tự ráp
  `http://${host}:${port}` cho endpoint MinIO nội bộ — trên Cloud Run, MinIO chạy sau HTTPS
  cổng 443 mặc định, không có cổng tuỳ ý như container Docker.
- **Quyết định:** Thêm 2 biến môi trường TUỲ CHỌN, có fallback về hành vi cũ nếu KHÔNG đặt:
  `DB_SOCKET_PATH` (đặt thì dùng `socketPath` thay vì `host`/`port`) và `MINIO_ENDPOINT_URL`
  (đặt thì dùng thẳng làm endpoint nội bộ, bỏ qua `MINIO_ENDPOINT`/`MINIO_PORT`). Không sửa gì
  ở `docker-compose.yml`/`.env.example` — 2 biến này không được đặt ở đó nên Docker cục bộ chạy
  y hệt trước giờ.
- **Không đổi `MINIO_PUBLIC_ENDPOINT`** — biến này vốn đã nhận URL đầy đủ có scheme ngay từ
  đầu (`http://localhost:9200` mặc định), không cần thêm biến mới.

## ADR-070 — Reverse proxy Cloud Run thay `nginx/nginx.conf` cục bộ bằng image riêng bake sẵn hostname
- **Bối cảnh:** Bản Docker Compose cục bộ dùng 1 file `nginx/nginx.conf` gắn qua volume, trỏ
  upstream tới `frontend`/`backend` bằng DNS nội bộ Docker (`server frontend:80`). Cloud Run
  không có mạng nội bộ như vậy và không cho mount volume ngoài image — mỗi service là 1 URL
  HTTPS công khai (hoặc nội bộ IAM) riêng biệt, phân biệt nhau bằng SNI/Host header trên cùng
  hạ tầng frontend của Google, không phải bằng cổng/IP.
- **Quyết định:** Thư mục mới `nginx-cloudrun/` — `Dockerfile` build từ `nginx:1.27-alpine`,
  COPY thẳng 1 bản `nginx.conf` đã ĐIỀN SẴN hostname thật của 2 Cloud Run service kia (biết
  được sau khi deploy backend/frontend, không cần envsubst runtime vì hostname cố định suốt
  vòng đời service). Mỗi `location` set `Host` header đúng hostname đích + bật
  `proxy_ssl_server_name`/`proxy_ssl_name` (bắt buộc để GFE — Google Front End — route đúng
  service theo SNI) + `resolver 8.8.8.8` (DNS `*.run.app` không có trong resolver mặc định của
  image nginx gốc). Giữ đúng 3 route như bản cục bộ: `/api/` + `/media/` → backend (thêm
  `proxy_buffering off` + forward `Range`/`If-Range` cho `/media/` y hệt bản gốc, phục vụ
  seek video), `/` → frontend.
- **KHÔNG đụng `nginx/nginx.conf` gốc** — file đó vẫn phục vụ đúng mục đích Docker Compose cục
  bộ, `nginx-cloudrun/` là bản riêng chỉ dùng khi deploy Cloud Run.
- **Chỉ dùng cho bản TEST** — xem giới hạn đầy đủ ở `docs/devops-handoff.md` §0a (MinIO không
  có ổ đĩa bền, CORS mở `*`).

## ADR-068 — Kệ mobile đổi từ thẻ cuộn ngang → danh sách dòng dọc kiểu YouTube [GĐ8-D]
- **Bối cảnh:** Người dùng gửi ảnh so sánh với app AMIS Mobile thật và YouTube: kệ chuyên mục
  bản mobile (thẻ ảnh lớn cuộn ngang, mượn ý tưởng Netflix từ đợt 2 việc 14) "nhìn hơi xấu" so
  với danh sách DỌC từng dòng (thumbnail nhỏ bên trái, chữ bên phải) quen thuộc hơn trên di
  động — đúng như trang chủ kênh YouTube.
- **Quyết định:** Thêm biến thể `variant="row"` cho `FilmCardMobile.vue` — thumbnail 124px
  16:9 bên trái, bên phải CHỈ 3 trường người dùng yêu cầu: tên phim (2 dòng), nhãn "Phim mới",
  ngày đăng (KHÔNG nhồi hashtag/lượt xem/chuyên mục như biến thể `list` — đây là danh sách để
  lướt nhanh, không phải thẻ chi tiết). Vẫn giữ nút "⋯" Sửa/Xoá bên phải, đặt tuyệt đối để
  không kéo giãn chiều cao dòng. `CategoryShelves.vue` đổi `MAX_PER_SHELF` thành `computed`:
  mobile = 3 phim mới nhất/kệ (danh sách dọc 12 dòng sẽ đẩy kệ sau quá xa), desktop giữ 12.
  Container đổi từ `overflow-x-auto` (cuộn ngang) sang `flex-col divide-y` (danh sách dọc,
  không cuộn riêng — cuộn theo trang).
- **"Xem tất cả" GIỮ NGUYÊN hành vi cũ** (set `categoryFilter` → hiện lưới đầy đủ đúng cấu
  trúc dùng ở trang chủ khi có lọc, tức thẻ `FilmCardMobile` biến thể `list` — xem ADR-063) —
  người dùng xác nhận muốn giữ y hệt, chỉ đổi phần XEM TRƯỚC (3 phim/kệ) chứ không đổi phần
  xem đầy đủ.
- **Chỉ mobile.** Desktop (`FilmCard.vue` + hàng cuộn ngang trong `CategoryShelves.vue`) giữ
  NGUYÊN — người dùng không phàn nàn về bản desktop. **Chưa port sang `phan-quyen-3-cap`.**

## ADR-069 — Ô "Lượt xem"/"Lượt tải" gộp nhãn+số về 1 dòng [GĐ8-D]
- **Bối cảnh:** Trang Xem phim mobile, 2 ô KPI xếp `dt` (icon+nhãn) và `dd` (số liệu) thành 2
  dòng riêng trong cùng ô — người dùng phản hồi xuống dòng nhìn xấu.
- **Quyết định:** Đổi layout mỗi ô sang `flex items-center justify-between` 1 dòng: icon+nhãn
  bên trái, số liệu bên phải (căn phải, `shrink-0`) — giống mẫu chip số liệu phổ biến, không
  cần 2 dòng vì cả nhãn lẫn số đều ngắn.
- **Chỉ mobile** (`FilmDetailMobileView.vue`) — desktop không có ô KPI dạng này.

## ADR-067 — Thanh bộ lọc chuyển lên ĐẦU trang, tách khỏi khối lưới/kệ [GĐ8-D]
- **Bối cảnh:** Sau ADR-063 (ẩn lưới khi chưa lọc), thanh bộ lọc (dropdown chuyên mục + switch
  "Chỉ hiển thị phim mới") vẫn nằm bên TRONG cùng khối trắng với kệ chuyên mục — khi có nhiều
  kệ, thanh này bị đẩy xuống tít cuối trang, phải cuộn hết mới thấy để bật lọc. Người dùng
  chụp ảnh phản hồi đúng chỗ này.
- **Quyết định:** Tách thanh bộ lọc ra thành khối card riêng, đặt CỐ ĐỊNH ngay trên cùng khu
  vực nội dung (trước cả kệ chuyên mục). Khối lưới đầy đủ + phân trang (chỉ hiện khi
  `hasActiveFilter`) tách thành card riêng thứ hai, nằm SAU kệ chuyên mục. Bỏ luôn dòng gợi ý
  "Chọn chuyên mục..." vì giờ thanh bộ lọc đã luôn thấy ngay, không cần giải thích nữa.
- **Chỉ desktop (`FilmListView.vue`)** — bản mobile không bị lỗi này vì bộ lọc (ô tìm kiếm +
  hàng ô chuyên mục + chip đang lọc) vốn đã nằm ở đầu màn hình theo thiết kế GĐ8-B.
- **Chưa port sang `phan-quyen-3-cap`.**

## ADR-066 — `MButton` bỏ sót forward prop `type` → nút "Đăng nhập" không submit được [GĐ8-D]
- **Bối cảnh:** Kiểm chứng lại fix Kho phim (ADR-063) cần đăng nhập trước — phát hiện KHÔNG
  bấm được nút "Đăng nhập" (không có request nào tới `/auth/login`, kể cả bấm chuột lẫn Enter).
  Root cause: `MButton.vue` hard-code `type="button"` trên `<button>` gốc và KHÔNG khai báo
  prop `type`, nên `<MButton type="submit">` ở `LoginView.vue` chỉ rơi vào fallthrough attrs —
  thực nghiệm xác nhận giá trị hard-code trong template thắng, nút luôn là `type="button"` bất
  kể ngoài truyền gì. Bug này lộ ra ĐÚNG SAU khi một đợt trước gỡ `@click="submit"` dự phòng
  trên nút này để tránh double-submit (dựa vào `type="submit"` tự nhiên submit form) — tức từ
  lúc đó nút Đăng nhập đã hỏng hoàn toàn qua UI, chỉ chưa ai thử lại bằng click thật.
- **Quyết định:** Thêm prop `type` (`'button' | 'submit' | 'reset'`, mặc định `'button'`) vào
  `MButton.vue`, bind `:type="type"` thay vì hard-code — khai báo tường minh thay vì dựa vào
  hành vi merge attribute không rõ ràng của Vue.
- **Ảnh hưởng:** Sửa tại 1 file dùng chung → mọi nút `type="submit"` khác trong app (nếu có)
  cũng được khắc phục theo, không cần rà từng chỗ gọi `MButton`.
- **Chưa port sang `phan-quyen-3-cap`** — cùng nhóm với các bug UI chung khác đang chờ đợt port.

## ADR-063 — Ẩn danh sách phẳng khi CHƯA lọc, tránh hiện trùng phim với kệ chuyên mục [GĐ8-D]
- **Bối cảnh:** Người dùng chụp ảnh phản hồi: trang Kho phim hiện cùng lúc (1) các kệ ngang
  theo chuyên mục và (2) lưới TOÀN BỘ phim + phân trang ngay bên dưới — phim đã có mặt ở kệ lại
  xuất hiện thêm lần nữa trong lưới, gây cảm giác trùng lặp/rối mắt dù đúng theo thiết kế cũ
  của ADR-056 (kệ để lướt nhanh, lưới để lọc/xem hết).
- **Quyết định (người dùng chọn qua AskUserQuestion):** Theo mô hình YouTube — mặc định
  (`!hasActiveFilter`) CHỈ hiện kệ chuyên mục; lưới đầy đủ + phân trang chỉ xuất hiện khi người
  dùng chọn 1 chuyên mục, bật "Chỉ hiển thị phim mới", hoặc gõ từ khoá tìm kiếm. Thanh bộ lọc
  (dropdown chuyên mục + switch) vẫn LUÔN hiển thị — đó chính là cách bật `hasActiveFilter`.
  Chưa lọc gì thì thay lưới bằng 1 dòng gợi ý: *"Chọn chuyên mục hoặc bật 'Chỉ hiển thị phim
  mới' để xem danh sách đầy đủ tại đây."*
- **Áp dụng cả 2 view:** `FilmListView.vue` (desktop) và `FilmListMobileView.vue` (mobile) —
  cùng bug, cùng `hasActiveFilter` từ `useFilmListFilters.ts` dùng chung, sửa đồng thời để
  không lệch nhau như bài học cũ với `FilmCard`.
- **Chưa port sang `phan-quyen-3-cap`.**

## ADR-065 — Mật độ CHẠM đặt ở TẦNG TOKEN, không sửa từng component [GĐ8-C]
- **Bối cảnh:** Quét toàn dải viewport phát hiện màn "Thêm phim" ở Compact có hàng loạt vùng
  chạm dưới chuẩn: MInput 34px, MSelect 36px, MButton 32px, nút Back 32px, chip gợi ý hashtag
  21px. `mobile-pwa.md` §5 yêu cầu tối thiểu 48x48px trên màn cảm ứng.
- **Quyết định:** Thêm một khối `@media (max-width: 599.98px)` trong `assets/mds/tokens.css`
  đẩy `--mds-btn-height` và `--mds-input-height` lên 44px. MButton/MInput/MSelect đều đọc đúng
  hai biến này nên một khối media query xử lý toàn bộ.
- **Vì sao không sửa chiều cao trong từng component:** sẽ phải đụng 4-5 file MDS dùng chung và
  mỗi màn hình mới sau này lại phải nhớ tự xử lý. MDS vốn đã có cơ chế mật độ (`data-density`
  compact/medium/comfortable) — đây chỉ là thêm một nấc mật độ nữa, đúng cơ chế sẵn có.
- **Cố ý cho chạm THẮNG lựa chọn mật độ của người dùng:** khối mới có cùng độ đặc hiệu (0,1,1)
  với `:root[data-density=...]` nhưng đứng SAU nên thắng. Mật độ là tuỳ chọn thị giác; ngưỡng
  chạm là điều kiện bấm trúng — dưới 600px thì điều kiện bấm trúng ưu tiên hơn.
- **`599.98px` chứ không phải `599px`:** ngưỡng Compact ở JS là `innerWidth < 600`; zoom trình
  duyệt/DPI lẻ cho bề rộng thập phân, `max-width: 599px` sẽ trượt dải 599.x và làm CSS lệch pha
  với view mà router đã chọn.
- **Ngoại lệ phải xử lý riêng** (không đọc token chiều cao): nút Back của `FilmUploadView`, nút
  X đóng của `MDrawer`/`MDialog` (24px), chip gợi ý hashtag — đều dùng biến thể `sm:` để chỉ
  phóng ở màn hẹp.

## ADR-064 — Ở Medium ÉP sidebar về rail; master-detail xếp dọc theo CONTAINER query [GĐ8-C]
- **Bối cảnh:** Sửa xong bản mobile của Chuyên mục thì phát hiện đúng lỗi đó vẫn còn ở
  **600x960** (tablet dọc, Medium): sidebar 200px + cây 320px không còn chỗ cho cột chi tiết,
  chữ lại vỡ từng ký tự. Người dùng chỉ chụp được ở điện thoại, nhưng nguyên nhân giống hệt.
- **Quyết định A — shell:** `App.vue` ép `collapsed = true` khi `sizeClass === 'medium'`
  (600-839px), người dùng không mở rộng lại được ở dải này. Theo `mobile-pwa.md` §3: "Medium ưu
  tiên navigation rail 56px" + "Không cố giữ sidebar nếu phần nội dung chính còn quá hẹp".
  Trạng thái người dùng tự chọn (`collapsedByUser`) vẫn giữ nguyên cho Expanded/Large.
- **Quyết định B — CategoryView:** hai pane chỉ nằm cạnh nhau khi còn chỗ, dùng
  `@container` + `@[720px]:flex-row`. Dưới ngưỡng đó xếp DỌC (cây trên, form dưới).
- **Vì sao container query chứ không media query:** cái quyết định cột chi tiết còn bao nhiêu
  pixel là bề rộng VÙNG NỘI DUNG, không phải bề rộng viewport — sidebar rail hay mở rộng làm
  vùng này chênh nhau 150px trong khi viewport không đổi. Đo đúng thứ cần đo.

## ADR-063 — Chuyên mục ở Compact: danh sách cây MỘT CỘT + bottom sheet, bỏ master-detail [GĐ8-C]
- **Bối cảnh (bug thật, người dùng chụp màn hình):** `/categories` ở Compact vẫn render nguyên
  `CategoryView.vue` — master-detail 2 cột với cây ghim cứng `w-[320px]`. Ở 390px cột chi tiết
  chỉ còn vài chục pixel: chữ xuống dòng TỪNG KÝ TỰ trong một dải dọc sát mép phải, kèm thanh
  cuộn riêng. Đây là màn cấp một duy nhất chưa có bản mobile sau GĐ8-A/B.
- **Quyết định:** Thêm `CategoryMobileView.vue`, gắn vào route qua `lazyResponsiveView`
  (ADR-058). Bố cục: danh sách cây MỘT CỘT (cha có chevron mở/thu, con thụt lề 16px/cấp, dòng
  cao 56px), bấm một mục mở BOTTOM SHEET thêm/sửa (`MDrawer position="bottom"`,
  `mobile-pwa.md` §4.5) thay cho panel chi tiết cố định bên cạnh. Nút "Thêm" giữ góc trên phải,
  đưa vào slot `actions` mới của `MobileHeroHeader`.
- **Không đụng RBAC:** dùng lại đúng ba helper `canCreateAnyCategory` / `isSystemAdmin` /
  `canWriteCategory` — không có bản sao quy tắc riêng cho mobile. Đã kiểm thật cả hai vai:
  Cấp 2 bị ép chọn cha (tạo được chuyên mục con, chặn tạo gốc kèm lời giải thích), Cấp 4 để
  trống cha thì tạo chuyên mục lớn.
- **Chevron là nút RIÊNG, tách khỏi vùng bấm mở form:** mở/thu nhánh và mở form sửa là hai ý
  định khác nhau; gộp một vùng bấm thì không thu gọn được nhánh mà không mở nhầm form.

## ADR-062 — Bottom nav 4 mục + FAB; điểm đến dôi ra dồn vào màn "Tài khoản" [GĐ8-B]
- **Quyết định:** Ở Compact, bottom nav chứa TỐI ĐA 4 mục điều hướng cộng một FAB tròn ở
  giữa. "Thêm phim" KHÔNG còn là một tab — nó là FAB (hành động, không phải điểm đến), chỉ
  hiện với người có `canCreateFilm`. Thứ tự mục: Kho phim → Phim tôi quản lý ("Của tôi") →
  Chuyên mục → Tài khoản, lọc theo đúng `sidebarItems` (RBAC không viết lại). Các điểm đến
  còn lại của Cấp 3/Cấp 4 (Báo cáo, Quản lý phòng ban, Quản trị người dùng) nằm trong nhóm
  "Quản trị" của màn Tài khoản.
- **Lý do:** `mobile-pwa.md` §3 cho phép bottom nav khi có tối đa 5 điểm đến cấp một. Sidebar
  Cấp 4 có 7 mục — nhồi hết vào thanh dưới thì nhãn bị cắt cụt và vùng chạm co lại dưới
  chuẩn. Đẩy nhóm quản trị (ít dùng trên điện thoại) vào màn Tài khoản giữ được cả hai.
- **Ghi chú:** Màn CẤP HAI có nút Back riêng (`film-detail`, `upload`) thì ẩn hẳn bottom nav
  để đè lên trên như app di động; các màn quản trị ở Compact vẫn là bản desktop KHÔNG có nút
  back nên PHẢI giữ bottom nav làm lối thoát (xem `SECOND_LEVEL_ROUTES` trong `App.vue`).

## ADR-061 — Ẩn hẳn header MDS ở Compact: ngoại lệ CÓ CHỦ ĐÍCH với header-bar.md [GĐ8-B]
- **Quyết định:** Ở window size class **Compact (<600px)**, AMIS Kho phim **ẩn hoàn toàn
  `MHeaderBar`** (thanh brand 9 chấm / tìm kiếm / chuông / avatar). Thay vào đó mỗi màn cấp
  một tự dựng thanh đầu trang riêng (`components/mobile/MobileHeroHeader.vue`), màn cấp hai
  dùng `MMobileTopBar` với nút Back. **Chỉ áp dụng cho Compact** — Medium/Expanded/Large giữ
  NGUYÊN header MDS + sidebar như trước, không đổi một pixel.
- **Lý do:** Quy chuẩn `references/patterns/header-bar.md` yêu cầu mọi web app MISA độc lập
  phải có header MDS, và giả định người dùng mở app bằng **link trình duyệt**. Giả định đó
  KHÔNG đúng với Kho phim trên điện thoại: người dùng xác nhận họ **không bao giờ** mở Kho
  phim bằng link trần trên mobile, mà luôn bấm icon Kho phim trong app **AMIS Mobile** (y như
  Chat / Chấm công / OneAI). Tức trên mobile Kho phim **luôn chạy nhúng**, và app mẹ đã có
  chrome riêng của nó. Chồng thêm một thanh brand thứ hai bên trong không thêm chức năng nào
  mà chỉ tạo đúng cảm giác "web thu nhỏ" mà người dùng đã bác bỏ ở Giai đoạn A.
- **Coi `isCompact` ≈ "đang nhúng":** trước đây chỉ `isEmbedded()` (query `?embedded=1`) mới
  ẩn chrome. Nay điều kiện ẩn header là `isCompact`, vì thực tế mọi ngữ cảnh Compact đều là
  ngữ cảnh mobile/nhúng. `isEmbedded()` vẫn giữ nguyên tác dụng cho trường hợp nhúng ở kích
  thước lớn hơn Compact (`isChromeless` trong `App.vue`).
- **Chức năng của header đã bù ở đâu:**
  | Chức năng cũ trong header | Bù ở đâu (Compact) |
  |---|---|
  | Ô tìm kiếm toàn cục | Ô tìm kiếm ngay trong `FilmListMobileView` (trong hero header) |
  | Chuông thông báo | Chuông trên hero header màn Kho phim **và** mục "Thông báo" trong màn Tài khoản — cả hai mở đúng `NotificationsPanel` full-screen đã có |
  | Avatar → Đổi mật khẩu / Đăng xuất | Màn "Tài khoản" (`/account`, tab cuối bottom nav) |
  | Nút 9 chấm chuyển ứng dụng | **KHÔNG bù** — app mẹ AMIS Mobile đã có |
  | Cụm AVA / Chat / Trợ giúp / Thiết lập | **KHÔNG bù** — vô nghĩa khi nhúng; Kho phim cũng chưa có tính năng thật đứng sau chúng |
- **Đánh đổi / rủi ro:** nếu sau này Kho phim thực sự được phát hành như một web app mobile
  ĐỘC LẬP (mở bằng link, không qua AMIS Mobile), người dùng sẽ mất nút chuyển ứng dụng và
  cụm tiện ích chung. Khi đó phải xem lại ADR này chứ không vá thêm. Điều kiện kích hoạt việc
  xem lại: có yêu cầu chia sẻ link Kho phim để mở trực tiếp trên điện thoại.

## ADR-060 — Vùng chạm 48px xử lý TẠI CHỖ DÙNG, không sửa MButton toàn cục [GĐ8]
- **Quyết định:** Các control trong màn mobile được nâng lên vùng chạm 48px bằng class
  `min-h-12` đặt tại nơi dùng (`MButton class="min-h-12"`), KHÔNG thêm quy tắc
  `@media (pointer: coarse)` vào chính `MButton`. Ba ngoại lệ có sửa tại component vì không
  chạm tới được từ view cha: `MDropdownMenu` (menu teleport ra `body`), `MInput`/`MTextarea`
  (font nhập liệu 16px chống iOS tự zoom — `mobile-pwa.md` §5), `MTree` (chỉnh qua `:deep`
  trong màn mobile, có bọc `@media (pointer: coarse)`).
- **Lý do:** `MButton` cao 32px là mật độ MDS desktop, dùng ở hàng trăm chỗ kể cả trong bảng
  dày. Một quy tắc coarse-pointer toàn cục sẽ làm mọi nút trong MỌI màn (kể cả bản desktop
  xem trên laptop cảm ứng) cao lên 48px — thay đổi diện rộng không kiểm soát được trong phạm
  vi Giai đoạn A.
- **Đánh đổi:** phải nhớ thêm `min-h-12` ở từng chỗ dùng trong màn mobile; bù lại bản desktop
  chắc chắn không đổi một pixel nào.

## ADR-059 — Thao tác trên thẻ phim mobile gom vào menu "⋯", bỏ hẳn cơ chế hover [GĐ8]
- **Quyết định:** `FilmCardMobile` hiện nút "⋯" LUÔN NHÌN THẤY ở góc ảnh bìa; trong đó có
  Copy link theo từng nguồn + Sửa/Xoá (chỉ khi `canManageFilm` cho phép). Bản desktop
  (`FilmCard`) giữ nguyên kiểu hiện nút khi rê chuột.
- **Lý do:** `mobile-pwa.md` §1 cấm để chức năng quan trọng phụ thuộc hover — màn cảm ứng
  không có trạng thái đó, nút Sửa/Xoá của bản desktop sẽ KHÔNG BAO GIỜ hiện ra trên điện
  thoại. Ngoài ra bản desktop dàn 2-4 nút chữ "YouTube/Vimeo/…" để copy link; ở 320px hàng đó
  chắc chắn ngắt dòng, nên chuyển thành mục trong menu.
- **Chốt an toàn:** danh sách mục menu dựng từ ĐÚNG helper `canManageFilm` mà desktop dùng —
  không có bản sao quy tắc RBAC riêng cho mobile. Backend vẫn là nơi kiểm quyền thật.

## ADR-058 — "1 route, 2 view": cùng URL, đổi component theo window size class [GĐ8]
- **Quyết định:** Mỗi route chính giữ ĐÚNG MỘT đường dẫn nhưng có hai component: bản desktop
  hiện có + bản mobile dựng riêng (hậu tố `Mobile`). Một resolver nhỏ
  (`lib/responsiveView.ts` → `lazyResponsiveView`) đặt ở `router/index.ts` chọn component
  theo `isCompact` của `useWindowSize()`. Phiên bản mobile KHÔNG phải bản desktop co giãn
  bằng CSS — là cây component độc lập, chỉ dùng chung store/API/business logic.
- **Lý do:** Yêu cầu là "cảm giác giống app native thật", mà bố cục native (bottom sheet lọc,
  player full-bleed, hành động gom vào "⋯", số liệu xếp dọc) khác bản desktop về CẤU TRÚC chứ
  không chỉ về khoảng cách — nhồi vào một template bằng breakpoint sẽ thành một file đầy
  `v-if="isCompact"` rất khó sửa.
- **Vì sao KHÔNG tách route riêng (vd `/m/films`):** link chia sẻ giữa máy tính và điện thoại
  sẽ không mở được cùng một chỗ, và lịch sử back/forward của trình duyệt sẽ lệch nhau. Đổi
  kích thước cửa sổ phải chỉ là đổi cách trình bày, không phải đổi địa chỉ.
- **Chống lệch logic:** phần lọc/phân trang Kho phim được tách ra composable dùng chung
  `useFilmListFilters.ts` (trước đây nằm thẳng trong `FilmListView.vue`); logic gom kệ theo
  chuyên mục vẫn dùng chung `CategoryShelves` qua prop `mobile`. Chỉ lớp TRÌNH BÀY được nhân
  đôi — mọi quy tắc nghiệp vụ vẫn tồn tại đúng một chỗ.
- **Đánh đổi:** đổi qua lại mốc 600px làm Vue unmount view cũ / mount view mới, nên màn chi
  tiết fetch lại phim một lần (backend đã dedupe lượt xem 30 phút nên không sai số liệu).
  Đây là thao tác hiếm (kéo resize cửa sổ), chấp nhận được.

## ADR-057 — Cấp 4 VẪN có mục "Phim tôi quản lý" (dù trùng nội dung Kho phim) [Đợt 2 · việc 6]
- **Quyết định:** Mục sidebar "Phim tôi quản lý" (`/my-films`) hiện với Cấp 2 trở lên, gồm cả
  Cấp 4 — với Cấp 4 nó liệt kê TOÀN BỘ kho phim, tức trùng dữ liệu với màn "Kho phim".
- **Lý do:** Cân nhắc phương án ẩn với Cấp 4 cho gọn, nhưng bỏ đi thì bốn cấp có bốn chỗ thao
  tác quản lý phim khác nhau — người hướng dẫn sử dụng phải giải thích "cấp 2/3 thì vào Phim
  tôi quản lý, cấp 4 thì vào Kho phim". Giữ lại thì một câu mô tả dùng chung cho mọi cấp.
  Hai màn KHÁC MỤC ĐÍCH dù Cấp 4 thấy cùng tập dữ liệu: "Kho phim" là màn DUYỆT (có kệ theo
  chuyên mục, lọc trưng bày, phân trang), "Phim tôi quản lý" là màn THAO TÁC (danh sách gọn,
  tổng lượt xem/tải ngay trên đầu, sửa/xoá nhanh).
- **Đánh đổi:** thêm một mục sidebar cho Cấp 4 mà họ có thể không dùng. Chấp nhận được vì
  sidebar hiện mới 7 mục, chưa tới ngưỡng phải gộp.
- **Chốt an toàn:** phạm vi do BACKEND quyết định (`GET /films?scope=managed`), FE còn một lớp
  nữa — thẻ phim nào `canManageFilm` trả false thì KHÔNG hiện nút Sửa/Xoá, chỉ xem.

## ADR-056 — Kệ theo chuyên mục chỉ hiện khi CHƯA lọc gì [Đợt 2 · việc 14]
- **Quyết định:** Trang Kho phim hiện "kệ ngang theo chuyên mục cha" ở TRÊN CÙNG, nhưng chỉ khi
  người dùng chưa chọn chuyên mục, chưa bật "chỉ phim mới" và chưa gõ từ khoá tìm kiếm. Chọn
  bất kỳ bộ lọc nào → kệ biến mất, chỉ còn lưới phim đã lọc như trước. Bấm "Xem tất cả" trên
  một kệ = chọn đúng chuyên mục cha đó ở bộ lọc (không điều hướng sang route khác).
- **Lý do:** Kệ là chế độ DUYỆT khi chưa biết mình muốn gì; lọc là chế độ TÌM khi đã biết. Để
  cả hai cùng lúc thì màn hình có hai câu trả lời khác nhau cho cùng một câu hỏi "phim nào
  đang được hiển thị", và người dùng phải cuộn qua vài kệ mới tới kết quả lọc của mình.
  Dùng lại chính bộ lọc sẵn có cho "Xem tất cả" (thay vì tạo route `/categories/:id`) giữ
  đúng một nguồn trạng thái, và người dùng bỏ lọc là quay lại kệ ngay.
- **Đánh đổi:** không chia sẻ được link tới "trang của một chuyên mục" vì trạng thái lọc không
  nằm trên URL. Đây là hạn chế có sẵn của bộ lọc hiện tại, không phải do việc này sinh ra;
  nếu sau cần chia sẻ link thì đưa bộ lọc lên query param một lượt cho cả trang.
- **Kỹ thuật:** mỗi kệ tối đa 12 phim, cuộn ngang nằm TRONG container của kệ (`overflow-x-auto`),
  không để tràn ngang cả trang — nguyên tắc bắt buộc từ GĐ6 (`mobile-pwa.md`). Chuyên mục chưa
  có phim nào thì không dựng kệ rỗng.

## ADR-055 — Ảnh bìa chuyển sang presigned PUT; gỡ hẳn đường multipart buffer RAM [Đợt 2 · việc 15]
- **Bối cảnh (đo được, không phải phỏng đoán):** `POST /films/:id/thumbnail` dùng
  `FileInterceptor` KHÔNG khai báo `storage` → multer mặc định `memoryStorage`, tức TOÀN BỘ
  file ảnh nằm trong RAM tiến trình Node cho tới khi xử lý xong. Giới hạn 15MB/ảnh, không có
  hàng đợi nào chặn số request đồng thời → N người đăng phim cùng lúc là N × 15MB trong RAM.
- **Quyết định:** Chọn hướng (b) của yêu cầu — bỏ hẳn luồng multipart, ảnh bìa nay xin
  `POST /films/:id/thumbnail-url` rồi trình duyệt PUT thẳng lên MinIO, GIỐNG HỆT video từ GĐ3.
  Backend không nhận byte ảnh nào nữa. **Endpoint cũ bị GỠ BỎ, không giữ song song** — để lại
  thì điểm nghẽn vẫn còn nguyên, chỉ là tạm không ai gọi.
- **Giữ nguyên mức kiểm tra, không đánh đổi bảo mật:** việc kiểm ảnh thật (magic bytes qua
  `image-size`) + tỷ lệ 16:9 + giới hạn 15MB chuyển sang `confirmVersion`, đọc **64KB ĐẦU**
  của object trên MinIO bằng GET có Range — đủ cho header JPEG/PNG/WebP mà không kéo cả file
  về. Ảnh không hợp lệ bị XOÁ khỏi MinIO ngay (đã kiểm: file trả 404 sau khi bị từ chối).
  `thumbnail_key` vẫn sinh 100% ở server, không nhận từ client.
- **Đánh đổi:** có một khoảng thời gian ngắn object "chưa được kiểm" nằm trên MinIO (giữa PUT
  và confirmVersion). Chấp nhận được: key là UUID server sinh, object chưa gắn vào phim nào,
  và bị xoá ngay khi kiểm trượt. Rủi ro còn lại là object mồ côi nếu client bỏ ngang giữa
  chừng — nên có job dọn định kỳ khi lên production (ghi nhận nợ kỹ thuật).
- **Bằng chứng:** `npm run test:concurrency:upload` — 30 request song song, ảnh bìa p95 = 81ms,
  video p95 = 84ms, 30/30 thành công, mỗi request một key riêng, RAM backend 50,7 → 61,0 MiB.

## ADR-054 — Đếm lượt tải KHÔNG dedupe, không cần khoá dòng [Đợt 2 · việc 8]
- **Quyết định:** Cột `films.download_count` + `POST /films/:id/download` chỉ chạy một câu
  `increment()` (`SET download_count = download_count + 1`). KHÔNG dedupe theo cửa sổ thời
  gian, KHÔNG giao dịch + khoá dòng, KHÔNG bảng chi tiết kiểu `film_views`.
- **Lý do — vì sao khác hẳn `recordView` (ADR-023/036):** hai chỉ số trả lời hai câu hỏi khác
  nhau. Mở trang xem phim là hành động có thể lặp VÔ TÌNH (F5, bấm back rồi vào lại) nên phải
  chống trùng; bấm "Tải xuống" là chủ đích rõ ràng, bấm hai lần nghĩa là tải hai lần và đó
  đúng là con số nghiệp vụ muốn biết. Race condition ở `recordView` sinh ra từ mẫu "đọc để
  quyết định rồi mới ghi" — ở đây KHÔNG có bước đọc quyết định nào, một câu `UPDATE ... SET
  x = x + 1` tự nó đã atomic dù gọi song song bao nhiêu lần.
- **Chống spam:** dựa vào rate limit toàn cục sẵn có, không thêm hàng rào riêng. App NỘI BỘ,
  mọi lời gọi đều đã đăng nhập và định danh được; tự thổi phồng lượt tải của chính mình không
  đem lại lợi ích gì. Nếu sau này số liệu bị nghi ngờ thì nâng cấp thành bảng `film_downloads`
  chi tiết (truy được AI tải, lúc nào) chứ không phải thêm dedupe.
- **Quyền:** endpoint KHÔNG gắn `@Roles` — Cấp 1 (người xem) hoàn toàn có quyền tải phim, họ
  chỉ không có quyền sửa/xoá. FE chỉ hiện nút khi phim có bản lưu trữ nội bộ
  (`links.storage`); phim chỉ có link ngoài thì các nguồn đó đã có nút mở/tải riêng.

## ADR-053 — Báo cáo mở cho Cấp 3, phạm vi phòng ban do SERVER ép [Đợt 2 · việc 5]
- **Quyết định:** `/reports` nay cho cả `dept_manager` (trước chỉ `super_admin`). Phạm vi dữ
  liệu KHÔNG do client quyết định: Cấp 3 luôn bị ép về `department_id` đọc từ DB, tham số
  `departmentId` họ gửi lên bị BỎ QUA hoàn toàn; Cấp 4 xem toàn công ty và chọn lọc được từng
  phòng. FE ẩn hẳn ô chọn phòng ban với Cấp 3 — nhưng đó chỉ là để giao diện không hứa điều
  làm không được, chốt chặn thật nằm ở `resolveDepartmentScope` phía server.
- **Lý do đảo lại quyết định cũ:** ADR trước để báo cáo ở mức hạn chế nhất vì đặc tả khi đó
  không nhắc quyền báo cáo của Trưởng phòng và báo cáo có PII (họ tên người upload). Nay người
  dùng yêu cầu tường minh, và rủi ro PII được khống chế bằng chính việc giới hạn phạm vi.
- **Cấp 3 CHƯA gán phòng ban → báo cáo RỖNG, không truy vấn gì.** Cố ý không để `null` rơi vào
  nhánh "không lọc phòng ban" — đó đúng chỗ một giá trị null bị hiểu nhầm sẽ rò toàn bộ dữ
  liệu công ty (cùng loại bẫy đã ghi ở `11-coding-rules` §3b).
- **Danh sách nhân viên để lọc lấy từ chính `summary` của báo cáo, KHÔNG gọi `/users`:**
  `/users` chỉ Cấp 4 gọi được nên Cấp 3 sẽ có ô lọc rỗng; và không cần kéo cả danh bạ công ty
  (có PII) về chỉ để đổ một dropdown.
- **Ba nhóm dữ liệu trong MỘT lần gọi** (`totals` / `summary` / `films`) thay vì ba endpoint:
  cả ba suy ra từ đúng một tập phim đã lọc, tách ra phải lặp lại y hệt bộ lọc ba lần và chắc
  chắn sẽ lệch nhau sau vài lần sửa. FE chia 3 tab để hiển thị.

## ADR-052 — Nhãn "Phim mới": tính ở BACKEND, chỉ bản mới nhất trong nhóm TRÙNG TIÊU ĐỀ [Đợt 2 · việc 9]
- **Bối cảnh:** trước đây nhãn suy hoàn toàn từ thời gian (`isFilmNew(publishedAt)` ở FE, hạn
  `NEW_FILM_TTL_DAYS`). Chưa hề có cơ chế nào xử lý phim trùng tên — đây là TÍNH NĂNG MỚI,
  không phải sửa bug. (Cơ chế "trùng tiêu đề → hỏi cập nhật bản mới" của GĐ5 là luồng khác:
  nó tạo `film_versions` cho CÙNG một phim, không sinh ra hai phim cùng tên.)
- **Quyết định:** thêm trường TÍNH TOÁN `PublicFilm.isNew`, đúng khi thoả ĐỒNG THỜI: (1) còn
  trong hạn `NEW_FILM_TTL_DAYS`, và (2) là bản mới nhất trong nhóm phim trùng tiêu đề.
  So tiêu đề sau `trim()`, KHÔNG phân biệt hoa/thường. Thứ tự "mới nhất" = `published_at` giảm
  dần, phá hoà bằng `id` giảm dần (bắt buộc phải phá hoà vì `published_at` chỉ tới NGÀY).
- **KHÔNG thêm cột trạng thái, KHÔNG cập nhật hàng loạt khi tạo phim.** Đã cân nhắc phương án
  "khi tạo phim trùng tên thì UPDATE các phim cũ set cờ": nó rẻ lúc đọc nhưng phải duy trì cờ
  ở BỐN chỗ (tạo, đổi tên khi sửa, xoá phim, cập nhật bản mới) — quên một chỗ là dữ liệu sai
  âm thầm, không ai phát hiện. Cách đang dùng không có trạng thái nào để lệch:
  - `list()`: danh sách vốn đã sắp "mới trước" nên phim ĐẦU TIÊN gặp trong mỗi nhóm tiêu đề
    chính là bản mới nhất → **0 truy vấn thêm**.
  - `getBySlug()`: 1 truy vấn lấy đúng 1 dòng, dựa trên index `idx_films_title` mới thêm.
- **Vì sao ở BE chứ không FE:** trang chi tiết chỉ tải ĐÚNG MỘT phim nên FE không thể biết kho
  còn phim nào trùng tên mới hơn. Tính ở FE sẽ đúng ở danh sách và SAI ở trang chi tiết — đúng
  loại lỗi khó phát hiện nhất. Đã GỠ `isFilmNew` khỏi FE để không còn hai nguồn sự thật.
- **Hệ quả đã kiểm và chấp nhận:** xoá phim mới nhất thì phim cũ cùng tên **được nhận lại nhãn**
  (đã kiểm trên trình duyệt). Đúng theo định nghĩa "bản mới nhất còn tồn tại", và là hệ quả tự
  nhiên của việc không lưu trạng thái.
- **Đánh đổi:** `list()` trả về TOÀN BỘ phim (không phân trang) nên cách này đúng và rẻ ở quy
  mô hiện tại. **Nếu sau này thêm phân trang thật ở SQL thì phải chuyển sang window function
  `ROW_NUMBER() OVER (PARTITION BY title ORDER BY published_at DESC, id DESC)`** — đã ghi lại
  ở đây để người sau không phải phát hiện lại.

## ADR-051 — Quyền ghi chuyên mục phân theo TẦNG (gốc = Cấp 4, con = Cấp 2 trở lên) [RBAC4]
- **Bối cảnh:** ADR-044 khoá mọi thao tác ghi chuyên mục ở Cấp 4. Người dùng thấy quá chặt: họ
  hình dung chuyên mục cha như "một album lớn", bên trong là các album nhỏ — việc mở một album
  nhỏ nên để nhân viên tự làm, chỉ khung album lớn mới cần quản trị duyệt.
- **Quyết định:** tách quyền theo `parentId` của bản ghi, thay vì một mức vai trò duy nhất:
  - `parentId == null` (chuyên mục GỐC) → **chỉ Cấp 4**. Đây là khung phân loại của cả công ty,
    sửa/xoá một cái ảnh hưởng toàn kho phim; xoá gốc còn cascade cả cây con.
  - `parentId != null` (chuyên mục CON) → **Cấp 2 trở lên**. Nằm gọn trong khung sẵn có, rủi ro
    thấp, không cần chờ quản trị.
  - Cấp 1 `viewer` vẫn không ghi được gì.
- **Chốt chặn:** `CategoriesService.assertCanWrite(actor, isRoot)`. `@Roles(...FILM_WRITE_ROLES)`
  ở controller chỉ loại Cấp 1 từ vòng ngoài — tầng của bản ghi phụ thuộc `parentId` trong
  body/DB nên KHÔNG biểu diễn được bằng `@Roles`. Cùng mô hình 2 lớp với
  `FilmsService.assertCanManage` (ADR-014).
- **`isRoot` luôn suy từ dữ liệu server tin được:** DTO khi tạo, bản ghi đã lưu khi sửa/xoá —
  không nhận cờ "đây là chuyên mục con" do client tự khai. `UpdateCategoryDto` cũng không cho
  đổi cha nên tầng của một chuyên mục là bất biến sau khi tạo.
- **Phía FE:** `canWriteCategory(role, isRoot)` trong `features/auth/permissions.ts` là bản sao
  của quy tắc này (sửa một bên phải sửa cả bên kia). Với Cấp 2/3, ô "Nằm trong chuyên mục" là
  **bắt buộc** và dropdown KHÔNG có mục "chuyên mục gốc" — `MSelect` chỉ render mảng `options`,
  `placeholder` là chữ hiển thị chứ không phải lựa chọn, nên root không thể chạm tới từ UI.
- **Ngõ cụt có chủ đích:** nếu hệ thống chưa có chuyên mục gốc nào, Cấp 2/3 không tạo được gì
  cho tới khi Cấp 4 tạo khung đầu tiên. Đúng thiết kế — nhưng phải hiện thông báo giải thích
  (`noParentAvailable`), không bỏ mặc form câm lặng.
- **Thay thế:** ADR-044 ở phần chuyên mục. Báo cáo/quản trị người dùng/phòng ban vẫn giữ Cấp 4.

## ADR-050 — Nháp form (localStorage) phải gắn `userId` vào khoá; nháp định dạng cũ bị dọn, không migrate
- **Bối cảnh:** người dùng test thật và phát hiện **rò dữ liệu giữa hai tài khoản**: nhập dở
  form "Thêm phim" bằng `nv2@`, đăng xuất, đăng nhập `superadmin@` rồi vào lại màn đó thì thấy
  nguyên nội dung nháp của `nv2`. Đã tái hiện đúng nguyên văn trên browser.
- **Nguyên nhân gốc:** khoá nháp là `kho-phim:film-draft:new|edit:<slug>` — **không có định
  danh người dùng**. localStorage theo origin chứ không theo phiên đăng nhập, nên mọi tài khoản
  dùng chung một máy đều đọc trúng cùng một khoá.
- **Quyết định:** khoá mới `kho-phim:film-draft-v2:<userId>:new|edit:<slug>`, dựng bởi hàm
  thuần `buildDraftKey(userId, editingSlug)` (`features/upload/draftKey.ts`) để unit test được
  mà không cần localStorage thật.
- **Chưa biết là ai thì trả `null`** và nơi gọi bỏ qua hẳn việc đọc/ghi nháp. KHÔNG được rơi về
  một khoá dùng chung — khoá dùng chung chính là lỗi đang sửa.
- **Không migrate nháp cũ, mà dọn hẳn** (`purgeLegacyDrafts`): nháp cũ không xác định được của
  ai, gán cho bất kỳ tài khoản nào cũng là tái tạo đúng lỗi rò. Nháp chỉ là tiện ích tạm nên
  mất đi chấp nhận được. Lưu ý khi dọn: tiền tố cũ `film-draft` là **tiền tố con** của tiền tố
  mới `film-draft-v2`, phải loại trừ tường minh kẻo xoá nhầm nháp hợp lệ.

## ADR-049 — Iframe YouTube/Vimeo phải tự đặt `referrerpolicy`, không sống được với `no-referrer` toàn site
- **Bối cảnh:** người dùng test thật báo mọi phim nguồn YouTube đều hiện *"Error 153 — Video
  player configuration error"*. Giả thuyết ban đầu (link demo giả/chủ video chặn nhúng) **SAI**.
- **Chẩn đoán bằng thực nghiệm A/B** ngay trên `localhost:8180`, hai iframe cạnh nhau:
  - ID thật của phim đang lỗi (`zJTiLOfBoHE`) + `referrerpolicy="strict-origin-when-cross-origin"`
    → **phát bình thường**.
  - ID công khai chắc chắn cho nhúng (`dQw4w9WgXcQ`) + KHÔNG có thuộc tính đó → **vẫn Error 153**.
  - ⇒ biến quyết định là **Referer**, không phải video.
- **Nguyên nhân gốc:** `nginx/nginx.conf` đặt `Referrer-Policy: no-referrer` cho toàn site. Khi
  iframe nhúng không gửi Referer, YouTube không biết tên miền nào đang nhúng nên từ chối khởi
  tạo player và trả Error 153 — với MỌI video, kể cả video hợp lệ hoàn toàn.
- **Quyết định:** đặt `referrerpolicy="strict-origin-when-cross-origin"` **trên chính 2 thẻ
  iframe** (YouTube + Vimeo) trong `VideoPlayer.vue`, KHÔNG nới header chung của nginx.
- **Lý do:** giữ nguyên mặc định riêng tư `no-referrer` cho toàn bộ phần còn lại của app; chỉ
  hai iframe player được gửi origin (không gửi đường dẫn đầy đủ) — đúng mức tối thiểu cần để
  YouTube xác thực tên miền nhúng.
- **Bẫy cho lần sau:** ai đó "dọn dẹp" thuộc tính này vì thấy thừa sẽ làm lỗi tái phát và rất
  khó lần ra (link vẫn đúng, video vẫn tồn tại). Đã ghi cảnh báo ngay trong comment đầu
  `VideoPlayer.vue`.

## ADR-048 — Nhập hashtag: tự lắp control từ MInput + MTag, KHÔNG nhồi hành vi mới vào MCombobox
- **Bối cảnh:** người dùng báo "hashtag không thêm được". Bug thật: `FilmUploadView.vue` dùng
  `<MCombobox allow-create>` nhưng **không lắng nghe sự kiện `@create`** → nhấn Enter không có
  gì xảy ra. Kèm theo đó người dùng chốt lại **yêu cầu nghiệp vụ mới**: gõ tự do, ngăn cách bằng
  dấu phẩy — `"MISA, Agentic AI"` phải ra **2** hashtag `#MISA` và `#Agentic AI`.
- **Quyết định:** KHÔNG vá `@create` cho MCombobox. Dựng control mới
  `frontend/src/components/HashtagInput.vue` **lắp ráp từ 2 control MDS có sẵn**: `MInput` (ô
  nhập) + `MTag closable` (chip đã chọn). Logic tách chuỗi nằm riêng ở
  `frontend/src/features/upload/hashtags.ts` (`parseHashtags`).
- **Lý do không dùng MCombobox:** combobox chuẩn MDS là control **CHỌN trong tập lựa chọn có
  sẵn** — một lần Enter = một lựa chọn. Nghiệp vụ này ngược lại: một lần commit sinh ra **nhiều**
  giá trị, và giá trị được phép **chứa khoảng trắng** ("Agentic AI"). Ép mô hình đó vào control
  dùng chung sẽ làm lệch hành vi chuẩn của MCombobox ở mọi màn khác đang dùng nó.
- **Vì sao vẫn đúng quy chuẩn MDS:** đây là "control chưa có trong bộ" → theo ưu tiên 1, lắp từ
  component `.vue` có sẵn, **không viết HTML thô** cho input/nút. Đề xuất bổ sung TagInput vào
  bộ MDS chung.
- **Quy tắc tách chuỗi (chốt):** chỉ `,` ngăn cách (khoảng trắng KHÔNG) · trim từng phần · bỏ
  phần rỗng · loại trùng không phân biệt hoa/thường (kể cả trùng với chip đã có) · bỏ `#` người
  dùng quen gõ kèm · giữ nguyên thứ tự gõ. Commit khi: gõ `,` · Enter · blur. Backspace ở ô rỗng
  xoá chip cuối. 9 test ở `hashtags.spec.ts`.
- **Không đụng Backend:** payload vẫn là `hashtags: string[]` như cũ.

## ADR-044 — Chuyên mục & báo cáo & quản trị người dùng thu về CHỈ Cấp 4 (hệ quả của việc bỏ `admin`) [RBAC4]
- **Quyết định:** `@Roles('super_admin')` cho `/users`, `/reports`, `/departments` và các route GHI của
  `/categories` (trước đây là `@Roles('super_admin','admin')`). Cấp 3 (`dept_manager`) **KHÔNG** có
  quyền quản trị tài khoản, chuyên mục hay báo cáo.
- **Lý do:** vai trò `admin` cũ đã bị loại bỏ và migrate sang Cấp 4 (ADR-041), nên quyền của nó đi
  theo Cấp 4. Đặc tả Cấp 3 chỉ mở rộng phạm vi sửa/xoá **PHIM** cùng phòng ban, không nhắc quyền
  quản trị nào — mở thêm cho Cấp 3 sẽ là tự suy diễn. Riêng chuyên mục còn có căn cứ độc lập:
  `02-security-baseline.md` §2 yêu cầu danh mục dùng chung toàn hệ thống giới hạn quyền ghi ở cấp cao
  nhất. Báo cáo là xuất dữ liệu hàng loạt có PII (§9) nên giữ mức hạn chế nhất.
- **Điểm cần xác nhận lại với người dùng:** nếu nghiệp vụ thật muốn Trưởng phòng xem được báo cáo
  **của phòng mình**, đó là yêu cầu mới (cần thêm bộ lọc theo `department_id` ở ReportsService) —
  cố ý KHÔNG làm trước khi có yêu cầu rõ ràng.

## ADR-043 — `departmentId` KHÔNG đưa vào JWT; đọc lại DB mỗi lần kiểm quyền [RBAC4]
- **Quyết định:** JWT payload giữ nguyên `{sub, email, role, type}`. Phòng ban của actor và vai trò
  của người tạo phim đều đọc từ bảng `users` qua `UsersService.getDepartmentId` /
  `getRoleAndDepartment` ngay tại thời điểm kiểm quyền (`FilmsService.assertCanManage`).
- **Lý do:** access token sống 15 phút. Nếu nhét phòng ban vào token, sau khi Cấp 4 chuyển một
  Trưởng phòng sang phòng khác thì **token cũ vẫn cho họ quản lý phim của phòng cũ tới khi token hết
  hạn** — đúng loại lỗ hổng "token cũ mang quyền cũ". Với dữ liệu quyết định phạm vi phân quyền,
  đọc DB là đánh đổi đúng theo nguyên tắc 1 (bảo mật > hiệu năng).
- **Chi phí đã cân nhắc:** thêm 1–2 câu SELECT theo khoá chính cho mỗi thao tác GHI phim (không ảnh
  hưởng đường đọc `GET /films`, vốn là đường nóng). Chấp nhận được.
- **Đã kiểm chứng bằng test thật:** có 1 ca e2e chuyển phòng ban của Trưởng phòng rồi dùng LẠI access
  token cũ → phải nhận 403 ngay.

## ADR-042 — Phạm vi 2 cột `department_id` / người tạo: snapshot ở `films`, truy vết ở `categories`, KHÔNG thêm vào bảng con [RBAC4]
- **Quyết định (theo yêu cầu tường minh "mỗi bản ghi dữ liệu chính phải biết thuộc phòng ban nào và
  ai tạo"), phạm vi áp dụng:**
  - `films`: giữ nguyên `uploader_id` (người tạo, không đổi tên) + **thêm `department_id` dạng
    SNAPSHOT** phòng ban của người tạo tại thời điểm tạo phim.
  - `categories`: thêm **cả** `created_by` và `department_id`, thuần TRUY VẾT.
  - `users`: thêm `department_id` (nullable).
  - `film_links`, `film_versions`, `hashtags`, `film_views`, `notifications`, `user_notifications`:
    **KHÔNG thêm**.
- **Lý do snapshot (không join động qua uploader):** (1) uploader có thể đổi phòng ban sau này, phim
  phải giữ đúng ngữ cảnh phòng ban **lúc được tạo**; (2) scope quyền Cấp 3 lọc trực tiếp trên cột này
  nên không cần join bảng `users` (có index `IDX_films_department`).
- **Lý do KHÔNG thêm vào bảng con:** chúng là bản ghi con luôn suy ra được phòng ban/người tạo qua
  `film_id`. Thêm cột trùng lặp chỉ tạo thêm đường để dữ liệu lệch nhau (denormalize không đổi lại
  được lợi ích gì, vì không có truy vấn nào cần lọc chúng theo phòng ban).
- **Lý do `categories` KHÔNG dùng để scope quyền:** chuyên mục là danh mục **dùng chung toàn công ty**,
  không phải nội dung sở hữu cá nhân/phòng ban. Quyền ghi giữ ở Cấp 4 (ADR-044). Hai cột mới chỉ
  phục vụ truy vết/kiểm toán đúng như yêu cầu, không thay đổi hành vi phân quyền.
- **GIỚI HẠN ĐÃ BIẾT của backfill:** migration backfill `films.department_id` từ phòng ban của uploader,
  nhưng khi chạy lần đầu trên DB hiện có thì `users.department_id` vừa được thêm nên **toàn bộ đang
  NULL** → mọi phim cũ có `department_id = NULL`, tức là **Cấp 3 KHÔNG quản lý được phim tạo trước khi
  phòng ban được gán**. Đây là hành vi an toàn (mặc định từ chối, không mặc định cho phép); muốn Cấp 3
  quản phim cũ thì Cấp 4 phải gán lại tường minh. Kèm theo: `null` KHÔNG được coi là "trùng null" khi
  so sánh phòng ban — nếu không, mọi Trưởng phòng chưa gán phòng ban sẽ quản được toàn bộ phim cũ.

## ADR-041 — Mapping dữ liệu vai trò CŨ → MỚI: `admin` cũ → Cấp 4 (KHÔNG phải Cấp 3) [RBAC4]
- **Quyết định:**
  - `employee` cũ → **Cấp 2 `employee`** (hành vi giống hệt, không đổi).
  - `super_admin` cũ → **Cấp 4 `super_admin`** (hành vi giống hệt).
  - `admin` cũ → **Cấp 4 `super_admin`**; dòng `admin` bị xoá khỏi danh mục `roles`.
  - **KHÔNG tài khoản nào tự động lên Cấp 1 hoặc Cấp 3** — hai cấp này hoàn toàn mới, Cấp 4 phải tự
    gán lại qua màn Quản trị người dùng (vì vậy mới bổ sung `PATCH /users/:id`).
- **Lý do mapping `admin` → Cấp 4:** hành vi THẬT của `admin` cũ là sửa/xoá được **MỌI phim toàn công
  ty** (`films.service.ts` bản cũ: `if (roleCode === 'super_admin' || roleCode === 'admin') return`)
  cộng quyền tạo tài khoản nhân viên. Cấp 3 chỉ sửa được phim **cùng phòng ban**, nên hạ `admin` xuống
  Cấp 3 là **thu hồi quyền âm thầm**. Cấp 4 là mức khớp hành vi cũ nhất.
- **⚠️ ĐÂY LÀ THAY ĐỔI QUYỀN THẬT trên tài khoản đang tồn tại** — đã nêu rõ trong báo cáo bàn giao để
  người dùng tự xác nhận lại. Trên DB dev hiện tại KHÔNG có tài khoản `admin` nào (chỉ 1 seed
  `super_admin`), nên thực tế không tài khoản nào bị ảnh hưởng; nhưng logic migration vẫn phải đúng
  cho mọi môi trường khác.
- **`down()` không đối xứng (nêu rõ, không giả vờ):** không thể phục hồi tài khoản nào TỪNG là `admin`
  vì thông tin đó đã bị ghi đè ở `up()`. `down()` chỉ trả lại danh mục `roles` cũ và hạ
  `viewer`/`dept_manager` về `employee` để không có tài khoản mang vai trò không tồn tại.

## ADR-040 — RBAC 4 CẤP CÓ SCOPE PHÒNG BAN, thay thế hoàn toàn `super_admin`/`admin`/`employee` [RBAC4]
- **Quyết định — tên `RoleCode` cuối cùng:**
  | Cấp | RoleCode | Nhãn | Quyền |
  |---|---|---|---|
  | 1 | `viewer` | Người xem | CHỈ xem. Không tạo/sửa/xoá phim |
  | 2 | `employee` | Nhân viên văn phòng | Cấp 1 + tạo phim + sửa/xoá phim **của chính mình** |
  | 3 | `dept_manager` | Trưởng phòng | Cấp 2 + sửa/xoá phim của **mọi Cấp 2 CÙNG phòng ban** |
  | 4 | `super_admin` | Quản trị cao nhất | Cấp 3 + mọi phòng ban + toàn bộ quyền quản trị hệ thống |
- **Lý do chọn tên:** tái dùng đúng `employee`/`super_admin` cho Cấp 2/Cấp 4 vì ngữ nghĩa đã khớp sẵn
  hành vi cũ → giảm xáo trộn và giảm số chỗ phải sửa. `viewer`/`dept_manager` là tên tự mô tả, nói rõ
  scope. Vai trò `admin` bị **loại bỏ hoàn toàn** thay vì đổi nghĩa — giữ lại tên `admin` với ngữ
  nghĩa mới là cách chắc chắn nhất để người đọc code sau này hiểu sai.
- **Nguồn sự thật DUY NHẤT:** `backend/src/modules/users/entities/role.entity.ts` (`RoleCode`,
  `ROLE_LEVEL`, `ROLE_NAME`, `ALL_ROLE_CODES`, `FILM_WRITE_ROLES`, `isAtLeastLevel`). Seed
  (`seed.service.ts`) đọc từ đây, không khai lại danh sách vai trò. Phía FE có bản sao gọn ở
  `frontend/src/features/auth/permissions.ts` (chỉ để ẩn/hiện nút).
- **LỖ HỔNG THẬT ĐÃ BỊT:** trước đợt này **KHÔNG có `@Roles` nào** trên `POST /films`,
  `POST /films/:id/upload-url`, `POST /films/:id/thumbnail`, `POST /films/:id/versions` → **mọi tài
  khoản đã đăng nhập đều tạo được phim**, kể cả vai trò thấp nhất. Nay 7 route GHI của `/films`
  (thêm cả `PATCH`/`DELETE` để phòng thủ nhiều lớp) đều gắn `@Roles(...FILM_WRITE_ROLES)`, Cấp 1 bị
  chặn NGAY Ở GUARD. `assertCanManage` là lớp thứ hai, không phải chốt duy nhất.
- **Quyết định về Cấp 3, cố ý KHÔNG mở rộng:** Cấp 3 chỉ quản phim do **Cấp 2** tạo (kiểm cả
  `uploader.roleCode === 'employee'`), KHÔNG tự động cho quản phim của Cấp 3 khác hay Cấp 4 cùng
  phòng. Bám đúng câu chữ đặc tả: "được quyền... chỉnh sửa của tất cả mọi người được phân quyền cấp
  2". Cấp 3 vẫn quản được phim của chính mình (kế thừa quyền Cấp 2).

## ADR-039 — Kiểm thử tích hợp dùng database RIÊNG, chạy dưới tài khoản ứng dụng (không root) [GĐ7 bổ sung]
- **Quyết định:** e2e chạy trên database `kho_phim_e2e` tách hẳn khỏi `kho_phim` của dev,
  `test/global-setup.ts` DROP + CREATE lại sạch mỗi lần chạy. Việc tạo database dùng tài
  khoản quản trị (root), nhưng **bản thân bộ test kết nối bằng tài khoản ứng dụng
  (`khophim`)** sau khi được GRANT quyền trên đúng database đó. Có chốt an toàn: nếu
  `E2E_DB_NAME` trỏ vào `kho_phim` thì throw ngay, không chạy.
- **Lý do:** `07-testing-strategy.md` §4 bắt buộc dữ liệu kiểm thử tách biệt hoàn toàn và
  dựng lại từ đầu mỗi lần. Chạy test dưới tài khoản ứng dụng (thay vì root cho tiện) để e2e
  phản ánh **đúng quyền hạn thật lúc vận hành** — nếu chạy bằng root, một lỗi kiểu "app thiếu
  quyền trên bảng X" sẽ không bao giờ lộ ra ở CI mà chỉ nổ ở production. Việc DROP database
  an toàn vì đây là DB riêng cho test, và chốt an toàn chặn nhầm lẫn.

## ADR-038 — CI GitHub Actions; cổng chặn audit đặt ở phạm vi production, ngưỡng critical [GĐ7 bổ sung]
- **Quyết định:** `.github/workflows/ci.yml` với 4 job (backend unit, backend e2e kèm service
  MySQL, frontend, audit). Job `audit` **chặn** khi `npm audit --omit=dev --audit-level=critical`
  thất bại; phần còn lại (gồm devDependency) chỉ in báo cáo, không chặn.
- **Lý do:** `13-devops-lifecycle.md` §1 quy định CI là **cổng chặn bắt buộc**, không phải
  bước tham khảo. Hai lựa chọn phạm vi đều có chủ đích: (1) `--omit=dev` vì devDependency
  không đi vào image production (Dockerfile cài `npm ci --omit=dev`) — chặn theo chúng là báo
  động giả làm người ta quen với CI đỏ; (2) ngưỡng `critical` thay vì `high` vì hiện còn 9 CVE
  mức high trong nhánh phụ thuộc NestJS 10 mà **mọi bản vá đều đòi nâng major** — đặt `high`
  ngay bây giờ khiến CI đỏ vĩnh viễn và mất hẳn tác dụng cảnh báo. Đã ghi TODO hạ ngưỡng
  xuống `high` sau khi nâng NestJS 11, ngay trong file workflow. **Lưu ý:** branch protection
  (bắt buộc CI xanh mới merge được) phải bật thủ công trên GitHub, workflow không tự ép được.

## ADR-037 — Ép múi giờ kết nối MySQL về UTC (`timezone: 'Z'`) [GĐ7 bổ sung]
- **Quyết định:** thêm `timezone: 'Z'` vào `dbOptions` (`db-options.ts`).
- **Lý do — LỖI THẬT phát hiện nhờ kiểm thử tích hợp:** trước đây driver mysql2 dùng múi giờ
  **cục bộ của tiến trình Node** để chuyển đổi giá trị DATETIME. Trong Docker cả backend lẫn
  MySQL đều chạy UTC nên trùng nhau và mọi thứ *có vẻ* đúng — nhưng khi tiến trình Node chạy ở
  múi giờ khác (máy dev VN +07), giá trị ghi/đọc lệch đúng 7 tiếng, làm **cửa sổ dedupe 30
  phút của `recordView` sai hoàn toàn** → cùng một người dùng bị tính lượt xem nhiều lần.
  Đúng cảnh báo ở `05-database-rules.md` §5 ("luôn lưu trữ theo UTC, không dựa vào múi giờ mặc
  định của máy chủ"). Unit test không bắt được (repository bị mock) và chạy trong Docker cũng
  không bắt được — chỉ kiểm thử tích hợp từ máy host mới lộ ra. Đã verify dữ liệu sẵn có đọc
  ra vẫn đúng sau khi đổi (giá trị trong DB vốn đã là UTC vì container chạy UTC).

## ADR-036 — `recordView` chạy trong giao dịch có khoá dòng phim [GĐ7 bổ sung]
- **Quyết định:** toàn bộ `FilmsService.recordView` bọc trong `manager.transaction`, đọc phim
  bằng `lock: { mode: 'pessimistic_write' }` TRƯỚC khi kiểm trùng, rồi mới insert `film_views`
  + `increment` view_count. Vẫn giữ `increment()` (không đọc-rồi-ghi) như ADR-023.
- **Lý do — RACE CONDITION THẬT, đã đo được:** bản cũ đọc `film_views` để quyết định có ghi
  hay không, nhưng câu đọc đó nằm NGOÀI giao dịch và không khoá gì. Khi cùng một người dùng
  gửi nhiều request song song, tất cả đều vượt qua bước kiểm trùng trước khi bất kỳ request
  nào kịp ghi bản ghi đầu tiên. Đo bằng `test/concurrency/record-view.concurrency.mjs`:
  **1 người dùng mới gửi 20 request song song làm `view_count` tăng 4 thay vì 1**; sau khi sửa
  tăng đúng 1. Đúng mẫu lỗi và đúng cách sửa quy định ở `05-database-rules.md` §3 ("câu đọc
  quyết định phải nằm trong cùng giao dịch và phải khoá dòng đang đọc").
- **Đánh đổi đã cân nhắc:** khoá theo dòng PHIM nên các lượt xem cùng một phim bị tuần tự hoá.
  Chấp nhận được vì giao dịch rất ngắn và mỗi người chỉ ghi 1 lần/30 phút cho mỗi phim — đúng
  thứ tự ưu tiên của quy chuẩn (đúng đắn dữ liệu trước, hiệu năng sau). Đo thực tế: 20 request
  song song từ 20 người dùng khác nhau vẫn cho kết quả đúng +20, không thấy chậm bất thường.

## ADR-035 — Nhật ký kiểm toán ghi ra stdout dạng hàm module, không phải bảng DB/service DI [GĐ7]
- **Quyết định:** `common/audit/audit-log.ts` export hàm `auditLog(event)` + `formatAuditEntry()`,
  ghi qua `Logger` của Nest ra stdout với tiền tố `[Audit]`. Ghi 10 loại sự kiện nhạy cảm theo
  02-security-baseline §7. Tự động che giá trị của khoá khớp
  `/pass|secret|token|key|hash|authorization|credential/i`. KHÔNG bao giờ ném lỗi ra ngoài.
- **Lý do (2 lựa chọn có chủ đích):**
  1. *stdout thay vì bảng `audit_logs`*: bảng riêng cần migration + chốt chính sách thời hạn
     lưu + cơ chế chống sửa đổi. Riêng yêu cầu "người bị điều tra không xoá được dấu vết"
     về bản chất phải giải quyết ở tầng hạ tầng (gom log tập trung, quyền chỉ-ghi), không
     phải tầng ứng dụng — làm bảng DB tạo cảm giác an toàn giả. Giới hạn này ghi rõ ngay
     trong docstring của file để người sau không tin nhầm (rủi ro R-06).
  2. *Hàm module thay vì service tiêm phụ thuộc (DI)*: đây là sink ghi log thuần, không giữ
     trạng thái, không phụ thuộc gì. Làm service sẽ buộc đổi constructor của `AuthService`,
     `UsersService`, `FilmsService`, `ReportsController` — vi phạm "phạm vi ảnh hưởng nhỏ
     nhất" và phá toàn bộ test đang dựng service bằng tham số vị trí, mà không đổi lại được
     lợi ích thực tế nào. Vẫn test được vì `formatAuditEntry` là hàm thuần.

## ADR-034 — Health check tách liveness/readiness; DataSource tiêm dạng `@Optional()` [GĐ7]
- **Quyết định:** `/api/health` (liveness) CỐ Ý không chạm DB; `/api/health/ready` (readiness)
  chạy `SELECT 1`, trả 503 khi DB không tới được. `DataSource` tiêm bằng `@Optional()`.
- **Lý do:** Theo 09-operations-reliability §1 — nếu liveness kiểm cả DB, khi DB chập chờn
  orchestrator sẽ hiểu nhầm tiến trình đã chết và restart vô ích trong khi lỗi thật nằm ở DB.
  `@Optional()` là bắt buộc vì chế độ `DB_ENABLED=false` (có từ GĐ0) không nạp TypeOrmModule
  nên không có DataSource để tiêm — không đánh dấu optional là gãy chính chế độ đó.
  Readiness cố ý KHÔNG trả thông điệp lỗi gốc của DB (tránh lộ chi tiết hạ tầng — baseline §5).

## ADR-033 — Rate limit chỉ áp cho AuthController, KHÔNG đăng ký ThrottlerGuard toàn cục [GĐ7]
- **Quyết định:** `ThrottlerModule.forRoot` khai báo ở `AppModule` nhưng KHÔNG đưa
  `ThrottlerGuard` vào `APP_GUARD`. Chỉ `AuthController` bọc `@UseGuards(ThrottlerGuard)`:
  login 10/phút/IP, refresh 30, SSO 10, đổi mật khẩu 10. Bật `trust proxy` để lấy đúng IP
  người dùng từ `X-Forwarded-For` do nginx set.
- **Lý do:** Route `/media/:key` phát video sinh RẤT NHIỀU request `Range` khi người dùng tua
  — giới hạn toàn cục sẽ làm gãy trình phát, tức đánh đổi "chịu lỗi" để lấy "bảo mật" ở một
  chỗ vốn không phải bề mặt brute force. Endpoint xác thực mới là bề mặt thật (baseline §8).
  **Nợ kỹ thuật đã ghi nhận (R-08):** bộ đếm nằm trong bộ nhớ tiến trình → chạy nhiều bản sao
  thì mỗi bản đếm riêng, cần store Redis dùng chung. Đã ghi vào devops-handoff.md.

## ADR-032 — Cổng chặn cấu hình là `ALLOW_INSECURE_CONFIG`, KHÔNG phải `NODE_ENV` [GĐ7]
- **Quyết định:** `assertSecureConfig()` chạy đầu `bootstrap()`, từ chối khởi động khi phát
  hiện secret mặc định/yếu. Nhưng điều kiện kích hoạt chế độ nghiêm ngặt là
  `NODE_ENV==='production' && ALLOW_INSECURE_CONFIG !== 'true'`, chứ không chỉ `NODE_ENV`.
- **Lý do — BẪY KỸ THUẬT quan trọng:** `backend/Dockerfile` pin sẵn `ENV NODE_ENV=production`
  và `docker-compose.yml` cũng đặt `NODE_ENV: production` cho **stack dev**. Nếu dùng riêng
  `NODE_ENV` làm cổng chặn thì chính stack dev hiện có sẽ không khởi động nổi — hardening
  làm gãy môi trường đang chạy là thất bại, không phải thành công. `ALLOW_INSECURE_CONFIG`
  là cờ RIÊNG BIỆT, đúng tinh thần baseline §1 ("cơ chế nới lỏng phải khoá bằng cờ riêng,
  không dùng chung cờ môi trường tổng quát"). Đặt `true` trong `.env.example` cho dev; XOÁ
  là việc số 1 trong docs/devops-handoff.md. Mặc định trong compose là `false` để người lạ
  clone về mà không có `.env` sẽ nhận chế độ an toàn kèm thông báo hướng dẫn rõ ràng.

## ADR-031 — Swagger `/api/docs` TẮT mặc định ở production, bật qua `ENABLE_API_DOCS` [GĐ7]
- **Quyết định:** Tài liệu OpenAPI sinh tự động bằng `@nestjs/swagger`, mount ở `/api/docs`.
  Bật khi `NODE_ENV !== 'production'`, hoặc khi `ENABLE_API_DOCS=true` một cách có chủ đích.
- **Lý do:** Trang docs phơi toàn bộ API surface (kể cả endpoint quản trị) cho bất kỳ ai gọi
  được — đúng loại "công cụ nội bộ không nên mở song song ra internet" mà baseline §5 cảnh
  báo. Nhưng cấm tuyệt đối lại bất tiện cho DevOps khi cần tra cứu trên môi trường thật, nên
  để cờ bật có chủ đích kèm cảnh báo (`collectConfigIssues` sinh warn khi cờ bật). Đã verify
  thật: mặc định trả 404; bật cờ thì render đủ 25 path.

## ADR-030 — SSO AMIS Mobile: HMAC shared-secret tạm thay OIDC/JWKS thật [GĐ6.1]
- **Quyết định:** `POST /auth/sso/amis-mobile` xác minh token bằng HMAC-SHA256 trên payload
  JSON `{email, exp}` với shared secret đọc từ `AMIS_SSO_SHARED_SECRET` (rỗng = TẮT, trả 501
  rõ ràng — không throw 500). Tìm user theo email, tái dùng `issueTokens` y hệt luồng login
  thường (không có JWT/kiến trúc song song). Tận dụng seam có sẵn "Seam để GĐ7 thay bằng OIDC
  AMIS" ở đầu `auth.service.ts` thay vì tạo module xác thực riêng.
- **Lý do:** Chưa có spec bridge/JWKS chính thức từ đội AMIS Mobile lúc làm scaffold này.
  HMAC đơn giản, không cần hạ tầng JWKS, đủ để chứng minh luồng "app mẹ xác thực hộ → BE cấp
  JWT nội bộ" chạy được end-to-end (đã test round-trip thật với secret tạm, xem 04-progress.md).
  **PLACEHOLDER — BẮT BUỘC DevOps xác nhận lại với đội AMIS Mobile và thay `verifySsoToken`
  bằng cơ chế xác minh thật (OIDC/JWKS hoặc khác) trước khi dùng production.** An toàn mặc
  định: biến env rỗng trong mọi file cấu hình của repo (không set sẵn secret thật).

## ADR-029 — Bridge token qua query param `?ssoToken=` tạm, không phải bridge thật [GĐ6.1]
- **Quyết định:** FE phát hiện chế độ nhúng qua query param `?embedded=1` (đọc 1 lần lúc
  khởi động, cache module-level — `lib/amisBridge.ts`). Lấy token SSO ưu tiên qua
  `window.AMISBridge?.getToken?.()` (native tiêm sẵn), fallback query param `?ssoToken=...`
  nếu không có object native.
- **Lý do:** Chưa có spec bridge chính thức (postMessage? custom scheme? object khác?) từ
  đội AMIS Mobile. Query param là cách đơn giản/đáng tin cậy nhất để scaffold chạy được và
  test thủ công không cần app mẹ thật. **CẢNH BÁO BẢO MẬT đã ghi rõ trong code:** query param
  lộ token trong URL (lịch sử trình duyệt, log server, referrer header) — KHÔNG được dùng
  nguyên trạng ở production. Khi có spec thật, khả năng cao phải đổi sang `postMessage` hoặc
  cơ chế native khác không lộ trong URL. Auth flow có fallback: bridge-auth thất bại vẫn hiện
  `LoginView` thường (không khoá chết người dùng), và mặc định (không `?embedded=1`) hành vi
  ứng dụng KHÔNG đổi so với trước GĐ6.1.

## ADR-028 — Compact: bottom navigation (không drawer); Medium/Expanded KHÔNG tự ép rail [GĐ6]
- **Quyết định:** Ở window size class Compact (&lt;600px), thay `MSidebar` cố định bằng
  bottom navigation cố định 5 mục (đúng `sidebarItems` hiện có: Kho phim/Thêm phim/Chuyên
  mục/Quản trị người dùng/Báo cáo — ẩn 2 mục cuối theo role như cũ). KHÔNG dùng drawer.
  Ở Medium (600-839px) và Expanded (840-1199px), **giữ nguyên `MSidebar` đầy đủ** (200px
  mở rộng / 64px thu gọn qua nút bấm thủ công có sẵn từ GĐ0) — KHÔNG tự động ép về dạng
  rail/drawer theo breakpoint dù mobile-pwa.md gợi ý điều đó.
- **Lý do:** mobile-pwa.md quy định "dùng bottom navigation khi có tối đa 5 điểm đến cấp
  một ổn định" — `sidebarItems` đúng khớp giới hạn này (kể cả khi đủ quyền super_admin/
  admin), không cần tới drawer phức tạp hơn. Với Medium/Expanded: `MSidebar` đã có sẵn cơ
  chế thu gọn thủ công do người dùng chủ động bấm (không phải hành vi mới cần thêm) và
  card grid `FilmListView` đã tự co giãn số cột theo bề rộng còn lại — ép tự động chuyển
  rail theo breakpoint sẽ xung đột với lựa chọn thu gọn thủ công đã lưu của người dùng
  (`v-model:collapsed`) mà không mang lại lợi ích rõ ràng ở quy mô app này. Ghi nhận là
  đơn giản hoá có chủ đích, không phải bỏ sót — nếu sau này có nhu cầu thật (nội dung
  chính bị bó hẹp ở Medium), có thể bổ sung tự động collapse khi `sizeClass==='medium'`.

## ADR-027 — PWA: `registerType: 'prompt'` (không 'autoUpdate'); icon sinh bằng script `sharp` [GĐ6]
- **Quyết định:** `vite-plugin-pwa` cấu hình `registerType: 'prompt'` — service worker
  mới KHÔNG tự `skipWaiting()`/reload ngầm; thay vào đó `usePwaUpdate()` (bọc
  `virtual:pwa-register/vue`) cấp cờ `needRefresh` cho `App.vue` hiện Global Inline
  Notification "Có phiên bản mới" + nút "Cập nhật" — người dùng tự bấm mới
  `updateServiceWorker(true)`. Cache chiến lược: precache app shell qua Workbox
  `globPatterns`; `/api/*` NetworkFirst (timeout 8s); `/media/*` (stream video qua
  backend proxy — ADR-021) `NetworkOnly` tuyệt đối không cache. Icon PWA (192/512/
  512-maskable/apple-touch-icon) sinh bằng script Node `scripts/generate-pwa-icons.mjs`
  dùng `sharp` render 1 SVG vẽ tay (nền brand `#245FDF` + glyph "device-tv" phong cách
  Tabler stroke 1.5) — không dùng ảnh chụp màn hình hay icon ngoài.
- **Lý do:** `FilmUploadView` có luồng nháp/cảnh báo thoát trang khi form dở dang (ADR
  từ GĐ3) — nếu SW tự activate+reload theo `autoUpdate` giữa lúc người dùng đang nhập
  form sẽ mất dữ liệu đang gõ mà không có dialog xác nhận nào chặn được (SW update nằm
  ngoài luồng router/component), vi phạm trực tiếp mobile-pwa.md §7 "Không tự reload khi
  form đang có thay đổi chưa lưu". `/media/*` không cache vì file video lớn (không hợp lý
  chiếm cache storage) và có thể gắn với quyền truy cập theo phiên — cache dùng chung ở
  SW là rủi ro rò rỉ giữa các người dùng dùng chung thiết bị/trình duyệt. Script sinh icon
  bằng `sharp` (không phải service chuyển đổi ảnh online) giữ icon tái tạo được, không phụ
  thuộc tài sản thiết kế bên ngoài chưa có (app chưa có bộ icon PNG chính thức từ Product
  Design) — icon sẽ được thay bằng asset thật khi đội thiết kế cung cấp.

## ADR-026 — Xuất CSV: cùng 1 endpoint `?format=csv`, BOM UTF-8 thủ công [GĐ5]
- **Quyết định:** `GET /reports/films` nhận thêm query `format=csv` (thay vì tách route
  riêng `/reports/films/export` hoặc `/reports/films.csv`) — controller check
  `query.format === 'csv'` rồi trả `res.send(csv)` với `Content-Type: text/csv;
  charset=utf-8` + `Content-Disposition: attachment`, ngược lại trả JSON như thường.
  CSV tự dựng bằng string join (không dùng thư viện `csv-stringify`/`json2csv` vì báo
  cáo chỉ 5 cột cố định), mỗi field escape quote kiểu RFC4180, prepend BOM `﻿`
  (byte `EF BB BF`) để Excel Windows nhận diện UTF-8 và hiện tiếng Việt đúng thay vì
  ký tự lạ. Header cột bằng tiếng Việt có dấu ("Tên phim", "Người upload"...).
- **Lý do:** 1 endpoint dùng chung tránh lặp logic lọc/join giữa 2 route; `?format=`
  là quy ước phổ biến, dễ hiểu, không cần thêm route mapping. BOM là bắt buộc — đã xác
  nhận qua `curl` + `xxd`: thiếu BOM thì Excel (không phải trình duyệt) đoán sai encoding
  và hiện tiếng Việt lỗi font dù file thực chất là UTF-8 hợp lệ.

## ADR-025 — Fan-out thông báo: notify() gọi trực tiếp trong FilmsService, không qua event bus [GĐ5]
- **Quyết định:** `NotificationsService.notify(filmId, type, actorId)` được `FilmsService`
  gọi TRỰC TIẾP (không dùng EventEmitter/queue) ngay tại 3 chỗ đã set lại tag "Phim mới"
  (`create()`, `update()`, `confirmVersion()` khi `versionNo > 1`) — đúng yêu cầu "đặt
  logic này đúng chỗ hiện tại đang set is_new/published, đừng tạo luồng song song rối".
  `notify()` tạo 1 row `notifications` rồi fan-out `user_notifications` cho MỌI user
  `isActive=true` TRỪ chính actor (lấy qua `UsersService.list()` có sẵn, không query
  riêng). `confirmVersion()` chỉ notify khi `versionNo > 1` — version đầu tiên (upload
  file lần đầu ngay sau khi tạo phim) đã được `create()` thông báo `new_film` rồi, tránh
  2 thông báo cho cùng 1 lần đăng phim.
- **Lý do:** App nội bộ quy mô nhỏ (vài chục user), không cần hạ tầng message queue;
  gọi thẳng trong cùng transaction-ish flow đơn giản, dễ trace, đúng tinh thần "sửa 1
  vùng ảnh hưởng tối thiểu" (NotificationsModule chỉ export 1 service, FilmsModule import
  thẳng, không có phụ thuộc ngược). Đánh đổi: nếu sau này fan-out chậm (rất nhiều user)
  sẽ cần chuyển sang xử lý nền — ghi nhận là nợ kỹ thuật, chưa cần ở quy mô hiện tại.

## ADR-024 — NotificationsPanel: popover tự dựng, không dùng MDialog [GĐ5]
- **Quyết định:** Panel danh sách thông báo (`NotificationsPanel.vue`) dựng bằng chính
  pattern popover tự chế đã dùng cho menu người dùng ở `App.vue` — lớp phủ
  `fixed inset-0` bắt click-ngoài-để-đóng + panel `fixed right-2 top-[52px]` (dưới
  header 48px + margin), `box-shadow: var(--mds-shadow-md)` (overlay, không phải
  `--mds-shadow-card` của box tĩnh), bo góc 8px, KHÔNG dùng `MDialog` (dialog che toàn
  màn hình, sai ngữ nghĩa cho panel nhỏ góc trên — xác nhận qua skill misa-design-system,
  bộ MDS hiện chưa có component "notification dropdown" đóng gói sẵn).
- **Lý do:** Nhất quán với popover có sẵn trong cùng file `App.vue` (menu người dùng) —
  cùng 1 pattern, dễ bảo trì, đúng token/shadow overlay theo quy chuẩn MDS thay vì tự
  chế lệch. `notificationsStore.ts` (Pinia) poll `unread-count` mỗi 30s khi đã đăng
  nhập (dừng khi logout) + load list khi mở panel lần đầu — đủ cho yêu cầu "không cần
  realtime phức tạp", tránh WebSocket/SSE không cần thiết ở quy mô nội bộ hiện tại.

## ADR-023 — Đếm view: dedupe theo user_id (không dùng session_hash), tăng atomic [GĐ4]
- **Quyết định:** Bảng `film_views`(id, film_id, user_id?, session_hash, viewed_at) đúng
  01-architecture.md §4. `POST /films/:id/view` (cần đăng nhập, không cần role đặc biệt —
  qua `JwtAuthGuard` toàn cục sẵn có, không thêm `@Roles`). Dedupe: query `film_views` theo
  `film_id + user_id` với `viewed_at > now - 30 phút`; nếu có → bỏ qua hoàn toàn (không ghi
  thêm dòng, không cập nhật lại `viewed_at`); nếu không → insert 1 dòng mới + `films.increment
  ({id}, 'viewCount', 1)` (câu lệnh SQL `UPDATE ... SET view_count = view_count + 1`, KHÔNG
  đọc giá trị hiện tại rồi ghi lại — tránh mất lượt tăng khi 2 request chạm cùng lúc, race
  condition kinh điển của đếm view). `session_hash = sha256(ip + '|' + user-agent)` sinh ở
  BE, LUÔN ghi vào cột nhưng KHÔNG dùng trong điều kiện dedupe hiện tại.
- **Lý do:** Toàn bộ người dùng AMIS Kho phim đều đã đăng nhập (nội bộ công ty, không có
  khách ẩn danh) → `user_id` là khoá dedupe đáng tin cậy và đơn giản hơn nhiều so với việc
  tự dựng/lưu session token phía FE (localStorage) rồi gửi lên mỗi request — vừa tốn công
  vừa dễ sai (token mất khi xoá localStorage/trình duyệt riêng tư). `session_hash` giữ lại
  đúng theo thiết kế cột trong kiến trúc gốc, xem như "nợ tính năng" cho tương lai (nếu có
  luồng khách xem không cần đăng nhập, hoặc muốn dedupe theo thiết bị/IP khi 1 tài khoản
  dùng chung nhiều máy) — không phát sinh phức tạp thừa ở GĐ4 vì chưa có yêu cầu đó.
  FE gọi 1 lần trong `onMounted` (không chờ video play) — đúng scope "vào trang xem là tính".

## ADR-022 — readVideoDuration có timeout (không bao giờ chặn xuất bản) [GĐ3]
- **Quyết định:** FE đọc thời lượng video qua `<video>` tạm (loadedmetadata) chỉ để hiển
  thị duration mm:ss, nhưng bọc `Promise.race` timeout 4s → trả `null` nếu metadata không
  load. Duration là best-effort; thiếu thì hiển thị `--:--`, KHÔNG chặn luồng tạo bản mới.
- **Lý do:** Phát hiện thật khi verify GĐ3: ở một số môi trường (vd Chromium tự động không
  giải mã được, hoặc `<video>` detached) sự kiện `loadedmetadata`/`error` không bao giờ bắn
  → publish treo vô hạn (nút "Xuất bản" quay mãi). Timeout là hardening bắt buộc.

## ADR-021 — Stream Range qua backend proxy MinIO (206), route /media/:key ngoài prefix /api [GĐ3]
- **Quyết định:** GET /media/:key (@Public) đọc object từ MinIO, chuyển thẳng header `Range`
  cho MinIO rồi trả nguyên `Content-Range`/`Content-Length`/`Content-Type` MinIO tính sẵn →
  206 Partial Content khi có Range, 200 khi không. Route đặt NGOÀI global prefix `api`
  (`setGlobalPrefix('api', { exclude: ['media/:key' GET/HEAD] })`) để khớp nginx `location /media/`.
  Phải @Public vì `<video src>`/link tải không gắn được Authorization header.
- **Lý do:** Tua/seek mượt cần 206 đúng chuẩn; để MinIO tự tính range tránh tự parse sai.
  storage_key là uuid không đoán được → chấp nhận public-by-key cho prototype nội bộ
  (production có thể chuyển sang presigned GET ngắn hạn — ghi nhận nợ kỹ thuật). Verify:
  curl + fetch trình duyệt đều trả 206 `bytes 0-999/113422`, đúng số byte.

## ADR-020 — Chọn @aws-sdk/client-s3 (S3-compatible) cho MinIO, key sinh server-side [GĐ3]
- **Quyết định:** Dùng `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (forcePathStyle)
  thay vì `minio` client — chuẩn S3, dễ chuyển sang AMIS Drive/S3 thật khi bàn giao. Hai
  S3Client: `internal` (minio:9000) cho thao tác backend (head/get-stream/put thumbnail/xoá),
  `presigner` (MINIO_PUBLIC_ENDPOINT=localhost:9200) CHỈ để ký presigned PUT. `storage_key`
  (`video-<uuid>.<ext>`) và `thumbnail_key` (`thumb-<uuid>.<ext>`) sinh 100% ở server từ
  content-type đã validate — KHÔNG nhận key từ client (chống path traversal/đoán key). File
  phẳng 1 segment (không có `/`) để route `/media/:key` khỏi vướng wildcard.
- **Lý do:** Video lớn phải upload thẳng lên MinIO (không buffer qua Node) → cần presigned PUT;
  nhưng chữ ký SigV4 gắn host nên URL phải ký bằng host trình duyệt gọi được (localhost:9200),
  trong khi backend tự thao tác qua host nội bộ (minio:9000) → tách 2 client. Validate ở server:
  MIME video (mp4/webm/ogg/mov/mkv), size ≤ MAX_UPLOAD_MB, ảnh bìa tỷ lệ 16:9 + magic bytes
  (image-size). confirmVersion head-check lại key trên MinIO + lấy size thật (không tin client).

## ADR-019 — film_versions là bảng thật; films trỏ bản mới nhất (version_no lớn nhất) [GĐ3]
- **Quyết định:** Thêm bảng `film_versions`(storage_key, file_size, duration, thumbnail_key,
  note, created_by...) qua migration `AddFilmVersions`. `toPublic` lấy bản version_no lớn nhất
  làm nguồn `links.storage=/media/<key>` + `thumbnailUrl`. confirmVersion tạo version mới, KẾ
  THỪA asset không thay từ bản trước (thêm mỗi ảnh bìa không làm mất video cũ) + set lại
  `is_new`/publishedAt. RBAC dùng lại `FilmsService.assertCanManage` (owner policy) cho mọi
  thao tác storage — nhân viên chỉ upload/tạo version cho phim của mình (verify: 403 đúng).
- **Lý do:** Đúng kiến trúc 01-architecture.md §4 + ADR-005 (versioning, giữ lịch sử, rollback).
  Endpoint storage đặt trong FilmsModule (import StorageModule) để tái dùng assertCanManage,
  không lặp logic quyền. **ADR-018 hết hiệu lực** — storage/thumbnail giờ persist thật.

## ADR-018 — GĐ2 chưa persist storage/thumbnail thật (đúng scope GĐ3) [ĐÃ THAY THẾ bởi ADR-019/020/021, GĐ3]
- **Quyết định:** `films` GĐ2 chỉ có metadata + `film_links` (youtube/vimeo/gdrive/misadrive).
  MUpload (file phim + thumbnail) vẫn hiện trên form (giữ UI đã duyệt) nhưng CHỈ xem trước
  trong phiên (object URL), KHÔNG gửi lên server — có ghi chú rõ ràng ngay trên form. Validate
  "cần ít nhất 1 nguồn" chỉ tính link ngoài, bỏ qua file đã chọn.
- **Lý do:** Trung thực với người dùng (nguyên tắc skill MDS: không báo "đã lưu" khi chưa lưu
  thật) — tránh users tưởng đã upload xong rồi mất dữ liệu khi F5. Storage thật (MinIO) là GĐ3.

## ADR-017 — Màu tag/gradient chuyên mục suy ra từ category id, không phải vị trí danh sách
- **Quyết định:** `categoryColorFor(categoryId)` và `thumbnailGradient(categoryId)` = mảng cố
  định lấy theo `categoryId % length` — thay vì cách cũ GĐ0.5 gán màu theo thứ tự xuất hiện
  trong danh sách phim đang tải (`colorForCategory(category, categories)`).
- **Lý do:** Cách cũ không ổn định — cùng 1 chuyên mục có thể ra màu khác nhau tuỳ tập phim
  đang lọc/tải. Theo id là bất biến, đúng hơn về UX dù không ai yêu cầu, chấp nhận được vì
  không tốn thêm chi phí thiết kế.

## ADR-016 — Hashtag & FilmLink là bảng riêng (đúng theo 01-architecture.md), không JSON column
- **Quyết định:** `hashtags` + `film_hashtags` (n-n) và `film_links` (1-n) là bảng SQL riêng,
  không nhét mảng JSON vào cột `films`.
- **Lý do:** Kiến trúc đã chốt từ GĐ0 (01-architecture.md §4); chuẩn hoá giúp tìm theo hashtag
  (GĐ5) và validate/dedupe hashtag hiệu quả hơn JSON column.

## ADR-015 — Category & Film slug tự sinh ở BE (không nhận từ FE)
- **Quyết định:** Backend tự tạo slug từ `name`/`title` qua `slugify()` + hậu tố số nếu trùng
  (`-2`, `-3`...). FE không gửi slug, chỉ nhận lại từ response.
- **Lý do:** Slug là identifier suy ra được, để BE sinh + đảm bảo unique tránh race-condition
  2 client tạo cùng lúc trùng slug; nhất quán với cách Category cha-con cũng dùng numeric id
  (không dùng slug làm khoá như mock GĐ0.5 cũ).

## ADR-014 — OwnerGuard hoãn tới GĐ2 (chưa có resource "phim" ở BE) — ✅ đã thêm ở GĐ2
- **Quyết định:** GĐ1 mới có `RolesGuard` (toàn cục theo `@Roles`). Kiểm chủ sở hữu cho **quản trị người dùng** (ai khoá/xoá được ai, không tự khoá mình) đặt ở **tầng service** (`UsersService.assertCanManage`), không dựng class OwnerGuard rỗng. `OwnerGuard` thật (theo `uploader_id` của phim) sẽ thêm ở GĐ2 khi FilmsModule ra đời.
- **Cập nhật GĐ2:** đã thêm `FilmsService.assertCanManage` (cùng pattern với Users) — super_admin/admin sửa/xoá bất kỳ phim, nhân viên chỉ phim của mình. Vẫn ở tầng service (không tách class `OwnerGuard` riêng) vì logic đơn giản, chỉ so `uploaderId === actor.id`.
- **Lý do:** Owner theo nghĩa roadmap (§5) là "nhân viên chỉ sửa/xoá phim của mình" — chưa có phim ở BE nên guard chưa có gì để canh; tránh dead code. Vẫn giữ đúng tinh thần ADR-002 (kiểm quyền ở BE, không tin FE).

## ADR-013 — Buộc đổi mật khẩu lần đầu (must_change_password)
- **Quyết định:** Cột `users.must_change_password`. Tài khoản do admin/super tạo luôn `=true`; seed super_admin `=false`. FE: sau login nếu `mustChangePassword` → ép sang `/change-password` (router guard dồn mọi route về đây tới khi đổi xong). Backend `/auth/change-password` verify mật khẩu hiện tại rồi set `=false`.
- **Lý do:** Mật khẩu tạm do hệ thống sinh/admin đặt không nên dùng lâu dài; đúng UX đã hứa ở form GĐ0.5.

## ADR-012 — JWT access(15') + refresh(7d), lưu localStorage (prototype)
- **Quyết định:** 2 token: access ngắn (JWT_ACCESS_TTL) + refresh dài (JWT_REFRESH_TTL), ký bằng 2 secret khác nhau, có `type: access|refresh` trong payload (guard chỉ nhận access; refresh chỉ dùng ở /auth/refresh). FE lưu ở `localStorage`, `http.ts` tự gắn Bearer + tự refresh 1 lần khi 401. Kiểm quyền THẬT ở BE (RolesGuard + service); FE chỉ ẩn/hiện cho UX.
- **Lý do:** Đủ an toàn cho tool nội bộ prototype, đơn giản. Chừa seam: GĐ7 DevOps thay bước "xác minh danh tính" bằng OIDC AMIS, phần cấp JWT/kiểm quyền giữ nguyên. **Nợ kỹ thuật ghi nhận:** localStorage dễ tổn thương XSS hơn httpOnly cookie — cân nhắc chuyển khi lên production.

## ADR-011 — Hash mật khẩu bằng bcryptjs; migration tự chạy khi khởi động
- **Quyết định:** Dùng `bcryptjs` (thuần JS) thay `argon2`/`bcrypt` native. Migration TypeORM đăng ký **tường minh** (không glob) + `migrationsRun: true` để tự chạy lúc khởi động; `db-options.ts` là config DÙNG CHUNG cho AppModule (runtime) và DataSource CLI. `password_hash` để `select: false` (không lộ ra API). Seed roles + super_admin idempotent qua `OnModuleInit`.
- **Lý do:** `argon2`/`bcrypt` cần build native trên `node:20-alpine` (python/make/g++) → rủi ro gãy Docker build (đã dính lỗi build ở GĐ0.5). `bcryptjs` cài là chạy. Đăng ký entity/migration tường minh để chạy đúng cả ở dist(.js) lẫn dev(.ts). **Lưu ý:** `retryAttempts`/`retryDelay` là mở rộng riêng của Nest — chỉ thêm khi gọi `TypeOrmModule.forRoot`, KHÔNG để trong `DataSourceOptions` dùng chung (fail typecheck).

## ADR-010 — Cổng Docker: 8180 (nginx) / 9200+9201 (MinIO) thay vì mặc định
- **Quyết định:** Đổi `NGINX_PORT` 8080→8180, `MINIO_API_PORT` 9000→9200, `MINIO_CONSOLE_PORT` 9001→9201.
- **Lý do:** Máy dev đã có tiến trình khác chiếm cổng 8080/9000/9001 (phát hiện khi `docker compose up` báo "port is already allocated"). Cổng mới ít khả năng đụng độ với service phổ biến khác. `.env` và `.env.example` cùng cập nhật.

## ADR-009 — Mock data dùng `reactive()`, không phải mảng tĩnh
- **Quyết định:** `mockFilms`, `categoryTree`, `mockUsers` (GĐ 0.5) đều là `reactive([...])` export từ module, không phải `const [...]` tĩnh.
- **Lý do:** Cho phép form Thêm/Sửa phim, Chuyên mục, Quản trị người dùng "hoạt động thật" trong phiên demo (thêm 1 phim → thấy ngay trong Kho phim) mà không cần backend — giúp Review Gate trực quan hơn nhiều so với mock tĩnh chỉ đọc.

## ADR-008 — VideoPlayer: native controls + iframe chính thức, không tự vẽ lại
- **Quyết định:** Nguồn `storage` dùng `<video controls>` gốc trình duyệt (đã có sẵn play/pause/tua/âm lượng/toàn màn hình); YouTube/Vimeo nhúng iframe player chính thức của họ; Google Drive/MISA Drive không nhúng, chỉ mở link ngoài.
- **Lý do:** MDS chưa có component Player chuyên dụng; tự vẽ lại control (progress bar, volume slider...) tốn công và dễ sai lệch hành vi bàn phím/accessibility so với control gốc đã được trình duyệt/nền tảng tối ưu sẵn. Việc "chưa nhúng ổn định được" GDrive/MISA Drive được note rõ trong code (TODO), không giả vờ đã xong.



## ADR-007 — Chiến lược UI-first + Review Gate
- **Quyết định:** Dựng UI xem được sớm bằng mock data, chốt giao diện trước khi làm backend; mỗi GĐ có UI đều qua Review Gate (preview + ảnh chụp duyệt).
- **Lý do:** Giảm token/thời gian, tránh làm xong hết mới sửa; hợp module hoá (backend chỉ thay mock bằng API).

## ADR-006 — Tailwind v4 + theme MDS runtime
- **Quyết định:** Dùng Tailwind v4 (@tailwindcss/vite); bộ MDS copy-in vào `src/components/mds`; theme blue mặc định, đổi qua `data-mds-theme`.
- **Lý do:** MDS hỗ trợ Tailwind v3/v4; v4 cấu hình gọn qua plugin Vite; giữ nguyên token MDS, không tự chế màu.

## ADR-005 — Model versioning cho "cập nhật bản mới"
- **Quyết định:** Tách `film_versions`; `films` giữ metadata + trỏ version hiện hành.
- **Lý do:** Update trùng tiêu đề tạo version mới, giữ lịch sử, dễ rollback, gắn lại tag "mới".

## ADR-004 — Storage tách rời qua MinIO (S3 API)
- **Quyết định:** Dùng MinIO thay vì lưu thẳng volume.
- **Lý do:** File video lớn, hỗ trợ range streaming, dễ migrate sang AMIS Drive/S3 khi bàn giao.

## ADR-003 — Auth nội bộ JWT, để chỗ cắm OIDC
- **Quyết định:** Prototype dùng JWT + seed super_admin; module `auth` thiết kế sẵn interface cho OIDC.
- **Lý do:** Chưa có quyền AMIS; tránh làm lại khi DevOps cắm SSO.

## ADR-002 — RBAC = RolesGuard + OwnerGuard
- **Quyết định:** Phân quyền 2 tầng: theo role + theo chủ sở hữu resource.
- **Lý do:** Nhân viên chỉ sửa/xoá phim của mình → cần kiểm tra owner ở tầng service, không chỉ route.

## ADR-001 — NestJS module hoá
- **Quyết định:** Backend NestJS, mỗi domain 1 module độc lập; giao tiếp qua service export.
- **Lý do:** Yêu cầu "sửa 1 vùng ảnh hưởng tối thiểu"; NestJS DI + module là fit tự nhiên.

## ADR-000 — Stack: NestJS + MySQL + MinIO + Vue/Tailwind/MDS
- **Quyết định:** Chốt theo lựa chọn chủ đầu tư 2026-07-21.
- **Lý do:** Cùng hệ JS FE-BE (dễ Claude Code), MySQL hợp dữ liệu quan hệ/phân quyền, MinIO hợp video lớn.
