# Gitea Custom Theme Assets

This folder is mounted into Gitea at `/data/gitea/custom`.

## Current Theme
- Theme name: `cavern`
- File: `public/assets/css/theme-cavern.css`

## How to Edit
1. Modify CSS in `public/assets/css/theme-cavern.css`.
2. Redeploy gitea:

```bash
docker compose up -d gitea
```

3. Hard-refresh browser (`Ctrl+Shift+R`).

## Notes
- Theme activation is set in `docker-compose.yml` via:
  - `GITEA__ui__THEMES=gitea,arc-green,gitea-auto,cavern`
  - `GITEA__ui__DEFAULT_THEME=cavern`
