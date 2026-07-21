# AMIS Kho phim — Active Context

> "Đang làm gì ngay lúc này". File đọc đầu tiên khi mở lại phiên làm việc
> (đặc biệt sau khi clear context — đọc file này trước, không cần đọc lại lịch sử chat).

## Tóm tắt nhanh (đọc 30 giây là hiểu hết)
- **Đã xong**: GĐ 0 + GĐ 0.5 (UI mock) + GĐ 1 (Auth & RBAC thật) + **GĐ 2 (Chuyên mục & Phim
  core API thật)** — GĐ 2 verify end-to-end Docker + trình duyệt (2026-07-21, làm bằng Sonnet 5).
  Chi tiết: 04-progress.md mục "Nhật ký GĐ 2"; quyết định: ADR-015→018 trong 05-decisions.md.
- **GĐ 2 làm gì**: CategoriesModule (cây cha-con, CRUD, slug tự sinh), FilmsModule (metadata +
  link ngoài youtube/vimeo/gdrive/misadrive + hashtag, CRUD, slug tự sinh, `assertCanManage` =
  OwnerGuard thật theo uploaderId). FE: `filmsApi`/`filmsStore`/`categoriesApi` thay hoàn toàn
  `mockFilms.ts`/`mockCategories.ts` (đã xoá). **Chưa có storage/thumbnail thật** (MinIO) — form
  vẫn có MUpload nhưng chỉ xem trước phiên làm việc, có ghi chú rõ (ADR-018, đúng scope GĐ3).
- **Đăng nhập** (seed từ .env): `superadmin@misa.com.vn` / `Admin@12345` (đổi ở prod!).
- **DB hiện SẠCH** (đã `docker compose down -v && up -d` sau khi verify để trả về trạng thái
  sạch trước khi bàn giao) — không còn user/category/film test nào ngoài seed super_admin.
- **Chưa push GitHub GĐ 2** — việc tiếp theo là commit (khi chủ đầu tư đồng ý). Docker hiện
  **đang chạy**. Nghỉ phiên thì `docker compose down` (giữ volume — nhưng lưu ý volume hiện chỉ
  có seed sạch, không có dữ liệu quan trọng cần giữ).
- **Việc tiếp theo — GĐ 3 (Storage & Thumbnail, MinIO thật)**: xem checklist bên dưới.
- **Model**: GĐ 3 nên dùng **Opus 4.8** (streaming/range dễ sai — theo 03-roadmap.md).

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

## GĐ 3 — checklist (Storage & Thumbnail, MinIO thật) — CHƯA BẮT ĐẦU
- [ ] BE StorageModule: tích hợp MinIO SDK (@aws-sdk/client-s3 hoặc minio client), upload/presigned URL
- [ ] BE stream Range (206 Partial Content) cho `/media/:key` (nginx đã cấu hình sẵn proxy Range ở GĐ0)
- [ ] Thêm `film_versions` HOẶC field storage_key/thumbnail_key vào films (xem 01-architecture.md §4)
- [ ] FE FilmUploadView: đổi ghi chú "chưa lưu" → thật sự gửi file lên `/api/storage/upload`, xoá TODO
- [ ] FE VideoPlayer: nguồn `storage` dùng `<video src="/media/:key">` thật (đã có UI sẵn từ GĐ0.5)
- [ ] Validate thumbnail tỷ lệ 16:9; giới hạn dung lượng (MAX_UPLOAD_MB trong .env)
- [ ] Review Gate: upload file thật qua Docker, tua/seek (Range) hoạt động, F5 vẫn còn ảnh/phim

## Cấu trúc code hiện tại (đã hết mock — toàn bộ API thật GĐ1+GĐ2)
- `frontend/src/features/films/filmTypes.ts` — FilmSource, SOURCE_LABEL/ICON, categoryColorFor,
  thumbnailGradient (suy ra từ categoryId — ADR-017), isFilmNew/publishedTime/formatVNDate (ISO date)
- `frontend/src/features/films/filmsApi.ts` + `filmsStore.ts` (Pinia, refetch toàn bộ sau mutation)
- `frontend/src/features/categories/categoriesApi.ts` — tree() + flattenCategoryTree()
- `frontend/src/features/films/searchState.ts` — ô tìm kiếm DUY NHẤT dùng chung (header ghi, Kho phim đọc)
- `frontend/src/components/VideoPlayer.vue` — player đa nguồn (storage chưa có link thật tới GĐ3)
- Backend: `modules/categories/`, `modules/films/` (Film, FilmLink, Hashtag entities) — theo đúng
  01-architecture.md §4 (bảng riêng, không JSON column — ADR-016)

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
