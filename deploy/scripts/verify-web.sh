#!/usr/bin/env bash
set -euo pipefail

ADMIN_USER="${ADMIN_USER:-ops-admin}"
ADMIN_PASS="${ADMIN_PASS:-}"

if [[ -z "${ADMIN_PASS}" ]]; then
  echo "Set ADMIN_PASS env var to verify authenticated admin routes"
  exit 1
fi

set -x
curl -fsSI https://404n0tf0und.net
curl -fsS https://404n0tf0und.net/api/public

# Public host must not expose private API
code="$(curl -sS -o /tmp/public-admin-deny.txt -w '%{http_code}' https://404n0tf0und.net/api/admin/security)"
[[ "$code" == "403" ]]

# Private hosts require auth
code_admin_anon="$(curl -sS -o /tmp/admin-anon.txt -w '%{http_code}' https://admin.404n0tf0und.net/)"
[[ "$code_admin_anon" == "401" ]]

curl -fsSI -u "${ADMIN_USER}:${ADMIN_PASS}" https://admin.404n0tf0und.net/
curl -fsS -u "${ADMIN_USER}:${ADMIN_PASS}" https://admin.404n0tf0und.net/api/admin/health
curl -fsSI -u "${ADMIN_USER}:${ADMIN_PASS}" https://security-admin.404n0tf0und.net/
curl -fsS -u "${ADMIN_USER}:${ADMIN_PASS}" https://security-admin.404n0tf0und.net/api/admin/security

# Ensure private pages are marked noindex
curl -fsSI -u "${ADMIN_USER}:${ADMIN_PASS}" https://admin.404n0tf0und.net/ | rg -i "x-robots-tag: noindex"
curl -fsSI -u "${ADMIN_USER}:${ADMIN_PASS}" https://security-admin.404n0tf0und.net/ | rg -i "x-robots-tag: noindex"
curl -fsSI -u "${ADMIN_USER}:${ADMIN_PASS}" https://kuma.404n0tf0und.net/
curl -fsSI -u "${ADMIN_USER}:${ADMIN_PASS}" https://netdata.404n0tf0und.net/

echo "web verification passed"
