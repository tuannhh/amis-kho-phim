#!/usr/bin/env bash
set -euo pipefail

# Rehearsal KHÔNG phá dữ liệu nguồn: dump nhất quán DB dev/staging rồi restore vào database
# mới. Không tự DROP database rehearsal để một thao tác nhầm không thể xoá bản kiểm chứng cũ.
source_db="${SOURCE_DB:-${DB_NAME:-kho_phim}}"
target_db="${RESTORE_REHEARSAL_DB:-kho_phim_restore_rehearsal}"

if [[ ! "$source_db" =~ ^[A-Za-z0-9_]+$ || ! "$target_db" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo 'SOURCE_DB và RESTORE_REHEARSAL_DB chỉ được gồm chữ, số, dấu gạch dưới.' >&2
  exit 2
fi
if [[ "$source_db" == "$target_db" || "$target_db" != kho_phim_restore_rehearsal* ]]; then
  echo 'Target phải khác source và có prefix kho_phim_restore_rehearsal để tránh ghi nhầm DB.' >&2
  exit 2
fi

if docker compose exec -T mysql sh -ec 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -Nse "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME=\"$1\""' sh "$target_db" | grep -qx "$target_db"; then
  echo "DB rehearsal $target_db đã tồn tại; dừng an toàn, không tự DROP. Chọn tên mới hoặc tự xoá sau khi duyệt." >&2
  exit 3
fi

dump_file="$(mktemp "${TMPDIR:-/tmp}/amis-kho-phim-${source_db}-XXXXXX.sql")"
trap 'rm -f "$dump_file"' EXIT

echo "[1/4] Dump nhất quán từ $source_db (single transaction, không in dữ liệu ra terminal)"
docker compose exec -T mysql sh -ec 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers "$1"' sh "$source_db" > "$dump_file"

echo "[2/4] Tạo DB rehearsal rỗng $target_db"
docker compose exec -T mysql sh -ec 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE \`$1\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"' sh "$target_db"

echo "[3/4] Restore dump vào $target_db"
docker compose exec -T mysql sh -ec 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$1"' sh "$target_db" < "$dump_file"

echo "[4/4] So khớp số dòng trọng yếu và migration"
source_counts="$(docker compose exec -T mysql sh -ec 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -Nse "SELECT (SELECT COUNT(*) FROM \`$1\`.users), (SELECT COUNT(*) FROM \`$1\`.films), (SELECT COUNT(*) FROM \`$1\`.migrations)"' sh "$source_db")"
target_counts="$(docker compose exec -T mysql sh -ec 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -Nse "SELECT (SELECT COUNT(*) FROM \`$1\`.users), (SELECT COUNT(*) FROM \`$1\`.films), (SELECT COUNT(*) FROM \`$1\`.migrations)"' sh "$target_db")"
if [[ "$source_counts" != "$target_counts" ]]; then
  echo "Restore mismatch: source=$source_counts target=$target_counts" >&2
  exit 4
fi

echo "PASS restore rehearsal: $target_db (users, films, migrations = $target_counts)"
echo "Giữ DB rehearsal để kiểm tra; chỉ xoá sau khi người phụ trách đã duyệt kết quả."
