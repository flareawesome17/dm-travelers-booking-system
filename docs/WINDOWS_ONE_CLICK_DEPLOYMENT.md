# Windows One-Click Deployment

This toolkit updates only the hosting deployment. It does not change the
application UI, business logic, authentication, Supabase schema, RLS, or data.

## Current Production Architecture

```text
Admin browser
  -> https://admin-dm.erniecodev.win
  -> Cloudflare Tunnel Docker container
  -> http://dm-admin:3000
  -> Docker container dm-admin

Public browser
  -> https://public-dm.erniecodev.win
  -> Cloudflare Tunnel Docker container
  -> http://dm-admin:3000
  -> Docker container dm-admin
```

The old `admindm.erniecodev.win` hostname is only a temporary redirect. Do not
use it as the primary deployment health URL.

## Required Software

Install these on the final Windows server:

1. Docker Desktop with Docker Compose v2.
2. Git for Windows.
3. Windows PowerShell 5.1 or newer.
4. A Cloudflare Tunnel token for the `dm-hotel` tunnel.

Before deployment:

- Start Docker Desktop and wait until the engine reports ready.
- Confirm the Cloudflare tunnel is Healthy.
- Confirm enabled published application routes point to `http://dm-admin:3000`.
- Configure Docker Desktop to start when the server starts.

## Recommended Project Location

Use:

```text
C:\dm-admin
```

The scripts also work from another configured folder. When run directly from an
existing Git checkout, they default to that checkout.

## Configure Deployment

From the project folder:

```powershell
Copy-Item .\deploy.config.example.ps1 .\deploy.config.ps1
```

Edit `deploy.config.ps1`:

```powershell
$DeployConfig = @{
  ProjectName = "dm-admin"
  AppDir = "C:\dm-admin"
  RepoUrl = "https://github.com/OWNER/REPOSITORY.git"
  Branch = "main"
  LocalUrl = "http://127.0.0.1:3000"
  ProductionUrl = "https://admin-dm.erniecodev.win"
  PublicProductionUrl = "https://public-dm.erniecodev.win"
  CheckPublicProductionUrl = $false
  CloudflaredMode = "compose"
  CloudflaredServiceName = "cloudflared"
  AppContainerName = "dm-admin"
  CloudflaredContainerName = "dm-cloudflared"
  HealthTimeoutSeconds = 120
  PruneImagesAfterUpdate = $false
}
```

`deploy.config.ps1` is ignored by Git.

## Configure Production Environment

Place this file in the configured application directory:

```text
C:\dm-admin\.env.production
```

Create it from the example:

```powershell
Copy-Item .\.env.example .\.env.production
notepad .\.env.production
```

Set the real Supabase, authentication, email, payment, and domain values.
Confirm:

```env
ADMIN_SUBDOMAIN=admin-dm.erniecodev.win
NEXT_PUBLIC_APP_DOMAIN=public-dm.erniecodev.win
```

Add a fresh token from **Cloudflare Zero Trust -> Networks -> Connectors ->
Cloudflare Tunnels -> dm-hotel -> Add a connector**:

```env
CLOUDFLARE_TUNNEL_TOKEN=your-new-token
```

Do not post or commit the token. `.env.production` is ignored by Git and is
never replaced by the update script. Starting the Compose tunnel profile
registers the connector automatically; no Windows service installation is
required.

## Initial Installation

### Existing checkout

If the repository is already present in `C:\dm-admin`:

1. Add `deploy.config.ps1`.
2. Add `.env.production`.
3. Double-click `INSTALL_D&M_ADMIN.bat`.

PowerShell equivalent:

```powershell
powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\scripts\install-windows.ps1
```

### Clone from a small installer folder

The installer can clone the repository when `AppDir` does not exist. Copy these
items to a temporary deployment folder:

```text
INSTALL_D&M_ADMIN.bat
deploy.config.example.ps1
scripts\
```

Rename the config to `deploy.config.ps1`, set `RepoUrl`, `Branch`, and `AppDir`,
then double-click the installer. The first run stops after cloning if
`.env.production` is missing. Create `C:\dm-admin\.env.production`, then run the
installer again.

For private GitHub repositories, sign in with Git Credential Manager before
running the installer.

## One-Click Updates

After changes are committed and pushed to the configured Git branch:

