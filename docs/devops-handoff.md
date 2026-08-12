# AMIS Kho phim — Bàn giao DevOps: đưa lên hạ tầng MISA

> Checklist đưa ứng dụng từ **Docker Compose dev** lên **hạ tầng thật của MISA**.
> Đọc kèm: `docs/danh-gia-an-ninh.md` (đánh giá an ninh theo chuẩn MISA) · `memory-bank/01-architecture.md`
> (kiến trúc) · `memory-bank/05-decisions.md` (lý do đằng sau từng quyết định).
>
> **Nguyên tắc khi đọc tài liệu này:** chỗ nào ghi *"cần xác nhận với đội hạ tầng MISA"* là
> chỗ người viết **không có thông tin**, không phải chỗ để suy đoán. Đừng tự điền.

---

## 0a. Bản TEST đã triển khai trên Google Cloud Run (2026-08-10)

**CHỈ để người dùng bấm thử qua trình duyệt — KHÔNG phải hạ tầng chính thức, không đại diện
cho cách MISA sẽ triển khai thật.** Ghi lại đây để biết cấu hình nào đang chạy và dọn được khi
xong việc test.

- Project GCP: `prapplication-479309` (region `asia-southeast1`) — cùng project đang chạy các
  app MISA khác (AMIS Event, MISA PR Workstation...).
- **URL công khai duy nhất người test dùng:** `https://kho-phim-784559735000.asia-southeast1.run.app`
  (service Cloud Run tên `kho-phim` — nginx reverse proxy, đóng đúng vai trò `nginx/nginx.conf`
  cục bộ nhưng route sang 2 Cloud Run service khác bằng HTTPS + Host header thay vì DNS nội bộ
  Docker; cấu hình ở `nginx-cloudrun/`, ADR-070).
- **4 Cloud Run service**: `kho-phim` (proxy công khai), `kho-phim-backend`, `kho-phim-frontend`,
  `kho-phim-minio`. **1 Cloud SQL**: `kho-phim-mysql` (MySQL 8.0, `db-f1-micro`, database `kho_phim`).
- **Tài khoản test**: `superadmin@misa.com.vn`, mật khẩu sinh ngẫu nhiên lúc deploy — hỏi người
  đã chạy lệnh deploy (không ghi mật khẩu thật vào file này, kể cả repo private).
- **2 giới hạn CỐ Ý CHẤP NHẬN cho bản test, PHẢI đổi nếu lên thật:**
  1. **MinIO KHÔNG có ổ đĩa bền** (`kho-phim-minio` chạy trên Cloud Run không gắn volume) —
     nếu Cloud Run khởi động lại container (redeploy, hết instance rảnh lâu, sự cố hạ tầng),
     **toàn bộ video/ảnh bìa đã tải lên sẽ MẤT**. Đã đặt `--min-instances=1` để giảm khả năng
     này trong lúc test, nhưng không đảm bảo tuyệt đối. Nếu triển khai thật: MinIO cần ổ đĩa
     thật (Compute Engine + persistent disk, hoặc GKE + PV) — KHÔNG chạy MinIO trên Cloud Run.
  2. **`MINIO_API_CORS_ALLOW_ORIGIN=*`** (cho phép mọi origin gọi thẳng API MinIO để trình
     duyệt upload qua presigned URL) — chấp nhận được cho test nội bộ ngắn hạn, KHÔNG dùng cấu
     hình này ở môi trường thật (đổi về đúng domain FE).
- Việc số 1 (`ALLOW_INSECURE_CONFIG`) **đã đúng** ở bản test này — biến này KHÔNG được đặt nên
  backend đã tự kiểm tra và chấp nhận khởi động (không dùng secret mẫu).
- 2 thay đổi code nhỏ, MANG TÍNH TƯƠNG THÍCH THÊM (không đổi hành vi Docker Compose cục bộ,
  chỉ kích hoạt khi có biến môi trường mới) — xem ADR-070/071 trong `05-decisions.md`:
  `DB_SOCKET_PATH` (nối MySQL qua Unix socket Cloud SQL) và `MINIO_ENDPOINT_URL` (ghi đè
  endpoint MinIO bằng URL đầy đủ có scheme https, vì Cloud Run không có cổng tuỳ ý như Docker).
- **Dọn dẹp khi hết nhu cầu test** (tiết kiệm chi phí Cloud SQL luôn chạy):
  ```bash
  gcloud run services delete kho-phim kho-phim-backend kho-phim-frontend kho-phim-minio \
    --project=prapplication-479309 --region=asia-southeast1 --quiet
  gcloud sql instances delete kho-phim-mysql --project=prapplication-479309 --quiet
  gsutil rm -r gs://kho-phim-storage-prapplication-479309
  ```

---

## 0. Việc SỐ 1 — gỡ chốt an toàn dev

`.env.example` có dòng:

```
ALLOW_INSECURE_CONFIG=true
```

**XOÁ dòng này khỏi `.env` của môi trường thật.**

