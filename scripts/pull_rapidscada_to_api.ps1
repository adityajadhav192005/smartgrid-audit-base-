<#
.SYNOPSIS
    Polls Rapid SCADA's REST API (port 10008) and forwards channel values
    to the SmartGrid FastAPI audit endpoint as normalised SCADA tags.

.DESCRIPTION
    Rapid SCADA (web app on IIS, port 10008) exposes current channel data at:
        GET http://localhost:10008/Api/Main/GetCurData?cnlNums=<comma-list>

    This bridge:
        1. Fetches current channel values from Rapid SCADA
        2. Maps channel numbers to the SmartGrid tag schema
        3. POSTs the normalised tags to  POST http://localhost:8000/v1/scada/ingest/tags
        4. Optionally loops on an interval

.PARAMETER RapidScadaUrl
    Base URL of your Rapid SCADA web app. Default: http://localhost:10008

.PARAMETER SmartGridApiUrl
    SmartGrid FastAPI ingest endpoint. Default: http://127.0.0.1:8000/v1/scada/ingest/tags

.PARAMETER AgentId
    Agent ID to tag the reading with (matches an agent in the simulation). Default: "1"

.PARAMETER CriticalityWeight
    Criticality weight for this agent (1.0 = generator, 0.7 = substation, 0.3 = PMU).

.PARAMETER NominalVoltage
    Nominal voltage in Volts used to normalise the raw channel reading. Default: 230.0

.PARAMETER PollIntervalSeconds
    Seconds between polls. Set 0 to run once and exit. Default: 10

.PARAMETER RunOnce
    Run a single poll and exit immediately.

.PARAMETER RapidScadaBearerToken
    Optional bearer token for Rapid SCADA API auth (Authorization: Bearer <token>).

.PARAMETER RapidScadaUsername
    Optional username for Rapid SCADA Basic auth.

.PARAMETER RapidScadaPassword
    Optional password for Rapid SCADA Basic auth.

.EXAMPLE
    # One-shot with explicit channel mapping
    $env:SMARTGRID_API_KEY = "smartgrid-dev-key"
    .\scripts\pull_rapidscada_to_api.ps1 -RunOnce

.EXAMPLE
    # Continuous polling every 5 seconds
    $env:SMARTGRID_API_KEY = "smartgrid-dev-key"
    .\scripts\pull_rapidscada_to_api.ps1 -PollIntervalSeconds 5
#>

param(
    [string]$RapidScadaUrl       = "http://localhost:10008",
    [string]$SmartGridApiUrl     = "http://127.0.0.1:8000/v1/scada/ingest/tags",
    [string]$AgentId             = "1",
    [double]$CriticalityWeight   = 1.0,
    [double]$NominalVoltage      = 230.0,
    [double]$NominalFrequency    = 50.0,
    [double]$NominalCurrent      = 100.0,
    [double]$NominalPower        = 23000.0,   # W  (V * I at nominal)
    [int]   $PollIntervalSeconds = 10,
    [switch]$RunOnce,
    [string]$RapidScadaBearerToken = "",
    [string]$RapidScadaUsername = "admin",
    [string]$RapidScadaPassword = "scada"
)

$ErrorActionPreference = "Stop"

$script:RapidScadaApiTokenCached = $null
$script:RapidScadaWebSession = $null

if (-not $env:SMARTGRID_API_KEY) {
    throw 'Set SMARTGRID_API_KEY before running.  e.g.  $env:SMARTGRID_API_KEY = "smartgrid-dev-key"'
}

# ---------------------------------------------------------------------------
#  Channel map: Rapid SCADA channel number -> SmartGrid tag name
#  Edit these numbers to match channels you created in Rapid SCADA's Cnl table.
#  Default numbers are the Rapid SCADA demo project channel IDs.
# ---------------------------------------------------------------------------
$ChannelMap = [ordered]@{
    101 = "voltage"        # Phase voltage (V)
    102 = "frequency"      # Grid frequency (Hz)
    103 = "current"        # Line current (A)
    104 = "power"          # Active power (W)
    105 = "response_time"  # Agent response time (ms)
    201 = "latency"        # Comm latency (ms)
    202 = "packet_loss"    # Packet loss ratio (0-1)
    203 = "integrity"      # Comm integrity (0-1)
    204 = "comm_freq"      # Communication frequency (Hz)
}

