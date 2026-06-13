param(
  [string]$ConfigPath
)

$ToolkitRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "windows-deploy-common.ps1")
$Config = Get-DeployConfig $ToolkitRoot $ConfigPath

try {
  Write-Host "Starting D&M Hotel deployment" -ForegroundColor White
  Assert-DockerReady
  Assert-ProjectFiles $Config
  Start-Deployment $Config
  Show-DeploymentStatus $Config

  if (-not (Test-DeploymentHealth $Config)) {
    throw "The deployment started, but a local health check failed."
  }

  Show-DeploymentSummary $Config
  Write-DeployPass "START COMPLETED SUCCESSFULLY."
} catch {
  Write-DeployFail $_.Exception.Message
  Save-FailureLogs $Config "start-failure"
  exit 1
}
