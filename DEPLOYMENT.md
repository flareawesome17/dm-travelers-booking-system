# Docker and Cloudflare Tunnel Deployment

This is a hosting-only deployment. One Next.js container serves two strictly
separated hostnames while the existing remote Supabase project remains
unchanged.

For the Windows one-click installer, updater, launchers, health checks, and
rollback workflow, see
[`docs/WINDOWS_ONE_CLICK_DEPLOYMENT.md`](docs/WINDOWS_ONE_CLICK_DEPLOYMENT.md).

## Hostnames and Access Rules

```text
https://admin-dm.erniecodev.win
  -> Cloudflare Tunnel
  -> http://dm-admin:3000
  -> /admin and internal admin APIs only

https://public-dm.erniecodev.win
  -> Cloudflare Tunnel
  -> http://dm-admin:3000
  -> public pages and /api/public/* only
```

The admin hostname returns 404 for public pages. The public hostname returns 404
for `/admin`, `/api/admin/*`, and every API outside `/api/public/*`. Admin
screens retain access to `/api/public/settings` and `/api/public/discounts`
because those existing reads are part of current behavior.

Unknown hostnames and direct LAN-IP requests return 404. Docker publishes port
3000 only on `127.0.0.1`, while the tunnel connector reaches the app over the
private Docker network.

## Environment Setup

Create the ignored production environment file:

```powershell
Copy-Item .env.example .env.production
```

Set the current production secrets and confirm these domain values:

```env
ADMIN_SUBDOMAIN=admin-dm.erniecodev.win
NEXT_PUBLIC_APP_DOMAIN=public-dm.erniecodev.win
CLOUDFLARE_TUNNEL_TOKEN=
```

Do not commit `.env.production`. The Supabase service-role key remains
server-side and must never use a `NEXT_PUBLIC_` variable name.

The domain values and `NEXT_PUBLIC_*` variables are passed into `next build`.
Always use `--env-file .env.production` when building the image.

## Local Docker Startup

```powershell
docker compose --env-file .env.production config
docker compose --env-file .env.production build app
docker compose --env-file .env.production up -d app
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail 100 app
```

Local testing remains available at `http://localhost:3000`. Localhost and
Tailscale hostnames intentionally bypass the production hostname split.

## Create the Cloudflare Tunnel

1. Sign in to Cloudflare and confirm the `erniecodev.win` zone is active.
2. Open **Zero Trust**.
3. Go to **Networks -> Connectors -> Cloudflare Tunnels**.
4. Select **Create a tunnel**.
5. Choose **Cloudflared**, then select **Next**.
6. Name the tunnel `dm-hotel` and select **Save tunnel**.
7. Under **Choose an environment**, select **Docker**.
8. Copy the token from the generated Docker command. Store only the token value:

   ```env
   CLOUDFLARE_TUNNEL_TOKEN=your-generated-token
   ```

9. Do not commit or paste the token into documentation.

## Publish Both Hostnames

In the `dm-hotel` tunnel, open **Published application routes**.

Add the admin route:

| Setting | Value |
| --- | --- |
| Subdomain | `admin-dm` |
| Domain | `erniecodev.win` |
| Path | Leave empty |
| Service type | `HTTP` |
| Service URL | `dm-admin:3000` |

Add the public route:

| Setting | Value |
| --- | --- |
| Subdomain | `public-dm` |
| Domain | `erniecodev.win` |
| Path | Leave empty |
| Service type | `HTTP` |
| Service URL | `dm-admin:3000` |

For both routes:

- Leave **HTTP Host Header** empty. The incoming hostname must reach Next.js
  unchanged so middleware can enforce the correct surface.
- Do not enable `No TLS Verify`; the connector uses plain HTTP to the private
  Docker origin.
- Save each route and confirm Cloudflare creates proxied DNS records.

Start the application and tunnel:

```powershell
docker compose --env-file .env.production --profile tunnel up -d --build
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail 100 cloudflared
```

The Cloudflare dashboard should report the `dm-hotel` tunnel as **Healthy**.
Tunnel health only confirms the connector is online, so test both websites too.

## Legacy Admin Redirect

Keep `admindm.erniecodev.win` only as a seven-day edge redirect. The application
does not accept it as an admin hostname.

1. In the `erniecodev.win` zone, open **Rules -> Redirect Rules**.
2. Select **Create rule -> Redirect Rule**.
3. Name it `Legacy DM admin hostname`.
4. Choose **Wildcard pattern** and enter:

   ```text
   http*://admindm.erniecodev.win/*
   ```

5. Enter this target URL:

   ```text
   https://admin-dm.erniecodev.win/${1}
   ```

6. Select status code `301`.
7. Enable **Preserve query string**.
8. Deploy the rule and ensure the legacy DNS record remains proxied.
9. Seven days after cutover, remove the redirect rule and legacy DNS record.

## Supabase Dashboard

No database, RLS, table, storage, or authentication implementation changes are
part of this deployment.

The current app uses its existing custom admin authentication. If Supabase URL
Configuration is maintained for callbacks, use:

- Site URL: `https://public-dm.erniecodev.win`
- Redirect URL: `https://public-dm.erniecodev.win/**`
- Redirect URL: `https://admin-dm.erniecodev.win/**`
- Local testing: `http://localhost:3000/**`

## Verification Checklist

Container:

- `docker compose ... build app` succeeds.
- `dm-admin` is healthy with zero restart loops.
- Port output is `127.0.0.1:3000->3000/tcp`.
- `dm-cloudflared` reports connected and the dashboard reports **Healthy**.

Hostname boundary:

- Admin `/` redirects to `/admin`.
- Admin `/admin/login` loads.
- Admin `/rooms` and `/booking` return 404.
- Admin settings and discount reads still work.
- Public `/`, `/rooms`, and `/booking` load.
- Public `/admin` and `/admin/login` return 404.
- Public `/api/admin/session` and `/api/bookings` return 404.
- Public `/api/public/settings` and public booking APIs work.
- Legacy hostname redirects to the new admin hostname.
- An unknown hostname and the server LAN IP do not expose the app.

Behavior:

- Login, OTP, logout, dashboard, and protected pages work on the admin hostname.
- Booking, room availability, restaurant, reports, messages, and uploads retain
  current behavior.
- Browser console shows no new hydration, CORS, mixed-content, or redirect-loop
  errors.

Use designated test credentials and records for mutating workflow checks.

## Rollback

1. Stop the Docker deployment:

   ```powershell
   docker compose --env-file .env.production --profile tunnel down
   ```

2. Disable the two tunnel application routes.
3. Remove the temporary legacy redirect if it points to the unavailable Docker
   deployment.
4. Restore the previous Firebase custom-domain/DNS routes if Firebase becomes
   available.
5. Return to the previous branch:

   ```powershell
   git switch main
   ```

Supabase is unchanged, so no database rollback is required.

## Official Cloudflare References

- [Create a remotely managed tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/)
- [Route DNS to a tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/)
- [Tunnel origin parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/)
- [Create a redirect rule](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-dashboard/)
