<#
.SYNOPSIS
    One-command launcher for Rapid SCADA -> SmartGrid ingest bridge.

.DESCRIPTION
    Sets defaults from environment (if present) and invokes pull_rapidscada_to_api.ps1.

    Environment variables supported:
      SMARTGRID_API_KEY
      RAPID_SCADA_URL
      SMARTGRID_SCADA_INGEST_URL
      SMARTGRID_SCADA_AGENT_ID
      SMARTGRID_SCADA_POLL_SECONDS
      SMARTGRID_SCADA_DEMO_ANOMALY_PHASE
      SMARTGRID_SCADA_INDEPENDENT_RATE_PRESET
      SMARTGRID_SCADA_TARGET_ANOMALY_PRESSURE
#>

param(
    [switch]$RunOnce
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$runtimeSettingsPath = Join-Path $repoRoot "logs\runtime_settings.json"
$runtimeEnv = @{}
if (Test-Path $runtimeSettingsPath) {
    try {
        $runtimePayload = Get-Content -Path $runtimeSettingsPath -Raw | ConvertFrom-Json
        if ($runtimePayload.runtime_env) {
            $runtimeEnv = @{}
            foreach ($prop in $runtimePayload.runtime_env.PSObject.Properties) {
                $runtimeEnv[[string]$prop.Name] = [string]$prop.Value
            }
        }
    }
    catch {
        Write-Warning "Could not parse runtime settings from $runtimeSettingsPath"
    }
}

function Get-SettingValue([string]$EnvKey, [string]$Fallback) {
    $envValue = [Environment]::GetEnvironmentVariable($EnvKey)
    if (-not [string]::IsNullOrWhiteSpace($envValue)) { return [string]$envValue }
    if ($runtimeEnv.ContainsKey($EnvKey) -and $runtimeEnv[$EnvKey]) { return [string]$runtimeEnv[$EnvKey] }
    return $Fallback
}

if (-not $env:SMARTGRID_API_KEY) {
    Write-Warning "SMARTGRID_API_KEY is not set. Default API guard expects this header."
    Write-Host "Example: `$env:SMARTGRID_API_KEY = 'smartgrid-dev-key'" -ForegroundColor Yellow
}

$rapidUrl = Get-SettingValue -EnvKey 'RAPID_SCADA_URL' -Fallback "http://127.0.0.1:10109"
$apiUrl   = Get-SettingValue -EnvKey 'SMARTGRID_SCADA_INGEST_URL' -Fallback "http://127.0.0.1:8000/v1/scada/ingest/tags/batch"
$agentId  = Get-SettingValue -EnvKey 'SMARTGRID_SCADA_AGENT_ID' -Fallback "GEN-01"
$pollSec  = [int](Get-SettingValue -EnvKey 'SMARTGRID_SCADA_POLL_SECONDS' -Fallback "10")
$demoPhase = Get-SettingValue -EnvKey 'SMARTGRID_SCADA_DEMO_ANOMALY_PHASE' -Fallback "Independent"
$ratePreset = Get-SettingValue -EnvKey 'SMARTGRID_SCADA_INDEPENDENT_RATE_PRESET' -Fallback "Realistic"
$anomalyCycle = [int](Get-SettingValue -EnvKey 'SMARTGRID_SCADA_ANOMALY_CYCLE_SECONDS' -Fallback "150")
$anomalyIntensity = [double](Get-SettingValue -EnvKey 'SMARTGRID_SCADA_ANOMALY_INTENSITY' -Fallback "1.0")
$targetPressure = [double](Get-SettingValue -EnvKey 'SMARTGRID_SCADA_TARGET_ANOMALY_PRESSURE' -Fallback "0.40")
$rapidBearer = if ($env:RAPID_SCADA_BEARER_TOKEN) { $env:RAPID_SCADA_BEARER_TOKEN } else { "" }
$rapidUser   = if ($env:RAPID_SCADA_USERNAME) { $env:RAPID_SCADA_USERNAME } else { "admin" }
$rapidPass   = if ($env:RAPID_SCADA_PASSWORD) { $env:RAPID_SCADA_PASSWORD } else { "scada" }

$bridgePath = Join-Path $PSScriptRoot "pull_rapidscada_to_api.ps1"
if (-not (Test-Path $bridgePath)) {
    throw "Bridge script not found: $bridgePath"
}

Write-Host "Starting Rapid SCADA bridge..." -ForegroundColor Cyan
Write-Host "  Rapid SCADA : $rapidUrl" -ForegroundColor Gray
Write-Host "  SmartGrid   : $apiUrl" -ForegroundColor Gray
Write-Host "  Agent ID    : $agentId" -ForegroundColor Gray
Write-Host "  Poll (sec)  : $pollSec" -ForegroundColor Gray
Write-Host "  Demo phase  : $demoPhase" -ForegroundColor Gray
Write-Host "  Rate preset : $ratePreset" -ForegroundColor Gray
Write-Host "  Attack load : $([int][math]::Round($targetPressure * 100.0))%" -ForegroundColor Gray

if (-not $env:SMARTGRID_SCADA_PRIMARY_AGENT_ID) {
    $env:SMARTGRID_SCADA_PRIMARY_AGENT_ID = $agentId
}

if ($RunOnce) {
    & $bridgePath -RapidScadaUrl $rapidUrl -SmartGridApiUrl $apiUrl -AgentId $agentId -RunOnce -DemoAnomalyPhase $demoPhase -IndependentRatePreset $ratePreset -AnomalyCycleSeconds $anomalyCycle -AnomalyIntensity $anomalyIntensity -TargetAnomalyPressure $targetPressure -RapidScadaBearerToken $rapidBearer -RapidScadaUsername $rapidUser -RapidScadaPassword $rapidPass
} else {
    & $bridgePath -RapidScadaUrl $rapidUrl -SmartGridApiUrl $apiUrl -AgentId $agentId -PollIntervalSeconds $pollSec -DemoAnomalyPhase $demoPhase -IndependentRatePreset $ratePreset -AnomalyCycleSeconds $anomalyCycle -AnomalyIntensity $anomalyIntensity -TargetAnomalyPressure $targetPressure -RapidScadaBearerToken $rapidBearer -RapidScadaUsername $rapidUser -RapidScadaPassword $rapidPass
}
