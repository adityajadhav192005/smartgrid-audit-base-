param(
    [string]$ApiUrl = "http://127.0.0.1:8000/grid/status",
    [string]$IngestUrl = "https://insights-collector.newrelic.com/v1/accounts/events",
    [int]$IntervalSeconds = 60,
    [switch]$RunOnce
)

$ErrorActionPreference = "Stop"

if (-not $env:NEW_RELIC_INSERT_KEY) {
    throw "NEW_RELIC_INSERT_KEY is required. Set it in the current PowerShell session before running this script."
}

function Send-MASStatusEvent {
    param(
        [Parameter(Mandatory = $true)]
        [pscustomobject]$Status
    )

    $event = @{
        eventType = "MASStatus"
        source = "smartgrid-mas-fastapi"
        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        nAgents = [int]$Status.n_agents
        riskThreshold = [double]$Status.risk_threshold
        globalRisk = [double]$Status.global_risk
        attackRate = [double]$Status.attack_rate
        costEfficiency = [double]$Status.cost_efficiency
        riskMitigation = [double]$Status.risk_mitigation
        coverage = [double]$Status.coverage
        precision = [double]$Status.precision
        recall = [double]$Status.recall
        f1 = [double]$Status.f1
        avgEndToEndDelayMs = [double]$Status.avg_end_to_end_delay_ms
    }

    $body = @($event) | ConvertTo-Json -Compress
    $headers = @{
        "X-Insert-Key" = $env:NEW_RELIC_INSERT_KEY
        "Content-Type" = "application/json"
    }

    Invoke-RestMethod -Method Post -Uri $IngestUrl -Headers $headers -Body $body | Out-Null
    return $event
}

function Get-GridStatus {
    $status = Invoke-RestMethod -Method Get -Uri $ApiUrl
    if (-not $status) {
        throw "Empty response from grid status endpoint: $ApiUrl"
    }
    return $status
}

Write-Host "Polling FastAPI status endpoint: $ApiUrl"
Write-Host "Sending MASStatus events to New Relic ingest endpoint."
Write-Host "Press Ctrl+C to stop."

do {
    try {
        $status = Get-GridStatus
        $event = Send-MASStatusEvent -Status $status
        Write-Host ("[{0}] Sent MASStatus | risk={1:N4} attack={2:P2} cost_eff={3:P2} coverage={4:P2}" -f (Get-Date), $event.globalRisk, $event.attackRate, $event.costEfficiency, $event.coverage)
    }
    catch {
        Write-Warning $_.Exception.Message
    }

    if (-not $RunOnce) {
        Start-Sleep -Seconds $IntervalSeconds
    }
} while (-not $RunOnce)