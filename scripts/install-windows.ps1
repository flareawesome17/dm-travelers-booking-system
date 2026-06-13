param(
  [string]$ConfigPath
)

$ToolkitRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "windows-deploy-common.ps1")
$Config = Get-DeployConfig $ToolkitRoot $ConfigPath

try {
  Write-Host "D&M Hotel initial Windows installation" -ForegroundColor White
  Assert-CommandAvailable "git" "Install Git for Windows and reopen PowerShell."
  Assert-DockerReady

  if (-not (Test-Path $Config.AppDir)) {
    if ([string]::IsNullOrWhiteSpace($Config.RepoUrl) -or $Config.RepoUrl -eq "GITHUB_REPO_URL_HERE") {
      throw "Set RepoUrl in deploy.config.ps1 before the first clone. See deploy.config.example.ps1."
    }

    $parentDir = Split-Path $Config.AppDir -Parent
    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    Write-DeployInfo "Cloning $($Config.RepoUrl) into $($Config.AppDir)..."
    Invoke-External "git" @("clone", "--branch", $Config.Branch, "--single-branch", $Config.RepoUrl, $Config.AppDir) "Git clone failed."
  } elseif (-not (Test-Path (Join-Path $Config.AppDir ".git"))) {
    throw "$($Config.AppDir) exists but is not a Git repository. Move it or set AppDir to the correct project folder."
  } else {
    Write-DeployInfo "Existing repository found. Updating it before installation."
    Update-DeploymentRepository $Config | Out-Null
  }

  Assert-ProjectFiles $Config
  Build-Deployment $Config
  Start-Deployment $Config
  Show-DeploymentStatus $Config

  if (-not (Test-DeploymentHealth $Config -IncludeProduction)) {
    throw "Installation started, but one or more health checks failed."
  }

  Show-DeploymentSummary $Config
  Write-Host ""
  Write-DeployPass "INSTALLATION COMPLETED SUCCESSFULLY."
} catch {
  Write-Host ""
  Write-DeployFail $_.Exception.Message
  Save-FailureLogs $Config "install-failure"
  exit 1
}
