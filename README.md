# Gitea + Nextcloud + Monitoring Stack

## Install First (Public Template Repo)
Prerequisites:
- Host has Docker, Docker Compose, Go, and `sudo` access.
- Fill `.env` from `.env.example` with your real values (passwords/tokens/domains).
  - generate `ADMIN_PASSWORD_HASH` with:
    - `docker exec caddy caddy hash-password --plaintext '<your-admin-password>'`
- Router/NAT port-forward is configured:
  - standard: `443 -> <server-lan-ip>:443`
  - custom: set `CADDY_HTTPS_PORT=<port>` in `.env` and forward `<port> -> <server-lan-ip>:<port>`
- DNS records point to this host (DDNS may take a few minutes to propagate).

Run this on a fresh host:

```bash
git clone https://github.com/NeptuneCipher42/Docker-Setup-Public.git
cd Docker-Setup-Public
cp .env.example .env
# edit .env with your values
./deploy/scripts/bootstrap-from-repo.sh
```

What this does:
- pulls latest repo state,
- redeploys core stack (`caddy`, `gitea`, `nextcloud`, `mariadb`) + host `statusd`,
- enables tools (`uptime-kuma`, `netdata`),
- installs DDNS helper script,
- runs DDNS update automatically if token + `ZONE_ID` exist in `.env`,
- runs monitoring verification (and web verification if `ADMIN_PASS` exists in `.env`).

If your router cannot use external 443, set this in `.env` before running bootstrap:

```bash
CADDY_HTTPS_PORT=4443
```

Then forward router `TCP 4443 -> <server-lan-ip>:4443`.

This repository is the deployment source of truth for:
- Docker services: `caddy`, `gitea`, `nextcloud`, `mariadb`
- Public homepage with safe health/security widgets
- Private operations dashboard: `admin.404n0tf0und.net`
- Private security dashboard: `security-admin.404n0tf0und.net`
- Host `statusd` API service + 12-hour security scan timer
- Cloudflare DDNS updates
- Optional external tools: `Uptime Kuma` and `Netdata`

All dashboard pages are theme-matched, dynamic, and chart-driven.

## Repository Layout
- `docker-compose.yml`: app stack + built-in tools
- `Caddyfile`: routing, TLS, auth, security headers
- `site/`: public + admin + security-admin static pages
- `status-service/`: Go API service (`/public`, `/admin/*`)
- `deploy/systemd/`: host systemd units for `statusd` + scanner
- `deploy/scripts/`: redeploy/install/verify scripts
- `scripts/cloudflare-ddns.sh`: Cloudflare DDNS automation
- `docs/runbooks/redeploy.md`: full operator runbook
- `gitea-custom/`: repo-managed Gitea UI custom theme assets
- `.github/workflows/ci.yml`: CI checks for syntax/tests/compose validation

## Fresh Setup (Generic)
If using a sanitized/public copy without `.env`, use:

```bash
cp .env.example .env
# edit .env
make redeploy
```

4. Full redeploy + DDNS + smoke checks:

```bash
export ADMIN_PASS='<your-admin-password>'
export CF_API_TOKEN='...'
export ZONE_ID='...'
make redeploy-all
```

## External Tools (always deployed)
Tools deployed by `make redeploy`:
- `kuma.404n0tf0und.net` -> Uptime Kuma
- `netdata.404n0tf0und.net` -> Netdata

Both are protected by the same private dashboard Basic Auth.

## Gitea Theme Customization (redeployable)
- Gitea theme files are kept in `gitea-custom/public/assets/css/`.
- Current custom theme: `cavern` (`theme-cavern.css`).
- Compose mounts `./gitea-custom` to `/data/gitea/custom` and sets default theme to `cavern`.
- After changing theme files, run:

```bash
docker compose up -d gitea
```

## Verification
Base monitoring verification:

```bash
make verify
```

Web/auth/routing verification (includes tools):

```bash
ADMIN_USER='ops-admin' ADMIN_PASS='<your-password>' make verify-web
```

Full smoke check:

```bash
ADMIN_USER='ops-admin' ADMIN_PASS='<your-password>' make smoke
```

## Backups / Restore
Create a timestamped volume backup:

```bash
make backup
```

Restore from a backup directory:

```bash
./deploy/scripts/restore-volumes.sh deploy/backups/<timestamp>
docker compose up -d
```

Backup files are written to `deploy/backups/` (gitignored).

## Security Model
- Public host (`404n0tf0und.net`) exposes only `/api/public`.
- Public requests to `/api/admin/*` are blocked (`403`).
- Private dashboards and tools require Basic Auth.
- Private pages emit `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.

## DDNS
Install the repo-managed DDNS script:

```bash
make install-ddns
```

Then run with credentials:

```bash
export CF_API_TOKEN='...'
export ZONE_ID='...'
~/.dotfishingbot/cloudflare/ddns.sh
```

Default DDNS host list includes:
- `git`, `cloud`, `admin`, `security-admin`, `kuma`, `netdata`

## Router / Firewall
For standard HTTPS URLs, forward:
- `TCP 443 -> <server-lan-ip>:443`

If you choose a custom external port, map that port to internal `443` and include `:<port>` in URLs.
You can also set host binding directly via `.env`:

```bash
CADDY_HTTPS_PORT=4443
```

Then forward router `TCP 4443 -> <server-lan-ip>:4443`.

## Deterministic Images
`docker-compose.yml` is pinned to specific image digests so redeploys are reproducible.

## Full Runbook
- `docs/runbooks/redeploy.md`
# Docker-Setup-Public