Vì sao quan trọng: Dockerfile backend đã pin `NODE_ENV=production` cho **cả** stack dev, nên
không thể dùng `NODE_ENV` làm dấu hiệu "đang chạy thật". Biến `ALLOW_INSECURE_CONFIG` chính là
công tắc đó. Khi nó **không** bằng `true`, backend sẽ **từ chối khởi động** nếu phát hiện:

- `JWT_SECRET` / `JWT_REFRESH_SECRET` trống, còn giá trị mặc định, hoặc ngắn hơn 32 ký tự
- hai secret JWT trùng nhau
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` còn là `minioadmin`
- `MINIO_PUBLIC_ENDPOINT` còn trỏ `localhost`/`127.0.0.1`
- `SEED_SUPER_ADMIN_PASSWORD` còn là mật khẩu mẫu trong repo
- `AMIS_SSO_SHARED_SECRET` được đặt nhưng ngắn hơn 32 ký tự

Lỗi in ra kèm hướng dẫn sửa cụ thể. Logic ở `backend/src/common/config/security.config.ts`,
có test phủ ở `security.config.spec.ts`.

> Nếu container backend không lên và log có chữ `[BẢO MẬT] Backend TỪ CHỐI KHỞI ĐỘNG` —
> đó là tính năng đang làm đúng việc của nó, không phải sự cố.

---

## 0b. Tài khoản Cấp cao nhất (`super_admin`) — KHÔNG gán được qua UI/API, đây là chủ đích

Dropdown chọn vai trò ở màn Quản trị người dùng chỉ hiện các vai trò THẤP HƠN cấp cao nhất
(3/4 vai trò). Đây không phải thiếu sót — nếu để `super_admin` xuất hiện trong danh sách chọn
qua UI/API, một tài khoản cấp thấp hơn (hoặc kẻ khai thác lỗ hổng khác) có thể tự phong mình
lên cấp cao nhất. Quyết định này đã được chủ dự án xác nhận (2026-08-05): **vẫn giữ khả năng
tồn tại tài khoản `super_admin` ở tầng dữ liệu (migration/seed), chỉ cố ý không lộ ra UI/API.**

**Cách tạo tài khoản `super_admin` đầu tiên khi triển khai thật**: thao tác trực tiếp trên
database (không qua web), ví dụ:

```sql
UPDATE users SET role_code = 'super_admin' WHERE email = '<email-người-quản-trị-đầu-tiên>';
```

Sau khi có 1 tài khoản `super_admin`, các tài khoản `super_admin` tiếp theo (nếu cần) cũng
phải tạo bằng cách này — KHÔNG bổ sung `super_admin` vào dropdown UI để "cho tiện" mà chưa
đánh giá lại rủi ro tự leo quyền.

---

## 1. Biến môi trường — rà trước khi lên prod

Nguồn đầy đủ: `.env.example`. Cột "Bắt buộc đổi" là bắt buộc theo nghĩa đen — hệ thống chặn
khởi động nếu chưa đổi (trừ chỗ ghi rõ khác).

### Bắt buộc đổi

| Biến | Hiện tại (dev) | Yêu cầu ở production |
|---|---|---|
| `JWT_SECRET` | `change-me` | Chuỗi ngẫu nhiên ≥ 32 ký tự: `openssl rand -hex 32`. **Không commit.** |
| `JWT_REFRESH_SECRET` | `change-me-refresh` | Chuỗi ngẫu nhiên khác, sinh riêng. Phải khác `JWT_SECRET`. |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | `minioadmin` | Tài khoản dịch vụ riêng, quyền tối thiểu (chỉ đọc/ghi đúng bucket). |
| `MINIO_PUBLIC_ENDPOINT` | `http://localhost:9200` | Domain HTTPS thật mà **trình duyệt người dùng** gọi được. Xem mục 3 — đây là chỗ dễ sai nhất. |
| `SEED_SUPER_ADMIN_PASSWORD` | `Admin@12345` | Mật khẩu mạnh, dùng một lần rồi đổi ngay sau lần đăng nhập đầu. |
| `DB_PASSWORD` | `khophim` | Mật khẩu thật (cảnh báo, không chặn khởi động). |
| `MYSQL_ROOT_PASSWORD` | `root` | Không dùng ở production nếu DB là dịch vụ quản lý sẵn. |
| `ALLOW_INSECURE_CONFIG` | `true` | **XOÁ HẲN** (mục 0). |

