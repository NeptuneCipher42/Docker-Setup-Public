# Underwater Homepage + Admin Status Design

Date: 2026-02-21

## Goal
Refresh the public homepage for 404n0tf0und.net to feel like a dynamic underwater cave while keeping the existing color theme, and add a WireGuard-only admin status page on a dedicated subdomain. The public page should include a short About section derived from provided LinkedIn text and a fun summary from the resume. The admin view must provide a comprehensive server health overview without exposing sensitive details to the public.

## Non-Goals
- Building a full monitoring stack (Prometheus/Grafana).
- Exposing detailed system internals on the public homepage.
- Implementing SSO or app-level authentication (access control is by WireGuard subnet only).

## Constraints
- Admin access restricted to WireGuard subnet `10.8.0.0/24`.
- Static site served by Caddy.
- Status service implemented in Go, running as a systemd service on the host.
- Must respect `prefers-reduced-motion`.

## Proposed Architecture
- **Public site**: Static HTML/CSS/JS on the main domain with an underwater cave theme and ambient motion.
- **Status service**: Go HTTP service exposing two endpoints:
  - `/public`: high-level, non-sensitive metrics for the public homepage.
  - `/admin`: detailed metrics for the admin subdomain.
- **Caddy**:
  - Main site continues to serve `404n0tf0und.net`.
  - New `admin.404n0tf0und.net` site reverse-proxies to the status service `/admin` endpoint.
  - IP allowlist for `10.8.0.0/24` on the admin subdomain.
- **DNS/DDNS**:
  - If the current DDNS script updates the wildcard record (`*.404n0tf0und.net`), no changes required.
  - Otherwise, add/update `admin.404n0tf0und.net` in Cloudflare.

## UX Design
### Visual Direction
- Underwater cave ambience with layered gradients, soft caustic beams, drifting particles, and subtle parallax.
- Preserve the existing palette (deep blues/teals with glow accents).
- Use expressive typography already in use; avoid default system stacks.

### Page Structure
- Hero: existing title and lede.
- About section:
  - Short LinkedIn-based paragraph (provided by user).
  - A short, fun blurb derived from resume highlights.
- Status capsule (public):
  - Overall status badge (OK/Degraded).
  - Uptime.
  - Active Docker containers count.

### Motion
- Ambient animation (particles, light rays, subtle shimmer).
- JS parallax on mouse/touch for depth.
- Respect `prefers-reduced-motion` to disable animations.

## Status Service Design
### Data Collection
- **System**: uptime/load from `/proc`, memory/CPU from `/proc` and `free`/`top`-like readings.
- **Disk**: `df -h` for usage, mount points.
- **Docker**: container count and health using `docker ps`.
- **Services**: `systemctl` status for key services (Caddy, Docker, WireGuard).
- **Logs**: recent journal warnings/errors (summary counts) for admin.
- **Firewall**: `ufw status` summary.

### Response Shapes
- `/public` (safe): status summary, uptime, docker count, last refresh timestamp.
- `/admin` (full): above plus disk, memory, service status, log summary, and firewall status.

### Performance/Safety
- Cache metrics for short intervals (5-10s) to minimize shelling out.
- No sensitive data (secrets, full log content) in public responses.

## Error Handling
- If a subsystem fails to report, include a `degraded` status with error notes.
- Public endpoint never exposes raw error messages that reveal internal paths or commands.

## Testing & Validation
- Manual validation of:
  - Public homepage rendering and motion on desktop/mobile.
  - `prefers-reduced-motion` behavior.
  - Admin subdomain access from WireGuard IP and blocked from non-WG IPs.
  - Status endpoints return valid JSON.

## Rollout
1. Update Caddy config with new admin subdomain and IP allowlist.
2. Add status service + systemd unit.
3. Update homepage HTML/CSS/JS with new design and status widget.
4. Verify functionality and access control.

## Open Questions
- Confirm the DDNS script updates wildcard records; if not, add `admin` record.
- Confirm which services should be included in the admin status list (default: Caddy, Docker, WireGuard).