# Nominal values for normalisation (observed / nominal = normalised score)
$Nominals = @{
    voltage       = $NominalVoltage
    frequency     = $NominalFrequency
    current       = $NominalCurrent
    power         = $NominalPower
    response_time = 50.0     # ms
    latency       = 20.0     # ms
    packet_loss   = 0.02     # ratio
    integrity     = 1.0      # ratio (higher = better, so we invert below)
    comm_freq     = 60.0     # Hz
}

function Get-RapidScadaChannels {
    $cnlList = ($ChannelMap.Keys -join ",")
    $uri     = "$RapidScadaUrl/Api/Main/GetCurData?cnlNums=$cnlList"

    $headers = @{}
    $useWebSession = $false

    if ($RapidScadaBearerToken) {
        $headers["Authorization"] = "Bearer $RapidScadaBearerToken"
    } elseif ($script:RapidScadaApiTokenCached) {
        $headers["Authorization"] = "Bearer $script:RapidScadaApiTokenCached"
    } elseif ($script:RapidScadaWebSession) {
        $useWebSession = $true
    } elseif ($RapidScadaUsername -and $RapidScadaPassword) {
        $loginUri = "$RapidScadaUrl/Api/Auth/Login"
        $loginBody = @{
            username = $RapidScadaUsername
            password = $RapidScadaPassword
        } | ConvertTo-Json

        try {
            $loginSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
            $loginRaw = Invoke-WebRequest -Uri $loginUri -Method Post -ContentType "application/json" -Body $loginBody -WebSession $loginSession -TimeoutSec 8 -UseBasicParsing
            $loginResp = $loginRaw.Content | ConvertFrom-Json
            $loginOk = $false
            if ($null -ne $loginResp.ok) { $loginOk = [bool]$loginResp.ok }

            if ($loginOk) {
                $candidateToken = $null
                if ($loginResp.token) { $candidateToken = [string]$loginResp.token }
                elseif ($loginResp.access_token) { $candidateToken = [string]$loginResp.access_token }
                elseif ($loginResp.accessToken) { $candidateToken = [string]$loginResp.accessToken }
                elseif ($loginResp.data -and $loginResp.data.token) { $candidateToken = [string]$loginResp.data.token }
                elseif ($loginResp.data -and $loginResp.data.access_token) { $candidateToken = [string]$loginResp.data.access_token }
                elseif ($loginResp.data -and $loginResp.data.accessToken) { $candidateToken = [string]$loginResp.data.accessToken }

                if ($candidateToken) {
                    $script:RapidScadaApiTokenCached = $candidateToken
                    $headers["Authorization"] = "Bearer $script:RapidScadaApiTokenCached"
                } else {
                    # Some Rapid SCADA builds authenticate via auth cookie instead of bearer token.
                    $script:RapidScadaWebSession = $loginSession
                    $useWebSession = $true
                }
            } elseif ($loginResp.msg) {
                Write-Warning "Rapid SCADA API login failed: $($loginResp.msg)"
            }
        }
        catch {
            Write-Warning "Rapid SCADA API login request failed: $($_.Exception.Message)"
        }

        if ($headers.Count -eq 0) {
            $pair = "{0}:{1}" -f $RapidScadaUsername, $RapidScadaPassword
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($pair)
            $basic = [Convert]::ToBase64String($bytes)
            $headers["Authorization"] = "Basic $basic"
        }
    }

    try {
        if ($useWebSession -and $script:RapidScadaWebSession) {
            $resp = Invoke-RestMethod -Uri $uri -Method Get -WebSession $script:RapidScadaWebSession -TimeoutSec 5
        } elseif ($headers.Count -gt 0) {
            $resp = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers -TimeoutSec 5
        } else {
            $resp = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 5
        }
        return $resp
    }
    catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 401 -and $script:RapidScadaApiTokenCached) {
            $script:RapidScadaApiTokenCached = $null
        }
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 401 -and $script:RapidScadaWebSession) {
            $script:RapidScadaWebSession = $null
        }
        Write-Warning "Could not reach Rapid SCADA at $uri - $($_.Exception.Message)"
        return $null
    }
}

