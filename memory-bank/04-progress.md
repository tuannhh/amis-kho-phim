# AMIS Kho phim — Progress Log

> Nhật ký "đã làm gì". Cập nhật MỖI khi hoàn thành một việc đáng kể.
> Format: `YYYY-MM-DD — [GĐ x] mô tả — trạng thái`.

## Trạng thái tổng
- ⚠️ **ĐANG CÓ HAI NHÁNH RBAC SONG SONG CHỜ NGƯỜI DÙNG CHỌN** (chưa nhánh nào merge vào `main`):
  `phan-quyen-4-cap` (4 cấp có scope phòng ban) và `phan-quyen-3-cap` (3 cấp phẳng — nhánh của
  file này). Xem nhật ký ngay dưới + ADR-045→047.
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

## Nhật ký RBAC 3 CẤP PHẲNG (nhánh song song `phan-quyen-3-cap`) — 2026-08-06 — ✅ XONG

> Yêu cầu: dựng **bản thứ hai** đúng yêu cầu GỐC (3 cấp, KHÔNG giới hạn phòng ban ở cấp cao
> nhất) để so sánh trực tiếp với `phan-quyen-4-cap` trên GitHub rồi chọn một.
> Nhánh tạo **từ `origin/phan-quyen-4-cap`** (không phải `main`) để tái dùng toàn bộ hạ tầng
> migration/departments/test. Quyết định + lý do ở **ADR-045 → ADR-047**.

### Khác biệt so với nhánh 4 cấp — đúng 3 điểm
| | `phan-quyen-4-cap` | `phan-quyen-3-cap` (nhánh này) |
|---|---|---|
| `RoleCode` | 4: viewer/employee/**dept_manager**/super_admin | 3: viewer/employee/super_admin |
| Cấp cao nhất sửa phim | Cấp 3 chỉ phim của Cấp 2 **cùng phòng ban**; Cấp 4 mọi phim | Cấp 3 sửa **MỌI** phim, KHÔNG xét phòng ban |
| `assertCanManage` | 4 nhánh, async, đọc phòng ban + vai trò uploader từ DB | 3 nhánh, **không đọc phòng ban của ai** |
| Mapping `admin` cũ | → Cấp 4, phải biện luận vì có 2 ứng viên (ADR-041) | → `super_admin`, **không có chỗ mơ hồ** (ADR-047) |
| Vai trò gán được qua API | viewer/employee/dept_manager (3) | viewer/employee (**2**) |
| Lược đồ DB | departments + 4 cột phòng ban | **GIỮ NGUYÊN 100%**, chỉ đổi ý nghĩa sang truy vết |

### Đã làm
- **Backend:** `role.entity.ts` còn 3 `RoleCode` (`ROLE_LEVEL` 1–3, `FILM_WRITE_ROLES` =
  employee+super_admin); `assertCanManage` bỏ hẳn nhánh `department_id`; `creatableRoles` và
  `ASSIGNABLE_ROLE_CODES` còn `viewer`/`employee`; migration đổi tên
  `1722000000000-AddDepartmentsAndRbac3Levels.ts` (`RBAC3_ROLES` 3 dòng, `LEGACY_ROLE_MAP` thêm
  `dept_manager → employee`); gỡ `UsersService.getRoleAndDepartment` (hết caller, tránh mã chết).
- **GIỮ NGUYÊN có chủ đích:** bảng `departments` + module CRUD, mọi cột `department_id`/
  `created_by`, snapshot `films.department_id` lúc tạo, index `IDX_films_department` — thuần
  truy vết (ADR-046). Mọi `@Roles` giữ nguyên; **không nới bất kỳ chốt chặn nào**.
- **Frontend:** `authStore.UserRole` 3 giá trị; `permissions.ts` bỏ `dept_manager`,
  `canManageFilm` rút về đúng 2 điều kiện (chính chủ HOẶC `super_admin`), `FilmOwnership` chỉ
  còn `uploaderId`; `UserAdminView` dropdown vai trò 2 lựa chọn, **giữ dropdown phòng ban**;
  `DepartmentAdminView`/`CategoryView`/`App.vue` cập nhật nhãn + chú thích.
- **Chốt chặn hồi quy:** có ca unit test khẳng định đường kiểm quyền KHÔNG gọi
  `getDepartmentId` lần nào → ai thêm lại scope phòng ban sẽ làm đỏ test ngay.

