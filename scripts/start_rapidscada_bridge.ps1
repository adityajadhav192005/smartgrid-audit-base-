<#
.SYNOPSIS
    One-command launcher for Rapid SCADA -> SmartGrid ingest bridge (100 agents).

.DESCRIPTION
    Sets defaults from environment (if present) and invokes pull_rapidscada_to_api.ps1.

    Environment variables supported:
      SMARTGRID_API_KEY
      RAPID_SCADA_URL
      SMARTGRID_SCADA_INGEST_URL
      SMARTGRID_SCADA_POLL_SECONDS
#>

param(
    [switch]$RunOnce
)

$ErrorActionPreference = "Stop"

if (-not $env:SMARTGRID_API_KEY) {
    Write-Warning "SMARTGRID_API_KEY is not set. Default API guard expects this header."
    Write-Host "Example: `$env:SMARTGRID_API_KEY = 'smartgrid-dev-key'" -ForegroundColor Yellow
}

$rapidUrl = if ($env:RAPID_SCADA_URL) { $env:RAPID_SCADA_URL } else { "http://127.0.0.1:10109" }
$apiUrl   = if ($env:SMARTGRID_SCADA_INGEST_URL) { $env:SMARTGRID_SCADA_INGEST_URL } else { "http://127.0.0.1:8000/v1/scada/ingest/tags/batch" }
$pollSec  = if ($env:SMARTGRID_SCADA_POLL_SECONDS) { [int]$env:SMARTGRID_SCADA_POLL_SECONDS } else { 10 }
$rapidBearer = if ($env:RAPID_SCADA_BEARER_TOKEN) { $env:RAPID_SCADA_BEARER_TOKEN } else { "" }
$rapidUser   = if ($env:RAPID_SCADA_USERNAME) { $env:RAPID_SCADA_USERNAME } else { "admin" }
$rapidPass   = if ($env:RAPID_SCADA_PASSWORD) { $env:RAPID_SCADA_PASSWORD } else { "scada" }

$bridgePath = Join-Path $PSScriptRoot "pull_rapidscada_to_api.ps1"
if (-not (Test-Path $bridgePath)) {
    throw "Bridge script not found: $bridgePath"
}

Write-Host "Starting Rapid SCADA bridge (100 agents)..." -ForegroundColor Cyan
Write-Host "  Rapid SCADA : $rapidUrl" -ForegroundColor Gray
Write-Host "  SmartGrid   : $apiUrl" -ForegroundColor Gray
Write-Host "  Poll (sec)  : $pollSec" -ForegroundColor Gray

if ($RunOnce) {
    & $bridgePath -RapidScadaUrl $rapidUrl -SmartGridApiUrl $apiUrl -RunOnce -RapidScadaBearerToken $rapidBearer -RapidScadaUsername $rapidUser -RapidScadaPassword $rapidPass
} else {
    & $bridgePath -RapidScadaUrl $rapidUrl -SmartGridApiUrl $apiUrl -PollIntervalSeconds $pollSec -RapidScadaBearerToken $rapidBearer -RapidScadaUsername $rapidUser -RapidScadaPassword $rapidPass
}
