#!/usr/bin/env bash
set -euo pipefail

STATUSD_DATA_DIR="${STATUSD_DATA_DIR:-/var/lib/statusd}"
SCAN_TARGETS="${SCAN_TARGETS:-404n0tf0und.net,git.404n0tf0und.net,cloud.404n0tf0und.net,127.0.0.1}"
mkdir -p "${STATUSD_DATA_DIR}"

findings_tmp="$(mktemp)"
tasks_tmp="$(mktemp)"
trap 'rm -f "${findings_tmp}" "${tasks_tmp}"' EXIT

now_utc() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

add_finding() {
  local tool="$1" severity="$2" target="$3" summary="$4" cve="${5:-}" cve_url="${6:-}"
  printf '{"tool":"%s","severity":"%s","target":"%s","cve":"%s","cve_url":"%s","summary":"%s","timestamp":"%s"}\n' \
    "$(esc "$tool")" "$(esc "$severity")" "$(esc "$target")" "$(esc "$cve")" "$(esc "$cve_url")" "$(esc "$summary")" "$(now_utc)" >>"${findings_tmp}"
}

add_task() {
  local id="$1" prio="$2" title="$3" impact="$4" effort="$5" action="$6"
  printf '{"id":"%s","priority":"%s","title":"%s","impact":"%s","effort":"%s","action":"%s","status":"open"}\n' \
    "$(esc "$id")" "$(esc "$prio")" "$(esc "$title")" "$(esc "$impact")" "$(esc "$effort")" "$(esc "$action")" >>"${tasks_tmp}"
}

risk_score=0

if ! ufw status | head -n1 | grep -qi active; then
  add_finding "ufw" "high" "host" "Firewall is not active"
  add_task "enable-ufw" "high" "Enable UFW" "Host exposure increases without firewall policy" "low" "Enable UFW and apply explicit allowlist rules"
  risk_score=$((risk_score + 35))
fi

if systemctl is-active --quiet fail2ban; then
  :
else
  add_finding "fail2ban" "medium" "host" "fail2ban service is not active"
  add_task "enable-fail2ban" "medium" "Enable fail2ban" "Brute-force defenses are reduced" "low" "Enable and verify fail2ban jails"
  risk_score=$((risk_score + 20))
fi

if command -v sslscan >/dev/null 2>&1; then
  for target in ${SCAN_TARGETS//,/ }; do
    if [[ "$target" == *.* && "$target" != "127.0.0.1" ]]; then
      out="$(timeout 90 sslscan "${target}:443" 2>/dev/null || true)"
      if echo "$out" | rg -qi "SSLv3|TLSv1\.0|TLSv1\.1"; then
        add_finding "sslscan" "high" "$target" "Legacy TLS protocol appears enabled"
        add_task "disable-legacy-tls-${target//[^a-zA-Z0-9]/-}" "high" "Disable legacy TLS on ${target}" "Weak protocol support increases TLS downgrade risk" "medium" "Restrict to TLS 1.2+ in reverse proxy"
        risk_score=$((risk_score + 25))
      fi
    fi
  done
fi

if command -v nmap >/dev/null 2>&1; then
  for target in ${SCAN_TARGETS//,/ }; do
    out="$(timeout 90 nmap -Pn -sV -F --open --script vuln --script-timeout 20s "$target" 2>/dev/null || true)"
    open_count="$(echo "$out" | rg '/tcp\s+open' -c || true)"
    if [[ "${open_count:-0}" -gt 3 ]]; then
      add_finding "nmap" "medium" "$target" "More than 3 TCP ports are exposed (${open_count})"
      add_task "review-open-ports-${target//[^a-zA-Z0-9]/-}" "medium" "Review exposed ports on ${target}" "Unnecessary listening services expand attack surface" "medium" "Close unused ports and restrict inbound rules"
      risk_score=$((risk_score + 15))
    fi

    cves="$(echo "$out" | grep -oE 'CVE-[0-9]{4}-[0-9]{4,7}' | sort -u | head -n 5 || true)"
    if [[ -n "${cves}" ]]; then
      while IFS= read -r cve; do
        [[ -n "$cve" ]] || continue
        cve_url="https://nvd.nist.gov/vuln/detail/${cve}"
        add_finding "nmap" "high" "$target" "Potential vulnerability identified by nmap vuln scripts" "$cve" "$cve_url"
      done <<< "$cves"
      add_task "patch-cves-${target//[^a-zA-Z0-9]/-}" "high" "Review CVE findings on ${target}" "Known CVEs may be exploitable" "high" "Validate service versions and patch or mitigate affected software"
      risk_score=$((risk_score + 20))
    fi
  done
fi

if command -v nikto >/dev/null 2>&1; then
  for target in 404n0tf0und.net git.404n0tf0und.net cloud.404n0tf0und.net; do
    nikto_out="$(timeout 120 nikto -h "https://${target}" -maxtime 90s 2>/dev/null || true)"
    if echo "$nikto_out" | rg -qi "OSVDB|+ Server"; then
      add_finding "nikto" "low" "$target" "Nikto produced reviewable findings; manual triage needed"
      add_task "triage-nikto-${target//[^a-zA-Z0-9]/-}" "low" "Triage Nikto results for ${target}" "Unreviewed findings may hide actionable issues" "medium" "Review Nikto output and convert true positives to tracked tasks"
      risk_score=$((risk_score + 5))
    fi
  done
fi

if command -v apt >/dev/null 2>&1; then
  sec_updates="$(apt list --upgradable 2>/dev/null | rg -i 'security|esm' -c || true)"
  if [[ "${sec_updates:-0}" -gt 0 ]]; then
    add_finding "apt" "medium" "host" "${sec_updates} security-related package updates are pending"
    add_task "apply-security-updates" "medium" "Apply pending security updates" "Known vulnerabilities may remain exploitable" "medium" "Patch host packages and reboot if needed"
    risk_score=$((risk_score + 15))
  fi
fi

if [[ "$risk_score" -gt 100 ]]; then
  risk_score=100
fi

if [[ "$risk_score" -ge 60 ]]; then
  status="degraded"
else
  status="ok"
fi

findings_json="[]"
if [[ -s "${findings_tmp}" ]]; then
  findings_json="[$(paste -sd, "${findings_tmp}")]"
fi

tasks_json="[]"
if [[ -s "${tasks_tmp}" ]]; then
  tasks_json="[$(paste -sd, "${tasks_tmp}")]"
fi

updated="$(now_utc)"

cat >"${STATUSD_DATA_DIR}/security-latest.json" <<JSON
{"status":"${status}","risk_score":${risk_score},"last_run":"${updated}","updated_at":"${updated}","targets":["$(echo "${SCAN_TARGETS}" | sed 's/,/","/g')"],"findings":${findings_json}}
JSON

cat >"${STATUSD_DATA_DIR}/security-tasks.json" <<JSON
{"status":"${status}","generated":"${updated}","tasks":${tasks_json}}
JSON

echo "security scan snapshot updated at ${updated}"