### Rà lại, có thể giữ mặc định

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `JWT_ACCESS_TTL` | `15m` | Rút ngắn nếu cần chặt hơn — liên quan mục 8 (khoá tài khoản có độ trễ). |
| `JWT_REFRESH_TTL` | `7d` | Càng dài, rủi ro token bị đánh cắp càng lâu (chưa thu hồi được — mục 8). |
| `MAX_UPLOAD_MB` | `2048` | Phải khớp `client_max_body_size` trong nginx. |
| `NEW_FILM_TTL_DAYS` | `14` | Thuần nghiệp vụ (thời hạn nhãn "Phim mới"). |
| `CORS_ORIGINS` | rỗng | **Để rỗng là đúng** nếu FE và API cùng domain qua nginx. Chỉ điền khi FE ở domain khác. |
| `ENABLE_API_DOCS` | `false` | Bật `/api/docs` ở production. Chỉ bật khi đã có VPN/IP allowlist đứng trước (ADR-031). |
| `SEED_SUPER_ADMIN_EMAIL` | `superadmin@misa.com.vn` | Đổi theo email quản trị thật. |
| `AMIS_SSO_SHARED_SECRET` | rỗng | **Để rỗng = TẮT SSO.** Chỉ đặt sau khi hoàn thành mục 5. |
| `AMIS_SSO_MAX_TTL_SECONDS` | `300` | Trần hạn dùng token SSO. |

**Quản lý bí mật:** không commit secret thật vào bất kỳ file nào trong repo (kể cả `.env`
— file này đã trong `.gitignore` nhưng đừng dựa vào đó). Dùng secret manager/vault của MISA;
tiêm vào container lúc chạy. *Cơ chế cụ thể: cần xác nhận với đội hạ tầng MISA.*

---

## 2. Không dùng Docker Compose dev cho production

`docker-compose.yml` hiện tại là môi trường phát triển. Không phù hợp production vì:

- MySQL và MinIO chạy như container kèm volume cục bộ — không HA, không backup tự động,
  mất máy chủ là mất dữ liệu.
- Mọi service nằm một máy, không scale được, không rolling update.
- `restart: unless-stopped` không thay thế được orchestrator thật.
- Không có TLS ở đâu cả (nginx chỉ listen cổng 80).

Hai artifact có thể tái sử dụng nguyên vẹn: **`backend/Dockerfile`** và **`frontend/Dockerfile`**
(multi-stage, đã build ra image gọn). Phần cần dựng mới là orchestration + hạ tầng có trạng thái.

**Hai điểm neo sẵn cho orchestrator (GĐ7 bổ sung theo chuẩn Backend MISA 09):**

- **Health check tách 2 loại.** `GET /api/health` là *liveness* — chỉ xác nhận tiến trình
  còn sống, **cố ý không** kiểm tra MySQL (nếu DB chập chờn mà liveness fail, orchestrator
  sẽ restart tiến trình một cách vô ích trong khi lỗi thật nằm ở DB). `GET /api/health/ready`
  là *readiness* — có kiểm tra MySQL bằng `SELECT 1`, trả `503` khi DB không tới được; dùng
  cái này để quyết định có định tuyến traffic vào bản sao hay chưa.
- **Tắt có kiểm soát.** `app.enableShutdownHooks()` đã bật (`backend/src/main.ts`) — khi nhận
  `SIGTERM`, Nest chạy hook huỷ để đóng kết nối MySQL/S3 tử tế. Đặt `terminationGracePeriod`
  của orchestrator đủ dài cho request đang xử lý dở hoàn tất.

**Hướng triển khai thật của MISA: cần xác nhận với đội hạ tầng MISA.** Người viết tài liệu này
không có thông tin về nền tảng đích (Kubernetes? VM + systemd? nền tảng nội bộ AMIS?), nên
không đưa ra khuyến nghị cụ thể để tránh dẫn sai. Những gì cần chốt cùng đội hạ tầng:

1. Nền tảng chạy container và cách quản lý secret.
2. MySQL 8 dạng dịch vụ quản lý sẵn (charset **utf8mb4** — bắt buộc cho tiếng Việt).
3. Lưu trữ đối tượng: giữ MinIO tự vận hành hay chuyển sang S3/AMIS Drive (mục 4).
4. Nơi kết thúc TLS và cấu hình HSTS.
5. Chiến lược log tập trung và cảnh báo.

---

## 3. `MINIO_PUBLIC_ENDPOINT` — chỗ dễ sai nhất

Hệ thống dùng **hai** endpoint tới cùng một kho lưu trữ (ADR-020):

- `MINIO_ENDPOINT` + `MINIO_PORT` (mặc định `minio:9000`) — backend tự thao tác qua mạng nội bộ.
- `MINIO_PUBLIC_ENDPOINT` — **chỉ** dùng để ký presigned PUT URL.

Chữ ký SigV4 gắn chặt với hostname, nên URL phải được ký bằng **đúng host mà trình duyệt người
dùng gọi tới**. Để nguyên `localhost:9200` thì mọi lượt tải video lên đều thất bại ở máy người
dùng — trong khi backend nhìn vẫn "khoẻ" và healthcheck vẫn xanh.