function Convert-ChannelsToTags ($rapidResp) {
    # Rapid SCADA v6 response shape:
    # { Ok: true, Msg: "", Data: { CurData: [ { D: { Val: 230.5, Stat: 1 }, Stamp: "..." }, ... ] } }
    # Channel order in CurData matches the order of cnlNums we sent.

    $tags = @{}

    $respOk = $false
    if ($rapidResp) {
        if ($null -ne $rapidResp.Ok) { $respOk = [bool]$rapidResp.Ok }
        elseif ($null -ne $rapidResp.ok) { $respOk = [bool]$rapidResp.ok }
    }

    if (-not $rapidResp -or -not $respOk) {
        Write-Warning "Rapid SCADA returned an error or empty response; using fallback nominal values."
        foreach ($tagName in $Nominals.Keys) {
            $tags[$tagName] = 1.0   # normalised nominal
        }
        return $tags
    }

    $entries = @($ChannelMap.GetEnumerator())
    $keys = @($entries | ForEach-Object { [int]$_.Key })

    # Build channel -> raw value map from supported response shapes:
    # 1) { Ok/ok, Data/data: { CurData/curData: [ { D: { Val } } ... ] } } (ordered by request)
    # 2) { ok, data: [ { cnlNum, val, stat } ... ] }
    $rawByChannel = @{}

    $container = $null
    if ($null -ne $rapidResp.Data) { $container = $rapidResp.Data }
    elseif ($null -ne $rapidResp.data) { $container = $rapidResp.data }

    if ($container -is [System.Array]) {
        foreach ($row in $container) {
            if ($null -ne $row.cnlNum -and $null -ne $row.val) {
                $rawByChannel[[int]$row.cnlNum] = [double]$row.val
            }
        }
    } else {
        $curData = $null
        if ($container -and $null -ne $container.CurData) { $curData = $container.CurData }
        elseif ($container -and $null -ne $container.curData) { $curData = $container.curData }

        if ($curData) {
            for ($idx = 0; $idx -lt $keys.Count; $idx++) {
                if ($idx -ge $curData.Count) { break }
                $rawVal = $curData[$idx].D.Val
                if ($null -ne $rawVal) {
                    $rawByChannel[[int]$keys[$idx]] = [double]$rawVal
                }
            }
        }
    }

    for ($i = 0; $i -lt $entries.Count; $i++) {
        $cnl     = [int]$entries[$i].Key
        $tagName = [string]$entries[$i].Value
        $val     = 1.0   # default normalised

        if (-not $tagName) {
            continue
        }

        if ($rawByChannel.ContainsKey($cnl)) {
            $rawVal  = $rawByChannel[$cnl]
            $nominal = $Nominals[$tagName]

            if ($nominal -and $nominal -ne 0) {
                if ($tagName -eq "integrity") {
                    # integrity close to 1 is good; invert so deviation shows risk
                    $val = [math]::Round($rawVal / $nominal, 4)
                } elseif ($tagName -eq "packet_loss") {
                    # treat as direct ratio already in [0,1]
                    $val = [math]::Round($rawVal, 4)
                } else {
                    $val = [math]::Round($rawVal / $nominal, 4)
                }
            }
        }

        $tags[$tagName] = $val
    }

    return $tags
}

