param(
  [string]$ConfigPath
)

$ToolkitRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "windows-deploy-common.ps1")
$Config = Get-DeployConfig $ToolkitRoot $ConfigPath

try {
  Write-Host "Stopping D&M Hotel Docker deployment" -ForegroundColor White
  Assert-DockerReady
  Assert-ProjectFiles $Config
  Stop-Deployment $Config

  if ($Config.CloudflaredMode -eq "windows-service") {
    Write-DeployInfo "The Cloudflared Windows service was left running."
  }
  Write-DeployPass "STOP COMPLETED SUCCESSFULLY."
} catch {
  Write-DeployFail $_.Exception.Message
  exit 1
}
