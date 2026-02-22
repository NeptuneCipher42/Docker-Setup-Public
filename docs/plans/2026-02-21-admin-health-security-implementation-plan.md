# Public/Admin Health + Security Dashboards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver dynamic public health widgets, WireGuard-only admin health dashboard, and WireGuard-only security dashboard with 12-hour scheduled vulnerability scans and remediation task generation.

**Architecture:** A host-level Go service provides `/public`, `/admin/health`, `/admin/security`, and `/admin/security/tasks` JSON. Caddy routes and subnet allowlists isolate private dashboards. A scheduled scan pipeline runs `nmap`, `nikto`, and `sslscan`, normalizes findings, computes severity/risk, and emits an actionable task list.

**Tech Stack:** Go (stdlib), systemd service/timer, Caddy, static HTML/CSS/JS widgets, shell scanner wrappers (`nmap`, `nikto`, `sslscan`), existing Cloudflare DDNS script.

---

### Task 1: Add status service scaffold and config

**Files:**
- Create: `status-service/go.mod`
- Create: `status-service/cmd/statusd/main.go`
- Create: `status-service/internal/config/config.go`
- Create: `status-service/internal/http/router.go`
- Create: `status-service/internal/model/types.go`
- Test: `status-service/internal/config/config_test.go`

**Step 1: Write the failing test**
- Add test validating config defaults and required fields (listen addr, cache TTL, WG CIDR list).

**Step 2: Run test to verify it fails**
- Run: `cd status-service && go test ./...`
- Expected: FAIL due to missing config implementation.

**Step 3: Write minimal implementation**
- Implement config loader with env + defaults.
- Create HTTP router with placeholder handlers returning `501` JSON.

**Step 4: Run tests to verify pass**
- Run: `cd status-service && go test ./...`
- Expected: PASS.

**Step 5: Commit**
- `git add status-service`
- `git commit -m "feat: scaffold status service with config and router"`

### Task 2: Implement `/public` collector + tests

**Files:**
- Create: `status-service/internal/collect/public.go`
- Create: `status-service/internal/collect/public_test.go`
- Modify: `status-service/internal/http/router.go`

**Step 1: Write failing tests**
- Test sanitized payload shape: status, uptime, active containers, updated_at.
- Test failure path returns degraded without internal error details.

**Step 2: Verify fails**
- Run: `cd status-service && go test ./internal/collect ./internal/http`

**Step 3: Minimal implementation**
- Gather uptime/load/container count using controlled commands/proc reads.
- Add short in-memory cache.

**Step 4: Verify pass**
- Same go test command.

**Step 5: Commit**
- `git add status-service/internal/collect status-service/internal/http/router.go`
- `git commit -m "feat: add public health endpoint"`

### Task 3: Implement `/admin/health` collector + tests

**Files:**
- Create: `status-service/internal/collect/admin_health.go`
- Create: `status-service/internal/collect/admin_health_test.go`
- Modify: `status-service/internal/http/router.go`

**Step 1: Write failing tests**
- Validate inclusion of CPU/memory/disk/service/docker/alerts structure.
- Validate partial failure marks degraded component.

**Step 2: Verify fails**
- `cd status-service && go test ./internal/collect ./internal/http`

**Step 3: Minimal implementation**
- Add collectors for system metrics, `systemctl` status, docker summary, ufw/fail2ban status.

**Step 4: Verify pass**
- Same go test command.

**Step 5: Commit**
- `git add status-service/internal/collect status-service/internal/http/router.go`
- `git commit -m "feat: add admin health endpoint"`

### Task 4: Implement security scanner pipeline + parser + task generator

**Files:**
- Create: `status-service/internal/security/runner.go`
- Create: `status-service/internal/security/parser.go`
- Create: `status-service/internal/security/scoring.go`
- Create: `status-service/internal/security/tasks.go`
- Create: `status-service/internal/security/security_test.go`
- Create: `status-service/scripts/run-security-scan.sh`

**Step 1: Write failing tests**
- Given sample scanner outputs, parser normalizes findings and severities.
- Task generator creates prioritized actions (severity, impact, effort, step).

**Step 2: Verify fails**
- `cd status-service && go test ./internal/security`

**Step 3: Minimal implementation**
- Execute `nmap/nikto/sslscan` against allowlist targets with timeouts.
- Parse outputs into normalized model and produce risk score + tasks.
- Persist latest snapshot and history JSON.

**Step 4: Verify pass**
- `cd status-service && go test ./internal/security`

**Step 5: Commit**
- `git add status-service/internal/security status-service/scripts`
- `git commit -m "feat: add scheduled security scan pipeline"`

### Task 5: Expose `/admin/security` and `/admin/security/tasks`

**Files:**
- Modify: `status-service/internal/http/router.go`
- Modify: `status-service/internal/model/types.go`
- Create: `status-service/internal/http/security_test.go`

**Step 1: Write failing tests**
- Endpoints return latest snapshot and task list schema.

