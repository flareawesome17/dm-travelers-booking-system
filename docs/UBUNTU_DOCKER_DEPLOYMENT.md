# Ubuntu Docker Deployment

This guide is for running the D&M Travelers Booking System on a production-style
Ubuntu server with Docker Engine and Docker Compose v2. It does not require
Docker Desktop and does not change application business logic, UI, database
schema, Supabase RLS, or payment logic.

## Current Docker Setup

- `next.config.mjs` sets `output: "standalone"`, so `next build` creates a
  self-contained server under `.next/standalone`.
- `Dockerfile` uses a multi-stage Node 20 Alpine build. The final image copies
  `public`, `.next/standalone`, and `.next/static`, runs as the non-root
  `nextjs` user, exposes port `3000`, and starts with `node server.js`.
- `compose.yaml` builds the `app` service from the local `Dockerfile`, names the
  container `dm-admin`, loads runtime values from `.env.production`, and binds
  the app only to `127.0.0.1:3000`.
- `compose.yaml` includes a `cloudflared` service in the optional `tunnel`
  profile. When `CLOUDFLARE_TUNNEL_TOKEN` is present, Compose can run both the
  app and Cloudflare Tunnel connector with `--profile tunnel`.
- `.env.example` lists the required Supabase, auth, email, PayMongo, protected
  operation, domain, and optional Cloudflare Tunnel variables.

The app is currently Docker-ready for a Next.js standalone deployment.

## Required Server Software

Install and verify:

```bash
docker --version
docker compose version
docker info
```

The deploy user must be able to run Docker commands. If Docker was installed
with the official packages, that usually means adding the deploy user to the
`docker` group and starting a new login session.

## Production Environment

Create `.env.production` on the server from the example:

```bash
cp .env.example .env.production
nano .env.production
```

Set the real production values. Confirm these domain values unless the
production hostnames intentionally changed:

```env
ADMIN_SUBDOMAIN=admin-dm.erniecodev.win
NEXT_PUBLIC_APP_DOMAIN=public-dm.erniecodev.win
```

If using the Compose-managed Cloudflare Tunnel, also set:

```env
CLOUDFLARE_TUNNEL_TOKEN=your-cloudflare-token
```

Do not commit `.env.production`. It is already ignored by Git. The helper
scripts never create, overwrite, or print this file.

## Compose Commands

Validate the Compose file without printing interpolated secrets:

```bash
docker compose --env-file .env.production --profile tunnel config --quiet
```

Build the app image:

```bash
docker compose --env-file .env.production --profile tunnel build app
```

Start the app and optional tunnel profile:

```bash
docker compose --env-file .env.production --profile tunnel up -d
```

Show status:

```bash
docker compose --env-file .env.production --profile tunnel ps
```

Check the local app:

```bash
curl -I http://127.0.0.1:3000
```

View recent logs:

```bash
docker compose --env-file .env.production --profile tunnel logs --tail 120 app
docker compose --env-file .env.production --profile tunnel logs --tail 120 cloudflared
```

Stop the stack without deleting volumes:

```bash
docker compose --env-file .env.production --profile tunnel down
```

Do not run `docker compose down -v` for this deployment unless you explicitly
intend to remove volumes. Do not prune images during routine deployment unless
the server owner explicitly asks for it.

## Linux Helper Scripts

The Ubuntu scripts live under `scripts/linux`:

```bash
scripts/linux/install-linux.sh
scripts/linux/update-linux.sh
scripts/linux/start-linux.sh
scripts/linux/stop-linux.sh
scripts/linux/logs-linux.sh
scripts/linux/healthcheck-linux.sh
```

They all use `set -euo pipefail`, check Docker availability, check Docker
Compose availability, require `.env.production`, and avoid deleting volumes or
pruning images.

Initial build:

```bash
scripts/linux/install-linux.sh
```

Start:

```bash
scripts/linux/start-linux.sh
```

Update from the current Git branch, rebuild, restart, and health check:

```bash
scripts/linux/update-linux.sh
```

Status and health check:

```bash
scripts/linux/healthcheck-linux.sh
```

Logs:

```bash
scripts/linux/logs-linux.sh app
scripts/linux/logs-linux.sh cloudflared
TAIL_LINES=300 scripts/linux/logs-linux.sh app
FOLLOW=true scripts/linux/logs-linux.sh app
```

Stop:

```bash
scripts/linux/stop-linux.sh
```

## Cloudflare Tunnel

If using the existing Compose tunnel profile:

1. Create or open the Cloudflare Tunnel in Cloudflare Zero Trust.
2. Add a Docker connector and copy only the token value.
3. Store the token in `.env.production` as `CLOUDFLARE_TUNNEL_TOKEN`.
4. Publish routes to `http://dm-admin:3000` for both hostnames:
   - `admin-dm.erniecodev.win`
   - `public-dm.erniecodev.win`
5. Leave the HTTP Host Header override empty so Next.js receives the real
   hostname.

The `cloudflared` service depends on the app health check, so the tunnel starts
after `dm-admin` is healthy.

## Verification Checklist

- `docker compose --env-file .env.production --profile tunnel config --quiet`
  succeeds.
- `docker compose --env-file .env.production --profile tunnel build app`
  succeeds.
- `docker compose --env-file .env.production --profile tunnel ps` shows
  `dm-admin` running and healthy.
- The app port is bound as `127.0.0.1:3000->3000/tcp`.
- `curl -I http://127.0.0.1:3000` returns a non-5xx status.
- If the tunnel profile is used, `dm-cloudflared` is running and the Cloudflare
  dashboard reports the tunnel connector as healthy.
- Admin and public hostnames route to the expected app surfaces.

## Rollback

If an update fails before startup, the previous running containers are usually
still present. Review logs first:

```bash
scripts/linux/logs-linux.sh app
```

To return to a known Git commit:

```bash
git switch main
git pull --ff-only origin main
git checkout COMMIT_HASH
docker compose --env-file .env.production --profile tunnel build app
docker compose --env-file .env.production --profile tunnel up -d
scripts/linux/healthcheck-linux.sh
```

Only perform rollback after confirming the intended commit. Supabase is remote
and unchanged by these Docker commands.
