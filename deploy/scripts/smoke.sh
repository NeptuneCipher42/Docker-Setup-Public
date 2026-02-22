#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[1/4] Running Go tests"
( cd "${REPO_DIR}" && make test )

echo "[2/4] Verifying local monitoring"
"${REPO_DIR}/deploy/scripts/verify-monitoring.sh"

echo "[3/4] Verifying web routes"
if [[ -n "${ADMIN_PASS:-}" ]]; then
  "${REPO_DIR}/deploy/scripts/verify-web.sh"
else
  echo "ADMIN_PASS not set; skipping verify-web.sh"
fi

echo "[4/4] DDNS dry-run"
if [[ -n "${CF_API_TOKEN:-}" && -n "${ZONE_ID:-}" ]]; then
  "${REPO_DIR}/scripts/cloudflare-ddns.sh" --dry-run
else
  echo "CF_API_TOKEN/ZONE_ID not set; skipping DDNS dry-run"
fi

echo "Smoke checks complete"
