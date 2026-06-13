Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-DeployInfo {
  param([string]$Message)
  Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-DeployPass {
  param([string]$Message)
  Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-DeployWarn {
  param([string]$Message)
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-DeployFail {
  param([string]$Message)
  Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Get-DeployConfig {
  param(
    [string]$ToolkitRoot,
    [string]$ConfigPath
  )

  $defaultAppDir = "C:\dm-admin"
  if (Test-Path (Join-Path $ToolkitRoot ".git")) {
    $defaultAppDir = $ToolkitRoot
  }

  $values = [ordered]@{
    ProjectName = "dm-admin"
    AppDir = $defaultAppDir
    RepoUrl = "GITHUB_REPO_URL_HERE"
    Branch = "main"
    LocalUrl = "http://localhost:3000"
    ProductionUrl = "https://admin-dm.erniecodev.win"
    PublicProductionUrl = "https://public-dm.erniecodev.win"
    CheckPublicProductionUrl = $false
    CloudflaredMode = "windows-service"
    CloudflaredServiceName = "cloudflared"
    AppContainerName = "dm-admin"
    CloudflaredContainerName = "dm-cloudflared"
    HealthTimeoutSeconds = 120
    PruneImagesAfterUpdate = $false
  }

  $resolvedConfigPath = $ConfigPath
  if ([string]::IsNullOrWhiteSpace($resolvedConfigPath)) {
    $resolvedConfigPath = Join-Path $ToolkitRoot "deploy.config.ps1"
  }

  if (Test-Path $resolvedConfigPath) {
    Write-DeployInfo "Loading deployment config: $resolvedConfigPath"
    $DeployConfig = $null
    . $resolvedConfigPath

    if ($null -eq $DeployConfig -or -not ($DeployConfig -is [System.Collections.IDictionary])) {
      throw "The deployment config must define a hashtable named `$DeployConfig. See deploy.config.example.ps1."
    }

    foreach ($key in $DeployConfig.Keys) {
      if (-not $values.Contains($key)) {
        throw "Unknown deployment config key: $key"
      }
      $values[$key] = $DeployConfig[$key]
    }
  } else {
    Write-DeployWarn "deploy.config.ps1 was not found. Safe defaults will be used."
  }

  $values.AppDir = [Environment]::ExpandEnvironmentVariables([string]$values.AppDir)
  $mode = ([string]$values.CloudflaredMode).ToLowerInvariant()
  if ($mode -ne "windows-service" -and $mode -ne "compose") {
    throw "CloudflaredMode must be 'windows-service' or 'compose'."
  }
  $values.CloudflaredMode = $mode

  return [pscustomobject]$values
}

function Assert-CommandAvailable {
  param(
    [string]$Command,
    [string]$InstallMessage
  )

  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
    throw "$Command is not installed or is not available in PATH. $InstallMessage"
  }
  Write-DeployPass "$Command is available."
}

function Invoke-External {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$FailureMessage
  )

  $previousErrorAction = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & $FilePath @ArgumentList 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  foreach ($line in $output) {
    Write-Host $line
  }

  if ($exitCode -ne 0) {
    if ([string]::IsNullOrWhiteSpace($FailureMessage)) {
      $FailureMessage = "$FilePath failed with exit code $exitCode."
    }
    throw $FailureMessage
  }
}

function Invoke-ExternalCapture {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$FailureMessage
  )

  $previousErrorAction = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & $FilePath @ArgumentList 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  if ($exitCode -ne 0) {
    if ([string]::IsNullOrWhiteSpace($FailureMessage)) {
      $FailureMessage = "$FilePath failed with exit code $exitCode."
    }
    throw "$FailureMessage`n$($output -join [Environment]::NewLine)"
  }

  return ($output -join [Environment]::NewLine).Trim()
}

function Assert-DockerReady {
  Assert-CommandAvailable "docker" "Install Docker Desktop, start it, and reopen PowerShell."
  Invoke-ExternalCapture "docker" @("info") "Docker is installed but the Docker engine is not running. Start Docker Desktop and wait until it is ready." | Out-Null
  Write-DeployPass "Docker engine is running."
  Invoke-ExternalCapture "docker" @("compose", "version") "Docker Compose is unavailable. Update Docker Desktop to a version that includes Compose v2." | Out-Null
  Write-DeployPass "Docker Compose is available."
}

function Assert-ProjectFiles {
  param([pscustomobject]$Config)

  if (-not (Test-Path $Config.AppDir -PathType Container)) {
    throw "Project directory does not exist: $($Config.AppDir)"
  }
  if (-not (Test-Path (Join-Path $Config.AppDir "compose.yaml") -PathType Leaf)) {
    throw "compose.yaml was not found in $($Config.AppDir)."
  }
  if (-not (Test-Path (Join-Path $Config.AppDir ".env.production") -PathType Leaf)) {
    throw ".env.production was not found in $($Config.AppDir). Create it from .env.example, add the production values, and run this script again."
  }
}

function Get-ComposePrefix {
  param([pscustomobject]$Config)

  $arguments = @("compose", "--env-file", ".env.production")
  if ($Config.CloudflaredMode -eq "compose") {
    $arguments += @("--profile", "tunnel")
  }
  return $arguments
}

function Invoke-Compose {
  param(
    [pscustomobject]$Config,
    [string[]]$Arguments,
    [string]$FailureMessage
  )

  $composeArguments = @(Get-ComposePrefix $Config) + $Arguments
  Invoke-External "docker" $composeArguments $FailureMessage
}

function Get-GitValue {
  param([string[]]$Arguments)
  return Invoke-ExternalCapture "git" $Arguments "Git command failed."
}

function Assert-CleanRepository {
  $status = Get-GitValue @("status", "--porcelain")
  if (-not [string]::IsNullOrWhiteSpace($status)) {
    throw "The deployment repository has local changes. Commit, move, or remove them before updating. No files were overwritten.`n$status"
  }
}

function Update-DeploymentRepository {
  param([pscustomobject]$Config)

  Push-Location $Config.AppDir
  try {
    Assert-CleanRepository
    $previousCommit = Get-GitValue @("rev-parse", "HEAD")
    $currentBranch = Get-GitValue @("branch", "--show-current")

    Write-DeployInfo "Current branch: $currentBranch"
    Write-DeployInfo "Current commit: $previousCommit"
    Write-DeployInfo "Fetching origin/$($Config.Branch)..."
    Invoke-External "git" @("fetch", "--prune", "origin", $Config.Branch) "Git fetch failed. Check the network connection and repository access."

    if ($currentBranch -ne $Config.Branch) {
      $localBranchExists = $true
      & git show-ref --verify --quiet "refs/heads/$($Config.Branch)"
      if ($LASTEXITCODE -ne 0) {
        $localBranchExists = $false
      }

      if ($localBranchExists) {
        Invoke-External "git" @("switch", $Config.Branch) "Unable to switch to branch $($Config.Branch)."
      } else {
        Invoke-External "git" @("switch", "--track", "-c", $Config.Branch, "origin/$($Config.Branch)") "Unable to create local branch $($Config.Branch)."
      }
    }

    Invoke-External "git" @("pull", "--ff-only", "origin", $Config.Branch) "Git pull was not a fast-forward update. The deployment was stopped without changing Docker."
    $latestCommit = Get-GitValue @("rev-parse", "HEAD")
    $latestSummary = Get-GitValue @("log", "-1", "--oneline")
    Write-DeployPass "Repository updated: $latestSummary"

    return [pscustomobject]@{
      PreviousCommit = $previousCommit
      LatestCommit = $latestCommit
      Branch = $Config.Branch
    }
  } finally {
    Pop-Location
  }
}

function Save-DeploymentMetadata {
  param([pscustomobject]$Config)

  $backupRoot = Join-Path $Config.AppDir "deployment-backups"
  $backupDir = Join-Path $backupRoot (Get-Date -Format "yyyyMMdd-HHmmss")
  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

  Push-Location $Config.AppDir
  try {
    $metadata = [ordered]@{
      Timestamp = (Get-Date).ToString("o")
      Branch = Get-GitValue @("branch", "--show-current")
      Commit = Get-GitValue @("rev-parse", "HEAD")
      CommitSummary = Get-GitValue @("log", "-1", "--oneline")
      AppContainer = $Config.AppContainerName
      CloudflaredMode = $Config.CloudflaredMode
    }
    $metadata | ConvertTo-Json | Set-Content -Path (Join-Path $backupDir "deployment.json") -Encoding UTF8

    $composeArguments = @(Get-ComposePrefix $Config) + @("ps")
    $composeOutput = Invoke-ExternalCapture "docker" $composeArguments "Unable to capture Docker Compose status."
    $composeOutput | Set-Content -Path (Join-Path $backupDir "compose-status.txt") -Encoding UTF8
  } finally {
    Pop-Location
  }

  Write-DeployPass "Deployment metadata saved to $backupDir"
  return $backupDir
}

function Build-Deployment {
  param([pscustomobject]$Config)

  Push-Location $Config.AppDir
  try {
    Write-DeployInfo "Building the production Docker image. The running container remains available if this build fails."
    Invoke-Compose $Config @("build", "app") "Docker image build failed. The existing running container was not intentionally replaced."
  } finally {
    Pop-Location
  }
  Write-DeployPass "Docker image build completed."
}

function Start-Deployment {
  param([pscustomobject]$Config)

  Push-Location $Config.AppDir
  try {
    if ($Config.CloudflaredMode -eq "compose") {
      Invoke-Compose $Config @("up", "-d") "Docker Compose could not start the application and tunnel services."
    } else {
      Invoke-Compose $Config @("up", "-d", "app") "Docker Compose could not start the application service."
    }
  } finally {
    Pop-Location
  }
  Write-DeployPass "Docker Compose services started."
}

function Stop-Deployment {
  param([pscustomobject]$Config)

  Push-Location $Config.AppDir
  try {
    Invoke-Compose $Config @("down") "Docker Compose could not stop the deployment."
  } finally {
    Pop-Location
  }
  Write-DeployPass "Docker services stopped. Images and volumes were preserved."
}

function Show-DeploymentStatus {
  param([pscustomobject]$Config)

  Push-Location $Config.AppDir
  try {
    Invoke-Compose $Config @("ps") "Unable to read Docker Compose status."
  } finally {
    Pop-Location
  }
}

function Get-HttpStatus {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 15
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds -MaximumRedirection 8
    return [int]$response.StatusCode
  } catch {
    if ($null -ne $_.Exception.Response) {
      return [int]$_.Exception.Response.StatusCode
    }
    return $null
  }
}

