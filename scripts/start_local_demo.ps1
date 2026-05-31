<#
.SYNOPSIS
  Start complete local SmartGrid demo stack in one command.

.DESCRIPTION
  Launches components in separate PowerShell windows:
    1) Rapid SCADA local web host (ScadaWeb.exe) on 127.0.0.1:10109
    2) SmartGrid FastAPI backend on 127.0.0.1:8000
    3) Rapid SCADA -> API bridge polling loop
    4) Next.js dashboard (web) on http://localhost:3000

.EXAMPLE
  .\scripts\start_local_demo.ps1

.EXAMPLE
  .\scripts\start_local_demo.ps1 -OpenDashboard

.EXAMPLE
  .\scripts\start_local_demo.cmd
#>

param(
    [int]$ApiPort = 8000,
    [int]$ScadaPort = 10109,
    [int]$BridgePollSeconds = 10,
    [string]$ApiKey = "smartgrid-dev-key",
    [switch]$NoScadaWeb,
    [switch]$NoApi,
    [switch]$NoBridge,
    [switch]$NoDashboard,
    [switch]$OpenDashboard
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$scadaExeCandidates = @(
    (Join-Path $repoRoot "rapidscada_local_web\ScadaWeb.exe"),
    (Join-Path $repoRoot "rapidscada_local\ScadaWeb\ScadaWeb.exe")
)

$scadaExe = $null
foreach ($candidate in $scadaExeCandidates) {
    if (Test-Path $candidate) {
        $scadaExe = $candidate
        break
    }
}

$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
$pythonCmd = if (Test-Path $venvPython) { $venvPython } else { "python" }

function Start-ComponentWindow {
    param(
        [string]$Title,
        [string]$Command
    )

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", "`$host.UI.RawUI.WindowTitle = '$Title'; $Command"
    ) | Out-Null
}

function Test-HttpReachable {
    param(
        [string]$Url,
        [int]$TimeoutSec = 3
    )

    try {
        $null = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        return $true
    }
    catch {
        # If server responded with any HTTP status (4xx/5xx), it is still reachable.
        if ($_.Exception.Response) {
            return $true
        }
        return $false
    }
}

function Wait-HttpReachable {
    param(
        [string]$Url,
        [int]$MaxWaitSec = 25,
        [int]$PollSec = 1
    )

    $deadline = (Get-Date).AddSeconds($MaxWaitSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpReachable -Url $Url) {
            return $true
        }
        Start-Sleep -Seconds $PollSec
    }
    return $false
}

Write-Host "Starting local demo stack from: $repoRoot" -ForegroundColor Cyan
Write-Host "API Port: $ApiPort | SCADA Port: $ScadaPort | Bridge Poll: $BridgePollSeconds s" -ForegroundColor Gray
Write-Host "Mode: development | API key: $ApiKey" -ForegroundColor Gray
Write-Host "(In production, set SMARTGRID_ENV=production and SMARTGRID_API_KEY to a real secret.)" -ForegroundColor DarkGray

if (-not $NoApi) {
    $cmd = "Set-Location '$repoRoot'; `$env:SMARTGRID_ENV='development'; `$env:SMARTGRID_API_KEY='$ApiKey'; `$env:SMARTGRID_API_HOST='127.0.0.1'; `$env:SMARTGRID_API_PORT='$ApiPort'; & '$pythonCmd' -m smartgrid_mas.api_server"
    Start-ComponentWindow -Title "SmartGrid API" -Command $cmd
    Write-Host "Launched SmartGrid API on 127.0.0.1:$ApiPort" -ForegroundColor Green

    if (Wait-HttpReachable -Url "http://127.0.0.1:$ApiPort/health" -MaxWaitSec 30 -PollSec 1) {
        Write-Host "API is reachable." -ForegroundColor Green
    }
    else {
        Write-Warning "API did not become reachable in time. Bridge/dashboard may fail."
    }
}

if (-not $NoScadaWeb) {
    if (Test-HttpReachable -Url "http://127.0.0.1:$ScadaPort/" -TimeoutSec 2) {
        Write-Host "ScadaWeb already reachable on 127.0.0.1:$ScadaPort, skipping new launch." -ForegroundColor Yellow
    }
    elseif (-not $scadaExe) {
        Write-Warning "ScadaWeb.exe not found. Skipping Rapid SCADA host start."
    }
    else {
        $scadaDir = Split-Path $scadaExe -Parent
        $oldUrls = $env:ASPNETCORE_URLS
        $oldEventLog = $env:Logging__EventLog__LogLevel__Default
        $env:ASPNETCORE_URLS = "http://127.0.0.1:$ScadaPort"
        $env:Logging__EventLog__LogLevel__Default = "None"
        Start-Process -FilePath $scadaExe -WorkingDirectory $scadaDir | Out-Null
        if ($null -eq $oldUrls) { Remove-Item Env:ASPNETCORE_URLS -ErrorAction SilentlyContinue } else { $env:ASPNETCORE_URLS = $oldUrls }
        if ($null -eq $oldEventLog) { Remove-Item Env:Logging__EventLog__LogLevel__Default -ErrorAction SilentlyContinue } else { $env:Logging__EventLog__LogLevel__Default = $oldEventLog }
        Write-Host "Launched ScadaWeb on 127.0.0.1:$ScadaPort" -ForegroundColor Green

        if (Wait-HttpReachable -Url "http://127.0.0.1:$ScadaPort/" -MaxWaitSec 20 -PollSec 1) {
            Write-Host "ScadaWeb is reachable." -ForegroundColor Green
        }
        else {
            Write-Warning "ScadaWeb did not become reachable in time. Bridge may fail."
        }
    }
}

if (-not $NoBridge) {
    $bridgeScript = Join-Path $repoRoot "scripts\start_rapidscada_bridge.ps1"
    $apiReady = Test-HttpReachable -Url "http://127.0.0.1:$ApiPort/health"
    if (-not $apiReady) {
        Write-Warning "Skipping bridge launch because API is not reachable at http://127.0.0.1:$ApiPort/health"
    }
    else {
        # Wait for Rapid SCADA web to be fully ready before launching bridge
        Write-Host "Waiting for Rapid SCADA to be ready..." -ForegroundColor Yellow
        $scadaReady = Wait-HttpReachable -Url "http://127.0.0.1:$ScadaPort/" -MaxWaitSec 15 -PollSec 2
        if ($scadaReady) {
            Write-Host "Rapid SCADA is ready" -ForegroundColor Green
        } else {
            Write-Host "Rapid SCADA not yet ready - bridge will retry on first poll" -ForegroundColor Yellow
        }
        $cmd = "Set-Location '$repoRoot'; `$env:SMARTGRID_API_KEY='$ApiKey'; `$env:RAPID_SCADA_URL='http://127.0.0.1:$ScadaPort'; `$env:SMARTGRID_SCADA_INGEST_URL='http://127.0.0.1:$ApiPort/v1/scada/ingest/tags/batch'; `$env:SMARTGRID_SCADA_POLL_SECONDS='$BridgePollSeconds'; `$env:SMARTGRID_SCADA_SCORE_THRESHOLD='3.0'; while (`$true) { try { powershell -ExecutionPolicy Bypass -File '$bridgeScript' } catch { Write-Host 'Bridge stopped:' `$_.Exception.Message -ForegroundColor Red }; Write-Host 'Restarting bridge in 2s...' -ForegroundColor Yellow; Start-Sleep -Seconds 2 }"
        Start-ComponentWindow -Title "SCADA Bridge" -Command $cmd
        Write-Host "Launched SCADA bridge (100 agents)" -ForegroundColor Green
    }
}

