# AMIS Kho phim — Tech Context

## Stack chốt
| Lớp | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | Vue 3 + Vite + TypeScript + Tailwind CSS + MISA Design System (MDS 2.0) | PWA qua `vite-plugin-pwa` |
| State/Data | Pinia + TanStack Query (hoặc axios + composable) | |
| Backend | Node.js LTS + NestJS + TypeScript | module hoá, DI |
| ORM | TypeORM (hoặc Prisma) | migration versioned |
| Database | MySQL 8, `utf8mb4_unicode_ci` | |
| Storage | MinIO (S3 API) qua AWS SDK v3 | presigned URL, range |
| Auth | JWT (access+refresh), bcrypt/argon2 | chỗ cắm OIDC AMIS sau |
| Reverse proxy | nginx | serve FE + proxy /api + /media |
| Container | Docker + Docker Compose | 5 service |
| Test | Vitest (FE) + Jest (BE) + Supertest (e2e) | |

## Cấu trúc thư mục (dự kiến)
```
amis-kho-phim/
├── docker-compose.yml
├── .env.example
├── memory-bank/            # tài liệu sống — luôn cập nhật
├── docs/                   # API spec, quy trình nội bộ
├── backend/
│   ├── src/
│   │   ├── modules/{auth,users,rbac,categories,films,film-links,
│   │   │             hashtags,storage,thumbnails,notifications,search}/
│   │   ├── common/         # guard, interceptor, filter, dto-base
│   │   ├── config/
│   │   └── main.ts
│   ├── test/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── features/{auth,films,categories,upload,search,admin}/
│   │   ├── components/     # dùng chung (VideoPlayer, FilmCard...)
│   │   ├── stores/         # Pinia
│   │   ├── router/
│   │   └── main.ts
│   ├── public/manifest.webmanifest
│   └── Dockerfile
└── nginx/nginx.conf
```

## Biến môi trường chính (.env)
`MYSQL_*`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`,
`MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MAX_UPLOAD_MB`, `NEW_FILM_TTL_DAYS=14`, `VITE_API_BASE`.

## Quy ước
- Commit theo Conventional Commits; nhánh `feat/<module>`.
- Migration bắt buộc cho mọi thay đổi schema (không sửa tay DB).
- Mỗi module có README ngắn mô tả trách nhiệm + API.
- Không hard-code secret; dùng `.env` + `.env.example`.

## Bảo mật (kế thừa bài học audit AMIS Kho ảnh v2)
- Kiểm tra quyền ở **backend** (không tin FE).
- Owner policy cho nhân viên ở tầng service, không chỉ ở guard route.
- Validate MIME/đuôi/kích thước file upload; chống path traversal ở storage key.
- Presigned URL có thời hạn ngắn; không lộ credential MinIO ra FE.
- Rate limit login; refresh token rotation.
