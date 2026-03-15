param(
    [string]$ApiUrl = "http://127.0.0.1:8000/v1/scada/ingest/tags",
    [string]$AgentId = "22",
    [double]$CriticalityWeight = 1.0,
    [double]$ScoreThreshold = 1.0,
    [string]$TagsJsonPath = "",
    [switch]$UseSamplePayload
)

$ErrorActionPreference = "Stop"

if (-not $env:SMARTGRID_API_KEY) {
    throw "SMARTGRID_API_KEY is required. Set it before running this script."
}

function Get-SampleTags {
    return @{
        voltage = 1.18
        frequency = 0.91
        current = 1.26
        power = 1.14
        response_time = 1.08
        latency = 0.42
        packet_loss = 0.08
        integrity = 0.82
        comm_freq = 0.61
    }
}

function Get-TagsPayload {
    if ($UseSamplePayload -or [string]::IsNullOrWhiteSpace($TagsJsonPath)) {
        return Get-SampleTags
    }

    if (-not (Test-Path $TagsJsonPath)) {
        throw "Tags JSON file not found: $TagsJsonPath"
    }

    $raw = Get-Content $TagsJsonPath -Raw
    return ($raw | ConvertFrom-Json -AsHashtable)
}

$payload = @{
    agent_id = $AgentId
    tags = Get-TagsPayload
    criticality_weight = $CriticalityWeight
    score_threshold = $ScoreThreshold
} | ConvertTo-Json -Depth 6

$headers = @{
    "X-API-Key" = $env:SMARTGRID_API_KEY
    "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Method Post -Uri $ApiUrl -Headers $headers -Body $payload
$response | ConvertTo-Json -Depth 8