if (-not $NoDashboard) {
    $webDir = Join-Path $repoRoot "web"
    if (-not (Test-Path $webDir)) {
        Write-Warning "web directory not found. Skipping dashboard start."
    }
    else {
        # Pass SMARTGRID_API_KEY explicitly so the dashboard works even if
        # web/.env.local is missing or out of date.
        $cmd = "Set-Location '$webDir'; `$env:SMARTGRID_API_KEY='$ApiKey'; `$env:SMARTGRID_API_URL='http://127.0.0.1:$ApiPort'; `$env:SMARTGRID_LOCAL_API='http://127.0.0.1:$ApiPort'; cmd /c npm run dev"
        Start-ComponentWindow -Title "Dashboard (Next.js)" -Command $cmd
        Write-Host "Launched dashboard on http://localhost:3000" -ForegroundColor Green
    }
}

if ($OpenDashboard -and -not $NoDashboard) {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:3000" | Out-Null
}

Write-Host "" 
Write-Host "Done. Demo startup launched in separate terminals." -ForegroundColor Cyan
Write-Host "One-shot launch commands:" -ForegroundColor Yellow
Write-Host "  .\scripts\start_local_demo.ps1" -ForegroundColor Gray
Write-Host "  .\scripts\start_local_demo.ps1 -OpenDashboard" -ForegroundColor Gray
Write-Host "  .\scripts\start_local_demo.cmd" -ForegroundColor Gray
Write-Host "Quick checks:" -ForegroundColor Yellow
Write-Host "  API health : http://127.0.0.1:$ApiPort/health" -ForegroundColor Gray
Write-Host "  Dashboard  : http://localhost:3000" -ForegroundColor Gray
Write-Host "  SCADA host : http://127.0.0.1:$ScadaPort" -ForegroundColor Gray
