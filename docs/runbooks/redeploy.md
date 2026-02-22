# Redeploy Runbook

## Prerequisites
- Ubuntu/Debian host with Docker + Docker Compose.
- Go toolchain installed (for building `statusd`).
- `sudo` access.
- Cloudflare API token + zone ID (if DDNS enabled).

## One-Time Setup
1. Copy env template and edit secrets/domains:
   - `cp .env.example .env`
2. Install DDNS script from this repo:
   - `make install-ddns`
3. Export Cloudflare credentials before DDNS runs:
   - `export CF_API_TOKEN=...`
   - `export ZONE_ID=...`

## Redeploy Core Stack
Run:

```bash
make redeploy
```

This command:
- starts/updates Docker services (`caddy`, `gitea`, `nextcloud`, `mariadb`),
- starts/updates tools (`uptime-kuma`, `netdata`),
- builds/installs host `statusd`,
- installs/enables 12-hour security scan timer,
- triggers one immediate security scan snapshot.

## Full Redeploy (Recommended)
Run everything in one pass (redeploy + DDNS + smoke):

```bash
export ADMIN_PASS='<your-admin-password>'
export CF_API_TOKEN='...'
export ZONE_ID='...'
make redeploy-all
```

## Included Tools
`make redeploy` also brings up:
- `uptime-kuma` at `kuma.404n0tf0und.net`
- `netdata` at `netdata.404n0tf0und.net`

Both are behind private Basic Auth in Caddy.

## Verification
Core monitoring checks:

```bash
make verify
```

Web/auth/routing checks (includes tools):

```bash
ADMIN_USER='ops-admin' ADMIN_PASS='<your-password>' make verify-web
```

Full smoke check:

```bash
ADMIN_USER='ops-admin' ADMIN_PASS='<your-password>' make smoke
```

## Backup / Restore
Create backup archives for Docker volumes:

```bash
make backup
```

Restore from a backup snapshot:

```bash
./deploy/scripts/restore-volumes.sh deploy/backups/<timestamp>
docker compose up -d
```

## DNS/DDNS Updates
Dry run:

```bash
~/.dotfishingbot/cloudflare/ddns.sh --dry-run
```

Live run:

```bash
~/.dotfishingbot/cloudflare/ddns.sh
```

Default DDNS host list includes:
- `git`
- `cloud`
- `admin`
- `security-admin`
- `kuma`
- `netdata`

## Router / Firewall
Standard setup:
- Forward `TCP 443 -> <server-lan-ip>:443`

Custom external TLS port:
- You can map `<external-port> -> <server-lan-ip>:443`.
- Access URLs must include `:<external-port>`.
- If host `443` is unavailable, set `CADDY_HTTPS_PORT=<external-port>` in `.env` and redeploy.

## Expected Security Behavior
- Anonymous requests to private dashboards return `401`.
- Public host blocks `/api/admin/*` with `403`.
- Private hosts send `X-Robots-Tag: noindex, nofollow`.

## Deterministic Deploys
- Compose images are pinned by digest in `docker-compose.yml`.
- CI validates script syntax, JS syntax, gofmt, Go tests, and compose config on push/PR.
