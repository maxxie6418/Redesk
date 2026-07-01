$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiUrl = 'http://localhost:8787/health'
$webUrl = 'http://localhost:5173/'

Set-Location $root

function Write-Info($message) {
  Write-Host "[Redesk] $message"
}

$currentNodeVersion = (node --version).TrimStart('v')
$nodeMajor = $currentNodeVersion.Split('.')[0]
if ($nodeMajor -lt 22 -or $nodeMajor -ge 25) {
  Write-Host "[Redesk] Node.js version $currentNodeVersion is NOT supported."
  Write-Host "[Redesk] This project requires Node.js >= 22.13 and < 25 (LTS recommended: 22.x)."
  Write-Host "[Redesk] better-sqlite3 does not have prebuilt binaries for Node >= 25."
  Write-Host "[Redesk] Switch Node version using nvm-windows:"
  Write-Host "  nvm install 22"
  Write-Host "  nvm use 22"
  Write-Host ""
  Write-Host "Press any key to close."
  $null = $Host.UI.PromptForChoice('Incompatible Node.js', '', @('&Close'), 0)
  exit 1
}
Write-Info "Node.js $currentNodeVersion - OK"

$pnpmVersion = '11.9.0'

function Find-Pnpm {
  $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $cmd = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  return $null
}

function Ensure-Pnpm {
  $found = Find-Pnpm
  if ($found) {
    return $found
  }

  Write-Info 'pnpm was not found in PATH. Trying corepack first...'
  $corepack = Get-Command corepack -ErrorAction SilentlyContinue
  if ($corepack) {
    & $corepack.Source enable pnpm 2>$null
    if ($LASTEXITCODE -eq 0) {
      & $corepack.Source prepare "pnpm@$pnpmVersion" --activate 2>$null
    }
    $found = Find-Pnpm
    if ($found) {
      return $found
    }
  }

  Write-Info 'corepack did not put pnpm on PATH (likely needs admin). Falling back to npm install -g...'
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) {
    & $npm.Source install -g "pnpm@$pnpmVersion" 2>$null
    $found = Find-Pnpm
    if ($found) {
      return $found
    }
  }

  return $null
}

$pnpm = Ensure-Pnpm
if (-not $pnpm) {
  Write-Host '[Redesk] pnpm was not found in PATH and could not be installed automatically.'
  Write-Host 'Run this once in a terminal (no admin needed):'
  Write-Host "  npm install -g pnpm@$pnpmVersion"
  Write-Host 'Or, in an admin terminal:'
  Write-Host '  corepack enable'
  exit 1
}
Write-Info "using pnpm: $pnpm"

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Info 'node_modules was not found. Installing dependencies first...'
  & $pnpm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[Redesk] dependency install failed.'
    exit $LASTEXITCODE
  }
}

if (-not (Test-Path (Join-Path $root '.env'))) {
  Write-Info 'no .env file found; default local config will be used.'
  Write-Info 'copy .env.example to .env if you need custom ports or secrets.'
}

Write-Info 'starting API at http://localhost:8787'
Start-Process -FilePath cmd.exe -ArgumentList @('/k', 'set CI=true&& pnpm dev:api') -WorkingDirectory $root

Write-Info 'starting Web at http://localhost:5173'
Start-Process -FilePath cmd.exe -ArgumentList @('/k', 'set CI=true&& pnpm dev:web') -WorkingDirectory $root

Write-Info 'waiting for services. Browser will open automatically as soon as the page is reachable.'

$apiReady = $false
$webReady = $false
$browserOpened = $false

for ($i = 0; $i -lt 90; $i++) {
  if (-not $apiReady) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $apiUrl -TimeoutSec 2
      $apiReady = $response.StatusCode -eq 200
    } catch {
      $apiReady = $false
    }
  }

  if (-not $webReady) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $webUrl -TimeoutSec 2
      $webReady = $response.StatusCode -eq 200
    } catch {
      $webReady = $false
    }
  }

  if ($webReady -and -not $browserOpened) {
    Start-Process $webUrl
    $browserOpened = $true
    Write-Info "opened $webUrl"
  }

  if ($apiReady -and $webReady) {
    Write-Info 'services are ready.'
    Write-Info 'to stop services, close the Redesk API and Redesk Web windows.'
    exit 0
  }

  Start-Sleep -Seconds 1
}

if ($browserOpened) {
  Write-Info 'page has been opened, but API health check did not fully confirm within the wait window.'
  Write-Info 'check the API window if the page data still looks abnormal.'
  exit 0
}

Write-Host '[Redesk] services were not ready within 90 seconds.'
Write-Host 'Check the Redesk API and Redesk Web windows for errors.'
Write-Host "Manual URL: $webUrl"
exit 1