**Step 2: Verify fails**
- `cd status-service && go test ./internal/http`

**Step 3: Minimal implementation**
- Add handlers reading persisted security state and returning JSON.

**Step 4: Verify pass**
- `cd status-service && go test ./internal/http`

**Step 5: Commit**
- `git add status-service/internal/http status-service/internal/model`
- `git commit -m "feat: add admin security endpoints"`

### Task 6: Build dynamic widget UIs (public/admin/security)

**Files:**
- Modify: `site/index.html`
- Modify: `site/styles.css`
- Create: `site/assets/js/public-widgets.js`
- Create: `site/admin/index.html`
- Create: `site/admin/styles.css`
- Create: `site/admin/app.js`
- Create: `site/security-admin/index.html`
- Create: `site/security-admin/styles.css`
- Create: `site/security-admin/app.js`

**Step 1: Write failing UI checks**
- Add lightweight smoke script or static assertions for required widget containers and script tags.

**Step 2: Verify fails**
- Run smoke script.

**Step 3: Minimal implementation**
- Public page fetches `/public` and renders safe widgets.
- Admin pages fetch private endpoints and render operational/security widgets with refresh state.

**Step 4: Verify pass**
- Re-run smoke checks and manual browser validation.

**Step 5: Commit**
- `git add site`
- `git commit -m "feat: add dynamic widgets for public/admin/security pages"`

### Task 7: Caddy routing + WireGuard restrictions

**Files:**
- Modify: `Caddyfile`
- Create: `docs/runbooks/access-control-verification.md`

**Step 1: Write failing validation checks**
- Add script/checklist expecting admin hostnames return denial outside WG and success inside WG.

**Step 2: Verify fails**
- Run with current config.

**Step 3: Minimal implementation**
- Add host blocks for:
  - `admin.404n0tf0und.net`
  - `security-admin.404n0tf0und.net`
- Reverse proxy to status service endpoints.
- Apply `remote_ip` allow rule for `10.8.0.0/24`, explicit deny otherwise.

**Step 4: Verify pass**
- `docker compose up -d caddy`
- Validate allowed/denied behavior from WG and non-WG.

**Step 5: Commit**
- `git add Caddyfile docs/runbooks/access-control-verification.md`
- `git commit -m "feat: add wg-restricted admin and security subdomains"`

### Task 8: Systemd service + 12-hour timer

**Files:**
- Create: `deploy/systemd/statusd.service`
- Create: `deploy/systemd/security-scan.service`
- Create: `deploy/systemd/security-scan.timer`
- Create: `docs/runbooks/status-service-operations.md`

**Step 1: Write failing validation**
- Add runbook commands expecting missing units initially.

**Step 2: Verify fails**
- `systemctl status statusd` (expected unit not found before install).

**Step 3: Minimal implementation**
- Unit files for status daemon and scheduled scanner every 12h.
- Include restart policy, environment file, data dir permissions.

**Step 4: Verify pass**
- Install units, `daemon-reload`, enable/start timer.
- `systemctl list-timers | rg security-scan`

**Step 5: Commit**
- `git add deploy/systemd docs/runbooks/status-service-operations.md`
- `git commit -m "feat: add status and security scan systemd units"`

### Task 9: DDNS updates for admin/security subdomains

**Files:**
- Modify: `/home/nicholas/.dotfishingbot/cloudflare/ddns.sh`
- Create: `docs/runbooks/cloudflare-ddns.md`

**Step 1: Write failing validation**
- Dry-run/log check that expected host list includes `admin` and `security-admin`.

**Step 2: Verify fails**
- `ADDITIONAL_HOSTS='git,cloud' /home/nicholas/.dotfishingbot/cloudflare/ddns.sh --dry-run`

**Step 3: Minimal implementation**
- Extend default host labels to include `admin,security-admin`.
- Preserve `CF_PROXIED` toggle behavior.

**Step 4: Verify pass**
- Dry-run and live run; verify records via `dig`.

**Step 5: Commit**
- `git add /home/nicholas/.dotfishingbot/cloudflare/ddns.sh docs/runbooks/cloudflare-ddns.md`
- `git commit -m "chore: include admin subdomains in cloudflare ddns"`

### Task 10: End-to-end verification and release notes

**Files:**
- Create: `docs/release-notes/2026-02-21-admin-health-security.md`

**Step 1: Run full verification**
- `cd status-service && go test ./...`
- `docker compose config`
- Endpoint probes for public/admin/security JSON.
- WG access-control checks.
- Timer next-run and last-run checks.

**Step 2: Fix any regressions (TDD for each regression)**
- Add failing tests first, then patch.

**Step 3: Record evidence**
- Add command outputs/screenshots summary into release notes.

**Step 4: Commit**
- `git add docs/release-notes/2026-02-21-admin-health-security.md`
- `git commit -m "docs: add verification evidence for admin health/security rollout"`