```text
Double-click UPDATE_D&M_ADMIN.bat
```

PowerShell equivalent:

```powershell
powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\scripts\update-windows.ps1
```

The updater:

1. Refuses to overwrite local Git changes.
2. Saves current commit and Compose status under `deployment-backups`.
3. Fetches and pulls with `--ff-only`.
4. Builds the new image before replacing the running app.
5. Starts the `dm-admin` service.
6. Checks Docker, container health, Cloudflared, localhost, and the admin domain.
7. Saves recent Compose logs under `deployment-logs` if deployment fails.

The public production check is disabled while that hostname is intentionally
offline. Set this when the public domain is activated again:

```powershell
CheckPublicProductionUrl = $true
```

Optional unused-image pruning:

```powershell
.\scripts\update-windows.ps1 -PruneImages
```

This uses `docker image prune -f`. It does not delete volumes.

## Start, Stop, Logs, and Health

Double-click:

```text
START_D&M_ADMIN.bat
STOP_D&M_ADMIN.bat
VIEW_LOGS_D&M_ADMIN.bat
HEALTHCHECK_D&M_ADMIN.bat
```

PowerShell:

```powershell
.\scripts\start-windows.ps1
.\scripts\stop-windows.ps1
.\scripts\logs-windows.ps1 -AppOnly -Tail 300
.\scripts\logs-windows.ps1 -AppOnly -Follow
.\scripts\healthcheck-windows.ps1
.\scripts\healthcheck-windows.ps1 -LocalOnly
```

Stopping the Compose deployment also stops its Cloudflared container. The stop
script does not remove images or volumes.

## Verify the Application

Container status:

```powershell
docker compose --env-file .env.production ps
```

Expected port:

```text
127.0.0.1:3000->3000/tcp
```

Open:

- `http://127.0.0.1:3000`
- `https://admin-dm.erniecodev.win`
- `https://public-dm.erniecodev.win`

Strict routing checks:

```powershell
curl.exe -I https://admin-dm.erniecodev.win
curl.exe -I https://public-dm.erniecodev.win
curl.exe -I https://public-dm.erniecodev.win/admin
```

The public `/admin` request must return 404.

## Manual Rollback

Every update prints the previous commit hash. Roll back only when explicitly
needed:

```powershell
.\scripts\rollback-windows.ps1 -Commit PREVIOUS_COMMIT_HASH
```

Or double-click `ROLLBACK_D&M_ADMIN.bat` and enter the commit hash.

Rollback checks out the commit in detached mode, rebuilds, restarts, and runs
the health checks. It does not change Supabase or delete volumes. A later normal
update switches back to the configured branch.

## Common Errors

### Docker is installed but not running

Start Docker Desktop and wait until:

```powershell
docker info
```

completes successfully.

### `.env.production` is missing

Create it in `AppDir`, not in the temporary installer folder:

```powershell
Copy-Item C:\dm-admin\.env.example C:\dm-admin\.env.production
```

### Repository has local changes

The updater intentionally stops. Review:

```powershell
git -C C:\dm-admin status
```

Do not discard changes until their owner confirms they are unnecessary.

### Git pull is not fast-forward

The server branch has diverged from GitHub. Do not force reset it. Inspect the
branch and commit history before continuing.

### Cloudflared container is not running

Confirm the token exists in `.env.production`, then run:

```powershell
docker compose --env-file .env.production --profile tunnel up -d
docker compose --env-file .env.production --profile tunnel logs --tail 100 cloudflared
```

### Local app works but production domains fail

Check:

1. Cloudflare tunnel status is Healthy.
2. Enabled published application routes use `http://dm-admin:3000`.
3. HTTP Host Header is empty.
4. The `dm-cloudflared` container is running.
5. Docker shows `dm-admin` as healthy.

### Review failure logs

```text
C:\dm-admin\deployment-logs\
```

The files contain recent Compose output and do not intentionally contain the
contents of `.env.production`.

## Optional EXE Wrapper

The BAT launchers are the recommended one-click interface because they remain
transparent and easy to audit. A real EXE is not required. If organizational
policy requires an EXE, use a trusted, code-signed PowerShell packaging tool
such as PS2EXE and keep the generated EXE beside the `scripts` directory.
Validate the tool source and sign the resulting executable before production
use.