Việc cần làm:
1. Đặt `MINIO_PUBLIC_ENDPOINT` = domain HTTPS thật của lớp lưu trữ.
2. Cấu hình CORS trên MinIO/S3 cho phép `PUT` từ origin của Kho phim (dev đã làm, prod phải làm lại).
3. Kiểm thử thật: đăng nhập bằng trình duyệt → tải một video lên → xác nhận `200`, không phải
   lỗi CORS hay lỗi chữ ký. **Kiểm bằng trình duyệt thật, đừng chỉ curl từ trong máy chủ.**

---

## 4. Đổi lưu trữ (MinIO → AMIS Drive / S3)

Toàn bộ thao tác lưu trữ gói trong **`backend/src/modules/storage/storage.service.ts`**, dùng
`@aws-sdk/client-s3` chuẩn S3 chính là để đổi được dễ dàng (ADR-004/020).

- Đích là **S3 hoặc S3-compatible**: chỉ cần đổi endpoint + credentials + bucket, có thể phải
  bỏ `forcePathStyle: true` (AWS S3 thật dùng virtual-hosted style). Không cần sửa logic.
- Đích là **AMIS Drive** (nếu không có S3 API): cần viết lại phần thân của `StorageService`.
  Giữ nguyên interface công khai (`createVideoUploadUrl`, `putThumbnail`, `stat`, `getObject`,
  `delete`) thì các module còn lại không phải sửa gì. *Khả năng tương thích API của AMIS Drive:
  cần xác nhận với đội hạ tầng MISA.*

**Cân nhắc CDN / presigned GET (rủi ro B1 trong security review):** hiện `/media/:key` là
endpoint công khai, chỉ dựa vào UUID khó đoán, và **mọi byte video đều đi xuyên qua Node**.
Hai vấn đề: (1) không kiểm soát được ai xem khi link bị chia sẻ ra ngoài; (2) backend phải
gánh băng thông video. Hướng xử lý ở production:

- Đổi `VideoPlayer.vue` sang xin **presigned GET URL ngắn hạn** (ví dụ 10 phút) rồi phát thẳng
  từ lớp lưu trữ/CDN — vừa kiểm soát được quyền truy cập, vừa gỡ tải khỏi backend.
- Nhớ: service worker đã cấu hình **không cache** `/media/*` (ADR-027), nếu đổi đường dẫn phát
  video thì rà lại `vite.config.ts` để không vô tình cache video vào máy người dùng.

---

## 5. Cắm OIDC AMIS thật (thay xác thực nội bộ)

### Seam nằm ở đâu

**`backend/src/modules/auth/auth.service.ts`** — comment ngay đầu class:

> *"Xác thực nội bộ (email + mật khẩu → JWT). Seam để GĐ7 thay bằng OIDC AMIS: chỉ cần đổi
> chỗ 'xác minh danh tính', phần cấp JWT/kiểm quyền giữ nguyên."*

Kiến trúc tách sẵn thành hai nửa (ADR-003/012):

1. **Xác minh danh tính** — `login()` hiện so mật khẩu bằng bcrypt. ⟵ *phần cần thay*
2. **Cấp JWT + phân quyền** — `issueTokens()`, `JwtAuthGuard`, `RolesGuard`, owner policy.
   ⟵ *giữ nguyên, không đụng tới*

Điểm cần lưu ý: `AuthService.ssoAmisMobile()` (GĐ6.1) đã là **ví dụ mẫu của chính seam này** —
nó xác minh danh tính bằng cơ chế khác (HMAC) rồi tái dùng nguyên `issueTokens()`. Cắm OIDC đi
theo đúng khuôn đó.

### Các bước khi đã có quyền truy cập OIDC provider của MISA

1. **Lấy thông tin từ đội IAM MISA:** discovery URL (`.../.well-known/openid-configuration`),
   `client_id`/`client_secret`, redirect URI được phép, scope cần thiết, và **claim nào chứa
   email MISA** (thường là `email` hoặc `preferred_username`).
2. **Chọn luồng.** Web SPA nên dùng **Authorization Code + PKCE**. *Luồng mà hạ tầng MISA hỗ
   trợ: cần xác nhận với đội IAM.*
3. **Backend:** thêm `openid-client` (hoặc thư viện tương đương), tạo hai endpoint
   `GET /api/auth/oidc/login` (chuyển hướng sang provider) và `GET /api/auth/oidc/callback`
   (đổi code lấy token, **xác minh chữ ký ID token qua JWKS** — không bao giờ chỉ decode).
4. **Ánh xạ người dùng:** lấy email từ claim đã xác minh → tra `users` theo email → tái dùng
   `issueTokens()` y hệt `ssoAmisMobile` đang làm.