function Wait-HttpEndpoint {
  param(
    [string]$Url,
    [int]$TimeoutSeconds,
    [string]$Label
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $status = Get-HttpStatus $Url 10
    if ($null -ne $status -and $status -ge 200 -and $status -lt 400) {
      Write-DeployPass "$Label responded with HTTP $status."
      return $true
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  if ($null -eq $status) {
    Write-DeployFail "$Label did not respond: $Url"
  } else {
    Write-DeployFail "$Label returned HTTP ${status}: $Url"
  }
  return $false
}

function Test-AppContainer {
  param([pscustomobject]$Config)

  $deadline = (Get-Date).AddSeconds($Config.HealthTimeoutSeconds)
  do {
    $state = & docker inspect --format "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" $Config.AppContainerName 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-DeployFail "Container $($Config.AppContainerName) was not found."
      return $false
    }

    $parts = ([string]$state).Trim().Split("|")
    if ($parts[0] -ne "running") {
      Write-DeployFail "Container $($Config.AppContainerName) is $($parts[0])."
      return $false
    }
    if ($parts[1] -eq "none" -or $parts[1] -eq "healthy") {
      Write-DeployPass "Container $($Config.AppContainerName) is running with health $($parts[1])."
      return $true
    }
    if ($parts[1] -eq "unhealthy") {
      Write-DeployFail "Container $($Config.AppContainerName) health is unhealthy."
      return $false
    }

    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  Write-DeployFail "Container $($Config.AppContainerName) did not become healthy within $($Config.HealthTimeoutSeconds) seconds."
  return $false
}

function Test-Cloudflared {
  param([pscustomobject]$Config)

  if ($Config.CloudflaredMode -eq "windows-service") {
    $service = Get-Service -Name $Config.CloudflaredServiceName -ErrorAction SilentlyContinue
    if ($null -eq $service) {
      Write-DeployFail "Windows service $($Config.CloudflaredServiceName) was not found."
      return $false
    }
    if ($service.Status -ne "Running") {
      Write-DeployFail "Windows service $($Config.CloudflaredServiceName) is $($service.Status)."
      return $false
    }
    Write-DeployPass "Cloudflared Windows service is running."
    return $true
  }

  $state = & docker inspect --format "{{.State.Status}}" $Config.CloudflaredContainerName 2>$null
  if ($LASTEXITCODE -ne 0 -or ([string]$state).Trim() -ne "running") {
    Write-DeployFail "Cloudflared container $($Config.CloudflaredContainerName) is not running."
    return $false
  }
  Write-DeployPass "Cloudflared container $($Config.CloudflaredContainerName) is running."
  return $true
}

function Test-DeploymentHealth {
  param(
    [pscustomobject]$Config,
    [switch]$IncludeProduction
  )

  $healthy = $true
  try {
    Invoke-ExternalCapture "docker" @("info") "Docker engine is unavailable." | Out-Null
    Write-DeployPass "Docker engine is running."
  } catch {
    Write-DeployFail $_.Exception.Message
    $healthy = $false
  }

  if (-not (Test-AppContainer $Config)) {
    $healthy = $false
  }
  if (-not (Test-Cloudflared $Config)) {
    $healthy = $false
  }
  if (-not (Wait-HttpEndpoint $Config.LocalUrl $Config.HealthTimeoutSeconds "Local application")) {
    $healthy = $false
  }

  if ($IncludeProduction) {
    if (-not (Wait-HttpEndpoint $Config.ProductionUrl 30 "Admin production domain")) {
      $healthy = $false
    }
    if ([bool]$Config.CheckPublicProductionUrl) {
      if (-not (Wait-HttpEndpoint $Config.PublicProductionUrl 30 "Public production domain")) {
        $healthy = $false
      }
    } else {
      Write-DeployInfo "Public production domain check is disabled."
    }
  }

  return $healthy
}

function Save-FailureLogs {
  param(
    [pscustomobject]$Config,
    [string]$Operation
  )

  if (-not (Test-Path $Config.AppDir -PathType Container)) {
    return
  }

  try {
    $logDir = Join-Path $Config.AppDir "deployment-logs"
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    $logFile = Join-Path $logDir ("{0}-{1}.log" -f $Operation, (Get-Date -Format "yyyyMMdd-HHmmss"))

    Push-Location $Config.AppDir
    try {
      $arguments = @(Get-ComposePrefix $Config) + @("logs", "--tail", "200")
      $output = Invoke-ExternalCapture "docker" $arguments "Unable to capture Docker Compose logs."
      $output | Set-Content -Path $logFile -Encoding UTF8
    } finally {
      Pop-Location
    }
    Write-DeployWarn "Recent Compose logs were saved to $logFile"
  } catch {
    Write-DeployWarn "Unable to save failure logs: $($_.Exception.Message)"
  }
}

function Show-DeploymentSummary {
  param([pscustomobject]$Config)

  $tunnelTarget = "http://localhost:3000"
  if ($Config.CloudflaredMode -eq "compose") {
    $tunnelTarget = "http://dm-admin:3000"
  }

  Write-Host ""
  Write-Host "Deployment summary" -ForegroundColor White
  Write-Host "  Project directory: $($Config.AppDir)"
  Write-Host "  Local application: $($Config.LocalUrl)"
  Write-Host "  Cloudflare target: $tunnelTarget"
  Write-Host "  Admin domain: $($Config.ProductionUrl)"
  Write-Host "  Public domain: $($Config.PublicProductionUrl)"
  Write-Host "  Check public domain: $($Config.CheckPublicProductionUrl)"
  Write-Host "  Cloudflared mode: $($Config.CloudflaredMode)"
}
