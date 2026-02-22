#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_DIR="${HOME}/.dotfishingbot/cloudflare"
TARGET_FILE="${TARGET_DIR}/ddns.sh"

mkdir -p "${TARGET_DIR}"
cp "${REPO_DIR}/scripts/cloudflare-ddns.sh" "${TARGET_FILE}"
chmod +x "${TARGET_FILE}"

echo "installed ddns script to ${TARGET_FILE}"
echo "export CF_API_TOKEN and ZONE_ID before running"