5. **Quyết định nghiệp vụ cần chốt với chủ đầu tư — đừng tự quyết:**
   - Người đăng nhập OIDC thành công nhưng **chưa có trong bảng `users`** thì xử lý thế nào?
     Tự tạo tài khoản vai trò nào, hay từ chối và yêu cầu Quản trị cao nhất cấp trước?
     (Hiện `ssoAmisMobile` **từ chối** — an toàn hơn, nhưng cần xác nhận đúng ý nghiệp vụ.)
     **Lưu ý sau đợt RBAC 4 cấp (2026-08-05):** nếu chọn tự tạo, mặc định an toàn nhất là
     **`viewer` (Cấp 1 — chỉ xem)**, KHÔNG phải `employee`, vì Cấp 2 đã có quyền tạo phim.
   - Vai trò lấy từ đâu: vẫn quản lý trong Kho phim, hay đồng bộ từ nhóm/role bên AMIS?
   - **Phòng ban (`users.department_id`) lấy từ đâu?** Nó quyết định phạm vi quyền của Cấp 3
     (Trưởng phòng). Nếu AMIS có dữ liệu đơn vị/phòng ban thì nên đồng bộ về thay vì gán tay —
     cần chốt cách khớp (mã đơn vị AMIS ↔ `departments.name`?).
6. **Frontend:** thay form đăng nhập bằng nút "Đăng nhập bằng tài khoản MISA".
   Giữ `LoginView` cũ sau một cờ cấu hình để còn đường lui khi OIDC gặp sự cố.
7. **Sau khi chạy ổn:** vô hiệu hoá đăng nhập bằng mật khẩu nội bộ, nhưng **giữ lại một tài
   khoản super_admin đăng nhập cục bộ được** để cứu hộ khi OIDC hỏng.
8. **Dọn dẹp:** sau khi OIDC chạy thật, đánh giá lại xem còn cần `/auth/sso/amis-mobile`
   (mục 6) nữa không — nhiều khả năng OIDC thay thế luôn nó.

---

## 6. Hoàn thiện GĐ6.1 — SSO AMIS Mobile (WebView + bridge)

**Trạng thái hiện tại: SCAFFOLD, TẮT theo mặc định, KHÔNG được bật khi chưa xong checklist này.**

Đây là phần tổng hợp lại các placeholder đã ghi ở ADR-029/030 thành một danh sách kiểm.
Ba mục đầu **bắt buộc** có xác nhận từ đội AMIS Mobile — không thể suy đoán.

### Cần đội AMIS Mobile xác nhận

- [ ] **Cách app mẹ báo hiệu "đang nhúng".** Hiện dùng query param `?embedded=1`
      (`frontend/src/lib/amisBridge.ts` → `isEmbedded()`). Thực tế có thể là User-Agent riêng,
      custom scheme, hoặc cơ chế khác.
- [ ] **Cách app mẹ truyền token.** Hiện thử `window.AMISBridge.getToken()` trước, fallback
      query param `?ssoToken=...`. ‼️ **Fallback query param KHÔNG được dùng ở production** —
      token lộ trong URL (lịch sử trình duyệt, log máy chủ, header referrer). Đã giảm thiểu
      một phần bằng `Referrer-Policy: no-referrer` (GĐ7) nhưng **không** xử lý được lịch sử và
      log. Cơ chế đúng nhiều khả năng là `postMessage` hoặc bridge native.
- [ ] **Cách xác minh danh tính.** Hiện là HMAC-SHA256 với shared secret trên payload
      `{email, exp}` (`AuthService.verifySsoToken`) — **chỉ là placeholder**, không phải cơ chế
      chính thức. Nếu AMIS Mobile phát JWT có JWKS thì phải thay bằng xác minh JWKS thật.
- [ ] **Hành vi nút back cứng (Android) và vuốt back.** Đã expose sẵn
      `window.__khoPhimHandleNativeBack` để app mẹ gọi — cần xác nhận app mẹ gọi đúng như vậy.

### Việc kỹ thuật sau khi đã có spec

- [ ] Thay thân hàm `AuthService.verifySsoToken` bằng cơ chế xác minh thật.
      **Không đụng** phần sau nó (`issueTokens`/RBAC giữ nguyên).
- [ ] Thay `getBridgeToken()` và `isEmbedded()` trong `frontend/src/lib/amisBridge.ts`.
- [ ] **Bổ sung chống replay:** hiện chỉ giới hạn cửa sổ 300s
      (`AMIS_SSO_MAX_TTL_SECONDS`), chưa có nonce dùng một lần. Trong 300s đó, token bắt được
      vẫn dùng lại được (rủi ro B5).
- [ ] Chốt giá trị `X-Frame-Options`/CSP `frame-ancestors` trong `nginx/nginx.conf` — hiện cố
      tình để trống vì chưa biết cách nhúng (rủi ro B7).
- [ ] Chỉ khi hoàn tất tất cả mục trên mới đặt `AMIS_SSO_SHARED_SECRET` (≥ 32 ký tự, nếu vẫn
      còn dùng cơ chế HMAC). Secret ngắn hơn sẽ bị hệ thống từ chối bật.
- [ ] Kiểm thử trên thiết bị thật (iOS Safari + Android Chrome). **Chưa từng được kiểm thử
      trên thiết bị thật** — GĐ6 chỉ kiểm bằng resize trình duyệt desktop.

---

## 7. Cơ sở dữ liệu: migration, backup, rollback

