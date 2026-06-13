param(
  [string]$ConfigPath,
  [switch]$AppOnly,
  [switch]$Follow,
  [ValidateRange(1, 10000)]
  [int]$Tail = 200
)

$ToolkitRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "windows-deploy-common.ps1")
$Config = Get-DeployConfig $ToolkitRoot $ConfigPath

try {
  Assert-DockerReady
  Assert-ProjectFiles $Config

  $arguments = @("logs", "--tail", [string]$Tail)
  if ($Follow) {
    $arguments += "--follow"
  }
  if ($AppOnly -or $Config.CloudflaredMode -eq "windows-service") {
    $arguments += "app"
  }

  Push-Location $Config.AppDir
  try {
    Invoke-Compose $Config $arguments "Unable to read Docker Compose logs."
  } finally {
    Pop-Location
  }
} catch {
  Write-DeployFail $_.Exception.Message
  exit 1
}
