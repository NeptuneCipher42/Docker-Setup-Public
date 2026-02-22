#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

sudo mkdir -p /etc/statusd /var/lib/statusd /opt/statusd
sudo cp "${REPO_DIR}/deploy/systemd/statusd.service" /etc/systemd/system/statusd.service
sudo cp "${REPO_DIR}/deploy/systemd/security-scan.service" /etc/systemd/system/security-scan.service
sudo cp "${REPO_DIR}/deploy/systemd/security-scan.timer" /etc/systemd/system/security-scan.timer

sudo install -m 0755 "${REPO_DIR}/deploy/scripts/run-security-scan.sh" /usr/local/bin/statusd-security-scan

pushd "${REPO_DIR}/status-service" >/dev/null
GOCACHE=/tmp/go-build go build -o /tmp/statusd ./cmd/statusd
popd >/dev/null
sudo install -m 0755 /tmp/statusd /usr/local/bin/statusd
rm -f /tmp/statusd

if [[ ! -f /etc/statusd/statusd.env ]]; then
  cat <<'ENV' | sudo tee /etc/statusd/statusd.env >/dev/null
STATUSD_LISTEN=0.0.0.0:9191
STATUSD_CACHE_TTL_SECONDS=10
STATUSD_DATA_DIR=/var/lib/statusd
STATUSD_WG_SUBNET=10.8.0.0/24
SCAN_TARGETS=404n0tf0und.net,git.404n0tf0und.net,cloud.404n0tf0und.net,127.0.0.1
ENV
fi

sudo systemctl daemon-reload
sudo systemctl enable statusd.service
sudo systemctl restart statusd.service
sudo systemctl enable --now security-scan.timer

echo "statusd + security timer installed"