### Kiểm thử & verify (tất cả đã chạy thật, không phải suy luận trên giấy)
- **BE unit 163/163 pass** · **BE tích hợp 80/80 pass trên MySQL thật** (gồm nhóm "Migration
  RBAC 3 cấp": `roles` đúng 3 dòng, chèn tài khoản `admin` cũ VÀ `dept_manager` rồi chạy
  `migrateLegacyRoles()` thật → `super_admin`/`employee`, idempotent 2 lần).
- **FE 38/38 pass**; `backend npm run build` + `frontend npm run build` (`vue-tsc`) sạch.
- **Migration chạy thật trên DB dev đang có** (`docker compose up -d --build`): `roles` từ 4 →
  đúng 3 dòng (`dept_manager` biến mất), 2 tài khoản `tp1@`/`tp2@` **tự động hạ về `employee`**
  đúng ADR-047, phòng ban + phim giữ nguyên.
- **Probe API thật bằng curl** trên phim của Cấp 2 phòng Truyền thông: Cấp 1 → 403 · Cấp 2 khác
  **cùng phòng** → 403 · Cấp 2 **khác phòng** → 403 · chính chủ → 200 · Cấp 3 → 200. Phim của
  Cấp 3 (phòng NULL): Cấp 2 → 403, Cấp 3 → 200. Cấp 1 gọi POST/DELETE/upload-url → 403 cả 3.
  `/users`, `/departments`, `/reports` với Cấp 2 → 403; với Cấp 3 → 200.
  **Ca cốt lõi của bản phẳng:** gán `department_id = 2` cho `super_admin` rồi sửa phim phòng 1
  → **200** (không bị chặn theo phòng ban). Ca khác biệt rõ nhất giữa 2 nhánh: `tp1@` (Trưởng
  phòng ở bản 4 cấp → 200) nay là Cấp 2 nên sửa phim đồng nghiệp cùng phòng → **403**.
- **Browser test thật (Docker, localhost:8180)** đủ 3 cấp: Cấp 1 → sidebar chỉ Kho phim +
  Chuyên mục, không có "Thêm phim", màn chi tiết không có Sửa/Xoá · Cấp 2 → có "Thêm phim",
  **KHÔNG** có Sửa/Xoá trên phim đồng nghiệp cùng phòng, **CÓ** trên phim của mình · Cấp 3 →
  đủ 3 mục quản trị, **CÓ Sửa/Xoá trên phim của người khác khác phòng ban**; màn Quản trị người
  dùng hiện `tp1@`/`tp2@` với nhãn "Nhân viên văn phòng" + cột Phòng ban còn nguyên; dropdown
  vai trò **chỉ 2 lựa chọn** (Người xem, Nhân viên văn phòng).

### ⚠️ Một điểm CỐ Ý làm khác yêu cầu chữ nghĩa — cần người dùng biết
Yêu cầu ghi "dropdown chọn vai trò chỉ còn **3** lựa chọn". Thực tế còn **2**
(`viewer`/`employee`). Lý do: chốt chặn có từ GĐ1 — **không ai gán được `super_admin` qua API**
(DTO trả 400) — vẫn giữ nguyên ở cả hai nhánh; nhánh 4 cấp cũng chỉ có 3/4 vai trò trong
dropdown vì đúng lý do này. Thêm `super_admin` vào dropdown để cho đủ "3 lựa chọn" sẽ **mở một
khoảng trống bảo mật thật** (một tài khoản quản trị bị chiếm có thể tự nhân bản thêm quản trị),
trái ràng buộc "không để lộ khoảng trống bảo mật nào". Nâng lên cấp cao nhất vẫn phải làm trực
tiếp trên DB. Nếu người dùng thực sự muốn gán `super_admin` qua giao diện → đó là yêu cầu MỚI,
cần xác nhận rõ.

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

## Việc tiếp theo (next actions)
1. **GĐ 5 (Nghiệp vụ nâng cao)** — Sonnet 5 (+ Opus 4.8 cho phần versioning nếu cần đào sâu).
   Còn thiếu theo 03-roadmap.md: thông báo phim mới (bảng `notifications`/`user_notifications`
   đã có trong 01-architecture.md §4, chưa có module `notifications` thật); báo cáo Quản trị
   theo giai đoạn ai upload bao nhiêu phim + gồm phim gì (lọc theo người upload/khoảng ngày,
   xuất CSV). Trùng tiêu đề/versioning + tag "Phim mới" đã có 1 phần từ GĐ2/GĐ3.
2. Docker stack đã verify chạy tốt — có thể `docker compose down` khi không cần chạy liên tục (đỡ chiếm cổng/RAM), `up -d` lại khi cần.
