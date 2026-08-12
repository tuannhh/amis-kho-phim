# Docker Swarm multi-container runbook

Docker Compose ở gốc chỉ dành cho development. Khi dùng Swarm, deploy backend với `replicas >= 2`,
`MULTI_REPLICA=true`, `RUN_MIGRATIONS_ON_BOOT=false` và truyền `REDIS_URL` từ Swarm secret/config
trỏ tới Redis HA dùng chung. Không publish MySQL/MinIO nội bộ ra Internet.

Trước mỗi `docker stack deploy`, chạy đúng một task one-shot từ cùng immutable backend image:

```sh
docker run --rm --network <stack>_default --env-file production.env \
  -e MULTI_REPLICA=true -e RUN_MIGRATIONS_ON_BOOT=false \
  REGISTRY/amis-kho-phim-backend:TAG npm run migration:run
```

Đặt scheduler ngoài Swarm (CI scheduler, Rundeck hoặc MISA platform scheduler) chạy mỗi 15 phút
`node dist/jobs/sweep-upload-intents.js` với cùng secret/network. Job sweep có atomic reservation,
nên retry an toàn; chỉ scheduler được phép chạy một instance tại một thời điểm.
