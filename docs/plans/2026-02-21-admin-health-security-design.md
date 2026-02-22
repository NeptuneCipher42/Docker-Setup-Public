# Public Health + Admin Health + Security Admin Design

Date: 2026-02-21

## Goal
Build a dynamic status experience across three surfaces:
- Public homepage with non-sensitive health widgets.
- WireGuard-only admin health dashboard with full system/app/container visibility.
- WireGuard-only security dashboard with scheduled vulnerability analysis and actionable remediation tasks.

## Scope
- Public safe endpoint: `/public`.
- Admin operational endpoint: `/admin/health`.
- Admin security endpoints: `/admin/security`, `/admin/security/tasks`.
- Dedicated private subdomains:
  - `admin.404n0tf0und.net`
  - `security-admin.404n0tf0und.net`
- Access control enforced by Caddy allowlist on `10.8.0.0/24`.

## Non-Goals
- LAN-wide scanning.
- Full SIEM replacement.
- Public exposure of detailed server internals.

## Architecture
- Host-level Go status service (systemd) provides JSON endpoints and serves admin UI data.
- Public site remains static HTML/CSS/JS and fetches only `/public`.
- Caddy routes:
  - Main domain static site + `/public` proxy.
  - Admin subdomain -> `/admin/health` and admin UI.
  - Security-admin subdomain -> `/admin/security*` and security UI.
- Scanner pipeline:
  - Scheduled every 12 hours via systemd timer.
  - Active scanners: `nmap`, `nikto`, `sslscan`.
  - Passive checks: firewall, fail2ban, SSH hardening, patch posture, container hygiene.
  - Fixed target allowlist: `404n0tf0und.net`, `git.404n0tf0und.net`, `cloud.404n0tf0und.net`, and server host/IP.
- DDNS/Cloudflare:
  - Ensure `admin.404n0tf0und.net` and `security-admin.404n0tf0und.net` are included in automated DDNS updates.
  - Keep A/AAAA records aligned with detected public IPs.

## Public Widgets
- Overall status badge.
- Uptime.
- Active container count.
- Last refresh timestamp.

Rules:
- No raw logs, no private network details, no secrets.

## Admin Health Widgets
- CPU, memory, disk, and load.
- Docker container states/health.
- Key service status (caddy, docker, wg-quick, fail2ban, ufw).
- Alert counters and backup freshness.
- Recent error summary.

## Security Widgets
- Risk score and trend.
- Findings by severity.
- TLS/certificate posture.
- Exposed services/ports summary.
- Security controls checklist state.
- Prioritized remediation task list (severity, impact, effort, next step, status).

## Scheduler + Data Model
- Timer cadence: every 12 hours.
- Store normalized scan snapshots and derived task list in local data directory.
- Keep latest snapshot + short history for trend widgets.
- If scan fails, retain last successful data and mark status as degraded.

## Error Handling
- Endpoint-level degraded states when collectors fail.
- Strict timeouts for scanner commands.
- Partial results returned with explicit component status.

## Security Controls
- WG subnet-only access for both private subdomains.
- No active scan beyond explicit allowlist.
- All command invocation constrained to controlled argument templates.
- Public endpoint aggressively filtered/sanitized.

## Verification
- Validate JSON schemas for all endpoints.
- Verify WG-only access and public denial for admin/security subdomains.
- Validate timer execution and scan artifact generation.
- Validate public/homepage widget rendering on desktop/mobile.

## Rollout Plan
1. Build Go status/security service with endpoint split.
2. Add scanner job + parser + scoring/task generation.
3. Add/refresh widget-driven UIs for public/admin/security pages.
4. Add Caddy routes and WG allowlist for both private subdomains.
5. Add systemd service + timer units and runbooks.
6. End-to-end validation.
