#!/usr/bin/env bash
set -euo pipefail

# Dựng hai backend process độc lập cùng Redis, rồi chứng minh limit được chia sẻ bằng request
# xen kẽ. Không dùng nginx làm nguồn chứng minh vì mục tiêu là phân biệt chính xác hai process.
compose=(docker compose -f docker-compose.yml -f docker-compose.multi-replica.yml)

"${compose[@]}" up -d --build redis backend backend-2

for endpoint in http://127.0.0.1:8301/api/health/ready http://127.0.0.1:8302/api/health/ready; do
  for attempt in {1..20}; do
    if curl --fail --silent "$endpoint" >/dev/null 2>&1; then break; fi
    if [[ "$attempt" == 20 ]]; then
      echo "Backend rehearsal không ready: $endpoint" >&2
      exit 1
    fi
    sleep 1
  done
done

"${compose[@]}" exec -T redis redis-cli FLUSHDB >/dev/null
(cd backend && npm run test:multi-replica)
