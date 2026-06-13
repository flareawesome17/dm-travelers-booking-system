param(
  [Parameter(Mandatory = $true)]
  [string]$Commit,
  [string]$ConfigPath
)

$ToolkitRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "windows-deploy-common.ps1")
$Config = Get-DeployConfig $ToolkitRoot $ConfigPath

try {
  Write-Host "D&M Hotel manual rollback" -ForegroundColor White
  Assert-CommandAvailable "git" "Install Git for Windows and reopen PowerShell."
  Assert-DockerReady
  Assert-ProjectFiles $Config

  Push-Location $Config.AppDir
  try {
    Assert-CleanRepository
    $previousCommit = Get-GitValue @("rev-parse", "HEAD")
    Write-DeployInfo "Current commit: $previousCommit"
    Write-DeployInfo "Requested rollback commit: $Commit"

    Invoke-External "git" @("fetch", "--all", "--prune") "Unable to refresh Git commit information."
    Invoke-ExternalCapture "git" @("cat-file", "-e", "$Commit^{commit}") "The requested commit does not exist: $Commit" | Out-Null
    Save-DeploymentMetadata $Config | Out-Null
    Invoke-External "git" @("switch", "--detach", $Commit) "Unable to check out rollback commit $Commit."
  } finally {
    Pop-Location
  }

  Build-Deployment $Config
  Start-Deployment $Config
  Show-DeploymentStatus $Config

  if (-not (Test-DeploymentHealth $Config -IncludeProduction)) {
    throw "Rollback commit was deployed, but one or more health checks failed."
  }

  Write-Host "  Previous commit: $previousCommit"
  Write-Host "  Active rollback: $Commit"
  Write-Host "  Future updates will switch back to configured branch: $($Config.Branch)"
  Write-DeployPass "ROLLBACK COMPLETED SUCCESSFULLY."
} catch {
  Write-DeployFail $_.Exception.Message
  Save-FailureLogs $Config "rollback-failure"
  exit 1
}
