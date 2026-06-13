param(
  [string]$ConfigPath,
  [switch]$LocalOnly
)

$ToolkitRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "windows-deploy-common.ps1")
$Config = Get-DeployConfig $ToolkitRoot $ConfigPath

try {
  Write-Host "D&M Hotel deployment health check" -ForegroundColor White
  Assert-ProjectFiles $Config

  $healthy = $false
  if ($LocalOnly) {
    $healthy = Test-DeploymentHealth $Config
  } else {
    $healthy = Test-DeploymentHealth $Config -IncludeProduction
  }

  Show-DeploymentSummary $Config
  if (-not $healthy) {
    throw "One or more deployment health checks failed."
  }
  Write-DeployPass "HEALTH CHECK PASSED."
} catch {
  Write-DeployFail $_.Exception.Message
  exit 1
}
