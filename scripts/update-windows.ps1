param(
  [string]$ConfigPath,
  [switch]$PruneImages
)

$ToolkitRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "windows-deploy-common.ps1")
$Config = Get-DeployConfig $ToolkitRoot $ConfigPath

try {
  Write-Host "D&M Hotel production update" -ForegroundColor White
  Assert-CommandAvailable "git" "Install Git for Windows and reopen PowerShell."
  Assert-DockerReady
  Assert-ProjectFiles $Config

  $backupDir = Save-DeploymentMetadata $Config
  $gitResult = Update-DeploymentRepository $Config
  Write-DeployInfo "Previous commit: $($gitResult.PreviousCommit)"
  Write-DeployInfo "Latest commit:   $($gitResult.LatestCommit)"

  Build-Deployment $Config
  Start-Deployment $Config
  Show-DeploymentStatus $Config

  if (-not (Test-DeploymentHealth $Config -IncludeProduction)) {
    throw "The update was deployed, but one or more health checks failed. Review the logs before deciding whether to roll back."
  }

  if ($PruneImages -or [bool]$Config.PruneImagesAfterUpdate) {
    Write-DeployInfo "Pruning unused Docker images. Volumes will not be removed."
    Invoke-External "docker" @("image", "prune", "-f") "Docker image pruning failed."
  }

  Show-DeploymentSummary $Config
  Write-Host "  Metadata backup: $backupDir"
  Write-Host "  Rollback commit: $($gitResult.PreviousCommit)"
  Write-Host ""
  Write-DeployPass "UPDATE COMPLETED SUCCESSFULLY."
} catch {
  Write-Host ""
  Write-DeployFail $_.Exception.Message
  Save-FailureLogs $Config "update-failure"
  Write-DeployWarn "The script does not automatically alter Git history or delete volumes. Use rollback-windows.ps1 explicitly if rollback is required."
  exit 1
}
