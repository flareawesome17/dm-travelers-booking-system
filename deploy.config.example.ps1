$DeployConfig = @{
  ProjectName = "dm-admin"
  AppDir = "C:\dm-admin"
  RepoUrl = "https://github.com/flareawesome17/dm-travelers-booking-system.git"
  Branch = "main"
  LocalUrl = "http://localhost:3000"
  ProductionUrl = "https://admin-dm.erniecodev.win"
  PublicProductionUrl = "https://public-dm.erniecodev.win"
  CheckPublicProductionUrl = $false

  # Use "windows-service" for the currently configured Windows Cloudflared service.
  # Use "compose" only when Cloudflared should run from the compose.yaml tunnel profile.
  CloudflaredMode = "windows-service"
  CloudflaredServiceName = "cloudflared"

  AppContainerName = "dm-admin"
  CloudflaredContainerName = "dm-cloudflared"
  HealthTimeoutSeconds = 120
  PruneImagesAfterUpdate = $false
}