### Migration
- 5 migration đăng ký **tường minh** (không dùng glob) trong `backend/src/database/db-options.ts`:
  `InitAuth` → `InitCatalog` → `AddFilmVersions` → `AddFilmViews` → `AddNotifications`.
- `migrationsRun: true` — migration **tự chạy khi backend khởi động**.
- ⚠️ **Cân nhắc cho production:** tự chạy lúc khởi động là tiện cho dev nhưng rủi ro khi chạy
  nhiều bản sao (nhiều instance cùng migrate một lúc). Nếu chạy nhiều replica, nên đặt
  `migrationsRun: false` và chạy migration ở một bước riêng trước khi triển khai:
  ```bash
  npm run build && npm run migration:run     # dùng dist/database/data-source.js
  ```
- `synchronize: false` — tuyệt đối **không** bật. Mọi thay đổi schema phải qua migration.

### Backup (chốt trước khi lên thật)
- MySQL: backup tự động hằng ngày + kiểm tra khôi phục thử định kỳ.
  **Bắt buộc `--default-character-set=utf8mb4`**, không sẽ hỏng tiếng Việt.
- Lưu trữ đối tượng: bật versioning/replication cho bucket. **Video không có ở đâu khác** —
  mất bucket là mất toàn bộ nội dung, DB chỉ giữ metadata trỏ tới key.
- Backup DB và backup storage phải khớp thời điểm nhau, nếu không sẽ có phim trỏ tới file
  không tồn tại (hoặc ngược lại).

### Rollback cơ bản
1. **Chỉ lỗi ứng dụng, schema không đổi:** triển khai lại image trước đó. Nhanh và an toàn.
2. **Có migration mới:** `npm run migration:revert` lùi **một** migration mỗi lần chạy. Phải
   **kiểm thử chiều revert ở môi trường staging trước** — chưa migration nào của dự án từng
   được chạy revert trên dữ liệu thật.
3. **Migration làm mất dữ liệu:** revert không cứu được. Khôi phục từ backup. Vì vậy: luôn
   snapshot DB **ngay trước** khi triển khai bản có migration.
4. Ghi lại phiên bản image + migration mới nhất của mỗi lần triển khai để biết đích lùi về.

---

## 8. Rủi ro bảo mật còn treo (tóm tắt)

Chi tiết đầy đủ kèm bằng chứng file:dòng ở `docs/danh-gia-an-ninh.md`. Bảng này để quyết định nhanh:

| Mã | Rủi ro | Mức | Cần trước khi lên prod? |
|---|---|---|---|
| R-09 | `/media/:key` công khai, chỉ dựa vào UUID | **Cao** | **Có**, nếu kho phim có nội dung nhạy cảm (xem mục 4) |
| R-01 | Token lưu `localStorage` (nhạy cảm với XSS) | TB | Cân nhắc — hiện chưa tìm thấy đường XSS nào |
| R-02 | Không thu hồi được refresh token khi đổi mật khẩu | TB | Nên — cần thêm cột `token_version` + migration |
| R-03 | SSO chưa chống replay bằng nonce | TB | Chỉ khi bật SSO (mục 6) |
| R-04 | Object mồ côi trên storage | Thấp | Job dọn dẹp định kỳ / lifecycle policy |
| R-05 | `npm audit` còn cảnh báo (chủ yếu `multer@1.x`) | Info | Nâng cấp cần nâng NestJS — làm ở nhánh riêng |
| R-06 | Audit log ghi ra stdout, chưa chống sửa đổi | Thấp | **Cần hạ tầng gom log tập trung** — xem ghi chú dưới |
| R-07 | Chưa chốt `X-Frame-Options`/CSP `frame-ancestors` | Thấp | Chốt cùng mục 6 (cách nhúng AMIS Mobile) |
| R-08 | Rate limit đếm trong bộ nhớ tiến trình | Có guard | Multi-replica bắt buộc `REDIS_URL`; cần xác nhận Redis HA/secret thật lúc go-live. |
| R-10 | Chưa phân trang `/films`, `/users` | Thấp | Sẽ thành vấn đề hiệu năng khi kho phim lớn dần |
| R-11 | Response không theo khuôn `{data}`/`{error}` chuẩn MISA | Info | Đổi sẽ phá vỡ toàn bộ frontend — cần quyết định riêng |
| — | Access token còn sống ≤ 15 phút sau khi khoá tài khoản | TB | Giảm thiểu tạm bằng cách rút ngắn `JWT_ACCESS_TTL` |
| — | Chính sách mật khẩu yếu (chỉ ≥ 8 ký tự) | Thấp | Tự hết nếu cắm OIDC (mục 5) |
| — | Không quét virus file tải lên | Thấp | Tuỳ mức độ yêu cầu |
| — | Chưa tắt tường minh HTTP TRACE ở nginx | Thấp | Express không xử lý TRACE nên rủi ro thực tế rất thấp |
| — | Chưa có quy trình rotate secret định kỳ | Thấp | Việc vận hành, chốt cùng secret manager |

