#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

CF_API_TOKEN="${CF_API_TOKEN:-}"
ZONE_ID="${ZONE_ID:-}"
ROOT_DOMAIN="${ROOT_DOMAIN:-404n0tf0und.net}"
ADDITIONAL_HOSTS="${ADDITIONAL_HOSTS:-git,cloud,admin,security-admin,kuma,netdata}"
API_BASE="https://api.cloudflare.com/client/v4"
CF_PROXIED="${CF_PROXIED:-false}"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || { log "missing required command: $1"; exit 1; }; }
require_cmd curl
require_cmd python3

if [[ -z "$CF_API_TOKEN" || -z "$ZONE_ID" ]]; then
  log "CF_API_TOKEN and ZONE_ID are required"
  exit 1
fi

get_public_ip() {
  local ip
  ip="$(curl -4fsS --max-time 10 https://ifconfig.me 2>/dev/null || true)"
  [[ -n "$ip" ]] || ip="$(curl -4fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)"
  [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || { log "failed to detect valid public IPv4"; exit 1; }
  printf '%s' "$ip"
}

get_public_ipv6() {
  local ip
  ip="$(curl -6fsS --max-time 10 https://ifconfig.me 2>/dev/null || true)"
  [[ -n "$ip" ]] || ip="$(curl -6fsS --max-time 10 https://api64.ipify.org 2>/dev/null || true)"
  [[ "$ip" == *:* ]] || { log "no public IPv6 detected"; return 1; }
  printf '%s' "$ip"
}

cf_parse_field() {
  local mode="$1" raw="$2"
  python3 - "$mode" "$raw" <<'PY'
import json,sys
mode = sys.argv[1]
raw = sys.argv[2]
try:
    data = json.loads(raw) if raw else {}
except Exception:
    print('')
    sys.exit(0)
if mode == 'id':
    res = data.get('result') or []
    print(res[0].get('id','') if isinstance(res, list) and res else '')
elif mode == 'ok':
    print('true' if data.get('success') else 'false')
elif mode == 'errors':
    errs = data.get('errors') or []
    print('; '.join(str(e.get('message', e)) for e in errs) if errs else '')
PY
}

cf_find_record_id() {
  local fqdn="$1" type="$2" response
  response="$(curl -fsS -G "${API_BASE}/zones/${ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data-urlencode "type=${type}" \
    --data-urlencode "name=${fqdn}" \
    --data-urlencode "per_page=1")"
  cf_parse_field id "$response"
}

cf_upsert_record() {
  local fqdn="$1" type="$2" ip="$3"
  local existing_id payload endpoint method response ok err
  payload="$(printf '{"type":"%s","name":"%s","content":"%s","ttl":300,"proxied":%s}' "$type" "$fqdn" "$ip" "$CF_PROXIED")"
  existing_id="$(cf_find_record_id "$fqdn" "$type")"

  if [[ -n "$existing_id" ]]; then
    method="PUT"; endpoint="${API_BASE}/zones/${ZONE_ID}/dns_records/${existing_id}"; log "updating ${type} ${fqdn} -> ${ip}"
  else
    method="POST"; endpoint="${API_BASE}/zones/${ZONE_ID}/dns_records"; log "creating ${type} ${fqdn} -> ${ip}"
  fi

  [[ "$DRY_RUN" == true ]] && return 0

  response="$(curl -fsS -X "$method" "$endpoint" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$payload")"
  ok="$(cf_parse_field ok "$response")"
  if [[ "$ok" != "true" ]]; then
    err="$(cf_parse_field errors "$response")"
    log "Cloudflare API error for ${fqdn}: ${err:-unknown error}"
    exit 1
  fi
}

main() {
  local ip ip6 host fqdn
  ip="$(get_public_ip)"
  log "public IPv4 detected: ${ip}"

  cf_upsert_record "${ROOT_DOMAIN}" "A" "$ip"
  cf_upsert_record "*.${ROOT_DOMAIN}" "A" "$ip"

  IFS=',' read -r -a hosts <<< "$ADDITIONAL_HOSTS"
  for host in "${hosts[@]}"; do
    host="${host// /}"
    [[ -n "$host" ]] || continue
    fqdn="${host}.${ROOT_DOMAIN}"
    cf_upsert_record "$fqdn" "A" "$ip"
  done

  if ip6="$(get_public_ipv6)"; then
    log "public IPv6 detected: ${ip6}"
    cf_upsert_record "${ROOT_DOMAIN}" "AAAA" "$ip6"
    cf_upsert_record "*.${ROOT_DOMAIN}" "AAAA" "$ip6"
    for host in "${hosts[@]}"; do
      host="${host// /}"
      [[ -n "$host" ]] || continue
      fqdn="${host}.${ROOT_DOMAIN}"
      cf_upsert_record "$fqdn" "AAAA" "$ip6"
    done
  fi

  log "ddns update complete"
}

main "$@"
