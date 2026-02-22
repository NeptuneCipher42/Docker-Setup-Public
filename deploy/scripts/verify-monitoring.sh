#!/usr/bin/env bash
set -euo pipefail

set -x
systemctl is-active statusd
systemctl is-active security-scan.timer
systemctl list-timers --all | rg security-scan || true
curl -fsS http://127.0.0.1:9191/public
curl -fsS http://127.0.0.1:9191/admin/health
curl -fsS http://127.0.0.1:9191/admin/security
curl -fsS http://127.0.0.1:9191/admin/security/tasks