**Hai việc phụ thuộc trực tiếp vào lựa chọn hạ tầng — cần xử lý khi chốt mục 2:**

- **R-06 — Nhật ký kiểm toán.** GĐ7 đã bổ sung ghi nhật ký cho 10 loại sự kiện nhạy cảm
  (đăng nhập thành công/thất bại, đổi mật khẩu, SSO, tạo/khoá/xoá tài khoản, xoá phim, xuất
  báo cáo CSV) — xem `backend/src/common/audit/audit-log.ts`. Nhật ký ghi ra **stdout** với
  tiền tố `[Audit]`. Để có giá trị điều tra thật, hạ tầng cần: gom log tập trung, quyền
  chỉ-ghi (người bị điều tra không xoá được dấu vết), và **thời hạn lưu dài hơn** log gỡ lỗi
  thông thường. Nếu MISA yêu cầu tuân thủ chặt hơn, cân nhắc ghi thêm vào bảng `audit_logs`
  riêng (cần migration + chốt chính sách lưu trữ).
- **R-08 — Rate limit khi chạy nhiều bản sao.** Đã chuyển có điều kiện: `MULTI_REPLICA=true`
  thiếu `REDIS_URL` sẽ fail-fast; có URL thì throttler dùng Redis shared. Redis HA và credential
  phải do hạ tầng quản lý qua secret manager.
  Readiness cũng PING Redis: Redis chết thì Pod trả `503` ở `/api/health/ready` và Kubernetes
  ngừng route traffic, còn liveness vẫn không restart mù. Chạy rehearsal local lặp lại bằng
  `./scripts/rehearse-multi-replica.sh` (hai process + Redis thật, tự flush counter, request
  thứ 11 xen kẽ phải trả `429`). `docker-compose.multi-replica.yml` là overlay của script.

### Rehearsal restore backup (bắt buộc trước release migration)

Chạy `./scripts/rehearse-db-restore.sh` từ root. Script chỉ dump source theo single transaction,
restore vào DB mới có prefix `kho_phim_restore_rehearsal` rồi so khớp số dòng `users`, `films`,
`migrations`; **không tự DROP bất kỳ database nào**. Đây xác minh backup/restore thực sự chạy
được, không thay thế rehearsal migration trên snapshot pre-release do MISA vận hành.

---

## 9. Checklist trước khi bấm nút go-live

- [ ] Đã xoá `ALLOW_INSECURE_CONFIG` khỏi `.env` production (mục 0)
- [ ] Secret JWT sinh mới, khác nhau, quản lý qua secret manager, không nằm trong repo
- [ ] Credentials MinIO/S3 là tài khoản riêng, không phải `minioadmin`
- [ ] `MINIO_PUBLIC_ENDPOINT` trỏ domain HTTPS thật + CORS đã cấu hình + **đã tải thử một
      video lên bằng trình duyệt thật**
- [ ] TLS/HTTPS đã bật; cân nhắc bật HSTS trong `nginx/nginx.conf`
- [ ] MySQL utf8mb4 + backup tự động + đã thử khôi phục thành công một lần
- [ ] Chiến lược migration đã chốt (tự chạy lúc khởi động, hay bước riêng)
- [ ] `ENABLE_API_DOCS=false` (hoặc `/api/docs` nằm sau VPN/IP allowlist)
- [ ] `CORS_ORIGINS` đúng (để rỗng nếu cùng origin)
- [ ] Đã đăng nhập bằng super_admin seed và **đổi mật khẩu ngay**
- [ ] Kiểm khói: đăng nhập → xem danh sách phim → phát một phim (tua được) → tải phim lên →
      xuất báo cáo CSV (mở bằng Excel thấy tiếng Việt đúng)
- [ ] Kiểm phân quyền trên môi trường thật: tài khoản nhân viên **không** sửa được phim người
      khác và **không** vào được `/admin/users`, `/admin/reports`
- [ ] `AMIS_SSO_SHARED_SECRET` vẫn để **rỗng** (trừ khi đã hoàn thành toàn bộ mục 6)
- [ ] Log tập trung + cảnh báo khi container khởi động lại liên tục (bắt được trường hợp
      backend từ chối khởi động vì cấu hình sai)
- [ ] Orchestrator trỏ liveness vào `/api/health` và readiness vào `/api/health/ready`
      (không dùng chung một endpoint cho cả hai)
- [ ] **ĐIỀU KIỆN NGHIỆM THU nhật ký kiểm toán (R-06)** — cả 3 mục, không bỏ mục nào:
      (a) log có tiền tố `[Audit]` được gom về hệ thống log tập trung;
      (b) kho log đó cấu hình quyền **chỉ-ghi** — tài khoản vận hành ứng dụng và quản trị viên
          trong app KHÔNG xoá/sửa được bản ghi đã ghi (đây là yêu cầu cốt lõi của baseline §7:
          nhật ký phải không bị chính đối tượng đang bị điều tra xoá dấu vết);
      (c) thời hạn lưu **dài hơn** log gỡ lỗi thông thường, theo chính sách tuân thủ của MISA.
      Nếu thiếu (b), nhật ký kiểm toán chỉ có giá trị vận hành, KHÔNG có giá trị điều tra —
      phải nói rõ điều đó với chủ dự án thay vì coi như đã đạt.
