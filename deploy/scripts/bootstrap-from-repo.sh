#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_DIR}"

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found in repo root."
  echo "Copy .env.example to .env and fill required values first."
  exit 1
fi

# Pull latest committed state before deploy.
git pull --ff-only || true

echo "[1/6] Redeploying core stack + status service"
./deploy/scripts/redeploy.sh

echo "[2/6] Installing DDNS helper"
./deploy/scripts/install-ddns.sh

get_env() {
  local key="$1"
  awk -F= -v k="$key" '$1==k {sub(/^[^=]*=/,""); print; exit}' .env
}

CF_API_TOKEN_VAL="$(get_env CF_API_TOKEN)"
if [[ -z "${CF_API_TOKEN_VAL}" ]]; then
  CF_API_TOKEN_VAL="$(get_env CLOUDFLARE_API_TOKEN)"
fi
ZONE_ID_VAL="$(get_env ZONE_ID)"

if [[ -n "${CF_API_TOKEN_VAL}" && -n "${ZONE_ID_VAL}" ]]; then
  echo "[3/6] Running DDNS update"
  CF_API_TOKEN="${CF_API_TOKEN_VAL}" ZONE_ID="${ZONE_ID_VAL}" ./scripts/cloudflare-ddns.sh
else
  echo "[3/6] Skipping DDNS update (CF_API_TOKEN/CLOUDFLARE_API_TOKEN or ZONE_ID missing in .env)"
fi

echo "[4/6] Running monitoring verification"
./deploy/scripts/verify-monitoring.sh

ADMIN_PASS_VAL="$(get_env ADMIN_PASS)"
if [[ -n "${ADMIN_PASS_VAL}" ]]; then
  echo "[5/6] Running web verification"
  ADMIN_USER="${ADMIN_USER:-ops-admin}" ADMIN_PASS="${ADMIN_PASS_VAL}" ./deploy/scripts/verify-web.sh
else
  echo "[5/6] Skipping web verification (ADMIN_PASS not set in .env)"
fi

echo "Bootstrap complete."
