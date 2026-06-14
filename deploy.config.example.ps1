$DeployConfig = @{
  ProjectName = "dm-admin"
  AppDir = "C:\dm-admin"
  RepoUrl = "https://github.com/flareawesome17/dm-travelers-booking-system.git"
  Branch = "main"
  LocalUrl = "http://127.0.0.1:3000"
  ProductionUrl = "https://admin-dm.erniecodev.win"
  PublicProductionUrl = "https://public-dm.erniecodev.win"
  CheckPublicProductionUrl = $false

  # Recommended: run Cloudflared with the compose.yaml tunnel profile.
  # Use "windows-service" only for a separately installed Windows service.
  CloudflaredMode = "compose"
  CloudflaredServiceName = "cloudflared"

  AppContainerName = "dm-admin"
  CloudflaredContainerName = "dm-cloudflared"
  HealthTimeoutSeconds = 120
  PruneImagesAfterUpdate = $false
}
