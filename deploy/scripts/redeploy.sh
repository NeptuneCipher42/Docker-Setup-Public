#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

pushd "${REPO_DIR}" >/dev/null

docker compose up -d
docker compose --profile tools up -d
"${REPO_DIR}/deploy/scripts/install-statusd.sh"

echo "running one immediate security scan"
sudo systemctl start security-scan.service

popd >/dev/null

echo "redeploy complete"