- [ ] Nếu chạy nhiều bản sao: Secret có `REDIS_URL`, test rate limit chung giữa >=2 Pod;
      migration Job hoàn tất trước rollout và CronJob sweep đang chạy (`deploy/k8s/README.md`).

---

## 10. Kiểm thử tự động & CI

### Đã có sẵn CI — `.github/workflows/ci.yml`

Chạy trên mỗi push/PR vào `main` (và chạy tay qua `workflow_dispatch`). **4 job:**

| Job | Nội dung |
|---|---|
| `backend` | `npm ci` → `npm run build` → `npm test` (129 unit test) |
| `backend-e2e` | Dựng service MySQL 8.0 → `npm run test:e2e` (46 test tích hợp trên DB thật) |
| `frontend` | `npm ci` → `npm test` (26 test) → `npm run build` (kèm kiểm kiểu `vue-tsc`) |
| `audit` | Quét lỗ hổng phụ thuộc |

> **Cổng chặn bắt buộc** theo chuẩn Backend MISA `13-devops-lifecycle.md` §1: **không hợp
> nhất vào `main` khi CI đỏ.** Cần bật branch protection cho nhánh `main` trên GitHub
> (Settings → Branches → Require status checks to pass) — đây là **việc DevOps phải làm**,
> file workflow tự nó không ép được.

**Về ngưỡng của job `audit` — đọc kỹ trước khi đổi:** cổng chặn đặt ở
`npm audit --omit=dev --audit-level=critical`, tức chỉ chặn khi có lỗ hổng **critical** trong
**dependency production**. Hai lựa chọn này đều có chủ đích:
- `--omit=dev`: devDependency (jest, vite, `@nestjs/cli`) **không đi vào image production**
  vì Dockerfile cài bằng `npm ci --omit=dev`. Chặn theo chúng là báo động giả.
- `critical` thay vì `high`: hiện còn 9 CVE mức high trong nhánh phụ thuộc của NestJS 10 mà
  **mọi bản vá đều đòi nâng major** (xem R-05). Đặt ngưỡng `high` ngay bây giờ khiến CI đỏ
  vĩnh viễn và mất hẳn tác dụng cảnh báo. **Sau khi nâng NestJS lên 11, hạ ngưỡng xuống
  `high`** — đã ghi thành TODO ngay trong file workflow.

### Chạy tay ở máy local

```bash
cd backend  && npm ci && npm run build && npm test      # 129 unit test
cd frontend && npm ci && npm run build && npm test      # 26 test

# Kiểm thử tích hợp — cần MySQL đang chạy (docker compose up -d mysql).
# Dùng database RIÊNG `kho_phim_e2e`, KHÔNG chạm vào dữ liệu dev.
cd backend && npm run test:e2e                          # 46 test

# Kiểm thử đồng thời — cần TOÀN BỘ stack đang chạy (docker compose up -d).
# Mất ~2,5 phút vì cố ý tôn trọng rate limit đăng nhập thật thay vì nới lỏng nó.
cd backend && npm run test:concurrency
```

**Kiểm thử đồng thời không nằm trong CI** — nó cần cả stack (nginx + backend + MySQL) chạy
thật và mất vài phút. Chạy tay trước mỗi lần phát hành, hoặc khi sửa bất cứ thứ gì chạm vào
`recordView`. Chính script này đã phát hiện ra một race condition thật ở GĐ7.

Trọng tâm bộ test là **phần rủi ro cao**: guard xác thực, ma trận phân quyền, quyền sở hữu
(IDOR), luồng SSO, chốt chặn cấu hình, xuất CSV, đếm lượt xem dưới tải đồng thời. Cố ý
**không** phủ CRUD đơn giản không có logic — xem `docs/danh-gia-an-ninh.md`.

### Chưa có (cần DevOps bổ sung)

- **CD (triển khai tự động)** — chưa có, vì chưa biết nền tảng đích (mục 2).
  `13-devops-lifecycle.md` §1 khuyến nghị bán tự động: tự động chuẩn bị, cần một bước xác
  nhận thủ công trước khi đưa lên môi trường quan trọng nhất.
- **Kiểm thử component UI** — chưa có. UI được kiểm thủ công có chủ đích trên trình duyệt
  thật qua từng Review Gate, đúng `07-testing-strategy.md` §6 (xác minh thủ công là hợp lệ
  khi tự động hoá khó, miễn là nói rõ giới hạn).
- **Kiểm thử trên thiết bị di động thật** (iOS Safari / Android Chrome) — tồn đọng từ GĐ6.