function Send-TagsToSmartGrid ($tags) {
    $payload = @{
        agent_id           = $AgentId
        tags               = $tags
        criticality_weight = $CriticalityWeight
        score_threshold    = 1.0
    } | ConvertTo-Json -Depth 6

    $headers = @{
        "X-API-Key"    = $env:SMARTGRID_API_KEY
        "Content-Type" = "application/json"
    }

    try {
        $result = Invoke-RestMethod -Method Post -Uri $SmartGridApiUrl -Headers $headers -Body $payload -TimeoutSec 10
        return $result
    }
    catch {
        Write-Warning "SmartGrid API error: $($_.Exception.Message)"
        return $null
    }
}

function Invoke-SinglePoll {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] Polling Rapid SCADA at $RapidScadaUrl ..." -ForegroundColor Cyan

    $rapidResp = Get-RapidScadaChannels
    $tags      = Convert-ChannelsToTags $rapidResp

    Write-Host "  Tags -> " -NoNewline
    $tags.GetEnumerator() | ForEach-Object { Write-Host "$($_.Key)=$($_.Value)  " -NoNewline }
    Write-Host ""

    $result = Send-TagsToSmartGrid $tags

    if ($result) {
        # Current API shape for /v1/scada/ingest/tags:
        # {
        #   normalized_request: {...},
        #   result: {
        #     deviation_score, anomaly_flag, risk_score, decision, severity,
        #     xai: { physical, cyber, decision },
        #     ledger: { anchored, event_id, tx_id, chain_hash, ... }
        #   }
        # }
        # Backward compatibility: if direct score endpoint is used, fields may be top-level.
        $scored = if ($result.result) { $result.result } else { $result }

        $flagVal = 0
        if ($null -ne $scored.anomaly_flag) {
            $flagVal = [int]$scored.anomaly_flag
        }

        $scoreVal = 0.0
        if ($null -ne $scored.deviation_score) {
            $scoreVal = [double]$scored.deviation_score
        } elseif ($null -ne $scored.risk_score) {
            $scoreVal = [double]$scored.risk_score
        }

        $anomaly = if ($flagVal -eq 1) { "ANOMALY DETECTED" } else { "normal" }
        $score   = [math]::Round($scoreVal, 4)
        $color   = if ($flagVal -eq 1) { "Red" } else { "Green" }
        $decision = if ($scored.decision) { $scored.decision } else { "N/A" }
        $severity = if ($scored.severity) { $scored.severity } else { "N/A" }

        Write-Host "  -> Agent $AgentId  score=$score  status=$anomaly  decision=$decision  severity=$severity" -ForegroundColor $color

        if ($scored.ledger -and $scored.ledger.anchored) {
            Write-Host "  -> On-chain anchor: event_id=$($scored.ledger.event_id) tx_id=$($scored.ledger.tx_id)" -ForegroundColor Yellow
        }

        if ($scored.xai -and $scored.xai.decision) {
            Write-Host "  -> XAI: $($scored.xai.decision)" -ForegroundColor DarkYellow
        }
    }
}

# ---------------------------------------------------------------------------
#  Main loop
# ---------------------------------------------------------------------------
Write-Host "=== Rapid SCADA -> SmartGrid Audit Bridge ===" -ForegroundColor White
Write-Host "  Rapid SCADA : $RapidScadaUrl" -ForegroundColor Gray
Write-Host "  SmartGrid   : $SmartGridApiUrl" -ForegroundColor Gray
Write-Host "  Agent ID    : $AgentId" -ForegroundColor Gray
Write-Host "  Channel map : $($ChannelMap.Count) channels" -ForegroundColor Gray
Write-Host ""

if ($RunOnce -or $PollIntervalSeconds -le 0) {
    Invoke-SinglePoll
}
else {
    Write-Host "Polling every $PollIntervalSeconds s  (Ctrl-C to stop)" -ForegroundColor DarkCyan
    while ($true) {
        Invoke-SinglePoll
        Start-Sleep -Seconds $PollIntervalSeconds
    }
}
