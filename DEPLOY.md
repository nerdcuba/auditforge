# Deploy AuditForge (self-hosted, all-in-one)

A `git clone` plus **one command** brings up everything: the database (lightweight Supabase), the
panel and the worker. It works the same on your laptop and on a VPS. No external accounts needed.

## Requirements

- **Docker** with the **`docker compose` v2** plugin (`docker compose version`).
- **openssl** (to generate secrets).
- ~2 GB of free RAM and ~3 GB of disk.

## One-command deploy

```bash
git clone https://github.com/nerdcuba/auditforge.git && cd auditforge
./scripts/install.sh
```

That:
1. Generates **all secrets** into `deploy/.env` (passwords, Supabase JWT keys, encryption key, the
   worker's signing key pair). It is never committed.
2. Detects the **host** (the machine's IP) and builds the panel with that URL.
3. Builds and brings up the stack with Docker.

When it finishes it prints the panel URL and the mailbox URL.

### On a VPS (with your domain)

```bash
PUBLIC_HOST=audit.yourdomain.com PUBLIC_SCHEME=https ./scripts/install.sh
```

Put a reverse proxy (Caddy, Nginx, Traefik or Coolify's) in front that terminates TLS and forwards
`:3000` (panel) and `:8000` (Supabase API) to those ports. The panel and the API must live under the
`PUBLIC_HOST` you set.

> Important: open the panel via the **same host** you configured (the IP or domain), not
> `localhost`. The panel container and your browser must see the same URL for sessions to work.

## First login

There is no public sign-up (by design). Create your user:

```bash
./scripts/create-user.sh you@example.com
```

Then open the panel, request the **magic link**, and open it from the bundled **mailbox (Mailpit)**
the installer pointed you to (`http://YOUR_HOST:8025`). In production, configure a real SMTP (below).

## Configure (very little)

Almost everything is ready out of the box. What you can tweak in `deploy/.env`, then `recreate`:

| Variable | What it does |
|---|---|
| `AUDITFORGE_SCAN_DISPATCH` | `queue` (default) uses the worker; `inline` runs scans in the web. |
| `PACK_COMMIT` | A **reviewed** Claude-BugHunter commit to install `cbh` in the worker. |
| `ENGAGEMENT_CMD` | `/app/scripts/engagement.sh` to enable the pack (only with `PACK_COMMIT`). |
| `SMTP_*` (GoTrue) | To send real emails instead of Mailpit. |

Inside the panel, each user sets **their own Claude API key** in Settings (stored encrypted).

## Operate

From the `deploy/` folder:

```bash
docker compose logs -f            # tail logs
docker compose ps                 # status
docker compose down               # stop
docker compose up -d              # start
docker compose up -d --build web  # rebuild the panel after changes
```

## Update

```bash
git pull
./scripts/install.sh              # rebuilds and applies new migrations (does not rotate secrets)
```

Migrations are applied automatically and are idempotent (tracked in `_af_migrations`).

## Start from scratch

```bash
cd deploy && docker compose down -v   # also removes the data volume
rm deploy/.env                        # secrets will be regenerated on the next install
```

## What it brings up (lightweight stack)

`db` (Supabase Postgres) · `auth` (GoTrue) · `rest` (PostgREST) · `gateway` (nginx) ·
`mail` (Mailpit) · `web` (panel) · `worker` (isolated recon). No Studio, Storage, Realtime or
Analytics. The live scan view uses polling, so it doesn't need Realtime.

The worker runs auditing tools; for `active` (intrusive) mode, deploy the worker on a dedicated,
isolated host (see `worker/README.md`).
