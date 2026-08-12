# K8s multi-replica runbook

Các manifest này là template production, cố ý không chứa secret hoặc hostname thật. Tạo Secret
`amis-kho-phim-runtime` bằng secret manager của môi trường với toàn bộ biến production hiện có,
và bắt buộc thêm `REDIS_URL` trỏ Redis dùng chung (TLS/auth theo hạ tầng MISA).

Thứ tự deploy bắt buộc:

1. Thay `REGISTRY/amis-kho-phim-backend:TAG` bằng immutable image tag của release.
2. Apply namespace/secret, chạy `migration-job.yaml` và chờ Job `Complete`.
3. Apply Deployment/Service/PDB/CronJob. Tất cả web replica đặt `RUN_MIGRATIONS_ON_BOOT=false`.
4. Canary 1 replica rồi scale 3; kiểm `/api/health` và `/api/health/ready`; xác nhận Redis rate
   limit được share bằng cách gọi login qua nhiều Pod.
5. Rollback image Deployment nếu smoke test lỗi; migration rollback chỉ thực hiện bằng runbook
   đã duyệt và backup DB, không tự rollback schema khi traffic còn hoạt động.

`migration-job.yaml` dùng tên có `TAG`; pipeline phải render tên mới cho từng release thay vì
apply lại Job cũ đã complete. CronJob sweep chạy tách khỏi web Pod nên object hết hạn vẫn được
dọn khi không có request upload mới.
