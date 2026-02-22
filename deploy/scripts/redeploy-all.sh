#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"${REPO_DIR}/deploy/scripts/redeploy.sh"

if [[ -n "${CF_API_TOKEN:-}" && -n "${ZONE_ID:-}" ]]; then
  "${REPO_DIR}/scripts/cloudflare-ddns.sh"
else
  echo "CF_API_TOKEN/ZONE_ID not set; skipping DDNS update"
fi

echo "Running smoke checks"
"${REPO_DIR}/deploy/scripts/smoke.sh"
