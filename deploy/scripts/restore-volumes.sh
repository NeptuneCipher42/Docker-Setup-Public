#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup-dir>"
  exit 1
fi

BACKUP_DIR="$1"
if [[ ! -d "${BACKUP_DIR}" ]]; then
  echo "Backup dir not found: ${BACKUP_DIR}"
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="$(basename "${REPO_DIR}" | tr '[:upper:]' '[:lower:]')"

VOLUMES=(
  caddy_data
  caddy_config
  db_data
  gitea_data
  nextcloud_data
  uptime_kuma_data
  netdata_config
  netdata_lib
  netdata_cache
)

echo "Stopping stack before restore"
( cd "${REPO_DIR}" && docker compose down )

for short in "${VOLUMES[@]}"; do
  archive="${BACKUP_DIR}/${short}.tar.gz"
  [[ -f "${archive}" ]] || continue

  full="${PROJECT}_${short}"
  echo "Restoring ${full} from ${archive}"
  docker volume create "${full}" >/dev/null
  docker run --rm \
    -v "${full}:/to" \
    -v "${BACKUP_DIR}:/from:ro" \
    alpine:3.20 \
    sh -lc "rm -rf /to/* /to/.[!.]* /to/..?* 2>/dev/null || true; tar -xzf /from/${short}.tar.gz -C /to"
done

echo "Restore complete. Start services with: docker compose up -d"
