#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="$(basename "${REPO_DIR}" | tr '[:upper:]' '[:lower:]')"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ROOT="${BACKUP_ROOT:-${REPO_DIR}/deploy/backups}"
DEST_DIR="${BACKUP_ROOT}/${STAMP}"

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

mkdir -p "${DEST_DIR}"

echo "Backing up Docker volumes into: ${DEST_DIR}"
for short in "${VOLUMES[@]}"; do
  full="${PROJECT}_${short}"
  if ! docker volume inspect "${full}" >/dev/null 2>&1; then
    echo "- skip ${full} (not present)"
    continue
  fi
  echo "- backup ${full}"
  docker run --rm \
    -v "${full}:/from:ro" \
    -v "${DEST_DIR}:/to" \
    alpine:3.20 \
    sh -lc "tar -czf /to/${short}.tar.gz -C /from ."
done

cat > "${DEST_DIR}/MANIFEST.txt" <<MANIFEST
backup_time_utc=${STAMP}
project=${PROJECT}
source_repo=${REPO_DIR}
MANIFEST

echo "Backup complete: ${DEST_DIR}"
