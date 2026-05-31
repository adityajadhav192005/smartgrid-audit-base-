<#
.SYNOPSIS
    Polls Rapid SCADA's REST API and forwards all 100 agent channel values
    to the SmartGrid FastAPI audit endpoint as normalised SCADA tags.

.DESCRIPTION
    Rapid SCADA exposes current channel data at:
        GET http://localhost:10109/Api/Main/GetCurData?cnlNums=<comma-list>

    This bridge:
        1. Authenticates with Rapid SCADA (cookie-based or bearer)
        2. Fetches current channel values for ALL 100 agents in one API call
        3. Maps channel numbers to per-agent SmartGrid tag schema
        4. POSTs the batch payload to the SmartGrid FastAPI ingest endpoint
        5. Optionally loops on an interval

    Channel layout (670 channels across Cnl.xml + Cnl_Cyber_Addon.xml):
        GEN  G01-G20  : phys 101-160 (Voltage,Current,AnomalyScore)  cyber 501-580 (4/agent: Lat,Pkt,Int,Com)
        SUB  S21-S50  : phys 201-290 (Load,Latency,AnomalyScore)     cyber 601-690 (3/agent: Pkt,Int,Com)
        PMU  P51-P75  : phys 301-375 (Voltage,Frequency,AnomalyScore) cyber 701-800 (4/agent: Lat,Pkt,Int,Com)
        BRK  B76-B100 : phys 401-475 (Status,FaultCount,AnomalyScore) cyber 801-900 (4/agent: Lat,Pkt,Int,Com)

.PARAMETER RapidScadaUrl
    Base URL of your Rapid SCADA web app. Default: http://127.0.0.1:10109

.PARAMETER SmartGridApiUrl
    SmartGrid FastAPI ingest endpoint. Default: http://127.0.0.1:8000/v1/scada/ingest/tags/batch

.PARAMETER PollIntervalSeconds
    Seconds between polls. Default: 10

.PARAMETER RunOnce
    Run a single poll and exit immediately.

.EXAMPLE
    $env:SMARTGRID_API_KEY = "smartgrid-dev-key"
    .\scripts\pull_rapidscada_to_api.ps1 -RunOnce

.EXAMPLE
    $env:SMARTGRID_API_KEY = "smartgrid-dev-key"
    .\scripts\pull_rapidscada_to_api.ps1 -PollIntervalSeconds 5
#>

param(
    [string]$RapidScadaUrl       = "http://127.0.0.1:10109",
    [string]$SmartGridApiUrl     = "http://127.0.0.1:8000/v1/scada/ingest/tags/batch",
    [string]$AgentId             = "GEN-01",
    [double]$CriticalityWeight   = 1.0,
    [double]$NominalVoltage      = 230.0,
    [double]$NominalFrequency    = 50.0,
    [double]$NominalCurrent      = 100.0,
    [double]$NominalPower        = 23000.0,
    [int]   $PollIntervalSeconds = 10,
    [switch]$RunOnce,
    [string]$RapidScadaBearerToken = "",
    [string]$RapidScadaUsername = "admin",
    [string]$RapidScadaPassword = "scada"
)

$ErrorActionPreference = "Stop"

$script:RapidScadaApiTokenCached = $null
$script:RapidScadaWebSession = $null
$script:_scadaRetried = $false

if (-not $env:SMARTGRID_API_KEY) {
    throw 'Set SMARTGRID_API_KEY before running.  e.g.  $env:SMARTGRID_API_KEY = "smartgrid-dev-key"'
}

# ---------------------------------------------------------------------------
#  100-agent channel map
#  Physical channels from Cnl.xml, Cyber channels from Cnl_Cyber_Addon.xml
# ---------------------------------------------------------------------------

# Build the full agent table: agent_id, type, criticality, physical channels, cyber channels
$AllAgents = @()

# GEN-01 to GEN-20: phys channels 101-160 (3 per agent), cyber 501-580 (4 per agent)
for ($i = 1; $i -le 20; $i++) {
    $agentId = "GEN-{0:D2}" -f $i
    $physBase = 101 + ($i - 1) * 3   # 101,104,107,...,158
    $cyberBase = 501 + ($i - 1) * 4  # 501,505,509,...,577
    $AllAgents += @{
        id          = $agentId
        type        = "GEN"
        weight      = 1.0
        physChannels = @(
            @{ cnl = $physBase;     tag = "voltage" }
            @{ cnl = $physBase + 1; tag = "current" }
            @{ cnl = $physBase + 2; tag = "anomaly_raw" }
        )
        cyberChannels = @(
            @{ cnl = $cyberBase;     tag = "latency" }
            @{ cnl = $cyberBase + 1; tag = "packet_loss" }
            @{ cnl = $cyberBase + 2; tag = "integrity" }
            @{ cnl = $cyberBase + 3; tag = "comm_freq" }
        )
    }
}

# SUB-21 to SUB-50: phys channels 201-290 (3 per agent)
# SUB cyber: 601-690 (3 per agent: PacketLoss, Integrity, CommFreq -- NO Latency)
for ($i = 1; $i -le 30; $i++) {
    $agentNum = 20 + $i
    $agentId = "SUB-{0:D2}" -f $agentNum
    $physBase = 201 + ($i - 1) * 3   # 201,204,207,...,288
    $cyberBase = 601 + ($i - 1) * 3  # 601,604,607,...,688
    $AllAgents += @{
        id          = $agentId
        type        = "SUB"
        weight      = 0.8
        physChannels = @(
            @{ cnl = $physBase;     tag = "voltage" }
            @{ cnl = $physBase + 1; tag = "current" }
            @{ cnl = $physBase + 2; tag = "anomaly_raw" }
        )
        cyberChannels = @(
            @{ cnl = $cyberBase;     tag = "packet_loss" }
            @{ cnl = $cyberBase + 1; tag = "integrity" }
            @{ cnl = $cyberBase + 2; tag = "comm_freq" }
        )
    }
}

# PMU-51 to PMU-75: phys channels 301-375 (3 per agent), cyber 701-800 (4 per agent)
for ($i = 1; $i -le 25; $i++) {
    $agentNum = 50 + $i
    $agentId = "PMU-{0:D2}" -f $agentNum
    $physBase = 301 + ($i - 1) * 3   # 301,304,307,...,373
    $cyberBase = 701 + ($i - 1) * 4  # 701,705,709,...,797
    $AllAgents += @{
        id          = $agentId
        type        = "PMU"
        weight      = 0.6
        physChannels = @(
            @{ cnl = $physBase;     tag = "voltage" }
            @{ cnl = $physBase + 1; tag = "frequency" }
            @{ cnl = $physBase + 2; tag = "anomaly_raw" }
        )
        cyberChannels = @(
            @{ cnl = $cyberBase;     tag = "latency" }
            @{ cnl = $cyberBase + 1; tag = "packet_loss" }
            @{ cnl = $cyberBase + 2; tag = "integrity" }
            @{ cnl = $cyberBase + 3; tag = "comm_freq" }
        )
    }
}

# BRK-76 to BRK-100: phys channels 401-475 (3 per agent), cyber 801-900 (4 per agent)
for ($i = 1; $i -le 25; $i++) {
    $agentNum = 75 + $i
    $agentId = "BRK-{0:D2}" -f $agentNum
    $physBase = 401 + ($i - 1) * 3   # 401,404,407,...,473
    $cyberBase = 801 + ($i - 1) * 4  # 801,805,809,...,897
    $AllAgents += @{
        id          = $agentId
        type        = "BRK"
        weight      = 0.7
        physChannels = @(
            @{ cnl = $physBase;     tag = "voltage" }
            @{ cnl = $physBase + 1; tag = "current" }
            @{ cnl = $physBase + 2; tag = "anomaly_raw" }
        )
        cyberChannels = @(
            @{ cnl = $cyberBase;     tag = "latency" }
            @{ cnl = $cyberBase + 1; tag = "packet_loss" }
            @{ cnl = $cyberBase + 2; tag = "integrity" }
            @{ cnl = $cyberBase + 3; tag = "comm_freq" }
        )
    }
}

# Collect ALL channel numbers for a single SCADA API call
$allCnlNums = @()
foreach ($agent in $AllAgents) {
    foreach ($ch in $agent.physChannels) { $allCnlNums += $ch.cnl }
    foreach ($ch in $agent.cyberChannels) { $allCnlNums += $ch.cnl }
}
$allCnlNums = $allCnlNums | Sort-Object -Unique

# Nominal values for normalisation (raw / nominal = normalised ratio)
$Nominals = @{
    voltage       = $NominalVoltage
    current       = $NominalCurrent
    frequency     = $NominalFrequency
    power         = $NominalPower
    response_time = 50.0
    latency       = 20.0
    packet_loss   = 0.02
    integrity     = 1.0
    comm_freq     = 60.0
    anomaly_raw   = 1.0
}

# ---------------------------------------------------------------------------
#  SCADA Authentication & Data Fetch
# ---------------------------------------------------------------------------

function Ensure-ScadaAuth {
    if ($script:RapidScadaWebSession -or $script:RapidScadaApiTokenCached) {
        return
    }

    if ($RapidScadaBearerToken) {
        $script:RapidScadaApiTokenCached = $RapidScadaBearerToken
        return
    }

    if (-not $RapidScadaUsername -or -not $RapidScadaPassword) { return }

    $loginUri = "$RapidScadaUrl/Api/Auth/Login"
    $loginBody = @{ username = $RapidScadaUsername; password = $RapidScadaPassword } | ConvertTo-Json

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
            elseif ($loginResp.data -and $loginResp.data.token) { $candidateToken = [string]$loginResp.data.token }

            if ($candidateToken) {
                $script:RapidScadaApiTokenCached = $candidateToken
            } else {
                $script:RapidScadaWebSession = $loginSession
            }
        } else {
            Write-Warning "Rapid SCADA login failed: $($loginResp.msg)"
        }
    }
    catch {
        Write-Warning "Rapid SCADA login error: $($_.Exception.Message)"
    }
}

function Get-AllScadaChannels {
    Ensure-ScadaAuth

    $cnlList = ($allCnlNums -join ",")
    $uri = "$RapidScadaUrl/Api/Main/GetCurData?cnlNums=$cnlList"

    try {
        if ($script:RapidScadaWebSession) {
            $resp = Invoke-RestMethod -Uri $uri -Method Get -WebSession $script:RapidScadaWebSession -TimeoutSec 10
        } elseif ($script:RapidScadaApiTokenCached) {
            $headers = @{ "Authorization" = "Bearer $script:RapidScadaApiTokenCached" }
            $resp = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers -TimeoutSec 10
        } else {
            $resp = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 10
        }
        return $resp
    }
    catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 401) {
            $script:RapidScadaApiTokenCached = $null
            $script:RapidScadaWebSession = $null
        }
        Write-Warning "Could not reach Rapid SCADA at $uri - $($_.Exception.Message)"
        return $null
    }
}

function Parse-ScadaResponse ($rapidResp) {
    # Returns hashtable: cnlNum -> raw value
    $rawByChannel = @{}

    $respOk = $false
    if ($rapidResp) {
        if ($null -ne $rapidResp.ok) { $respOk = [bool]$rapidResp.ok }
        elseif ($null -ne $rapidResp.Ok) { $respOk = [bool]$rapidResp.Ok }
    }
    if (-not $respOk) { return $rawByChannel }

    $container = $null
    if ($null -ne $rapidResp.data) { $container = $rapidResp.data }
    elseif ($null -ne $rapidResp.Data) { $container = $rapidResp.Data }

    if ($container -is [System.Array]) {
        foreach ($row in $container) {
            if ($null -ne $row.cnlNum -and $null -ne $row.val) {
                $rawByChannel[[int]$row.cnlNum] = [double]$row.val
            }
        }
    }

    return $rawByChannel
}

function Build-AgentRecords ($rawByChannel) {
    $records = @()
    $statsNormal = 0
    $statsAnomaly = 0
    $statsSkipped = 0

    foreach ($agent in $AllAgents) {
        $tags = @{}
        $hasData = $false

        # Physical channels
        foreach ($ch in $agent.physChannels) {
            $tagName = $ch.tag
            if ($tagName -eq "anomaly_raw") { continue }  # skip raw anomaly score channel
            if ($rawByChannel.ContainsKey($ch.cnl)) {
                $rawVal = $rawByChannel[$ch.cnl]
                $nominal = $Nominals[$tagName]
                if ($nominal -and $nominal -ne 0) {
                    $tags[$tagName] = [math]::Round($rawVal / $nominal, 4)
                } else {
                    $tags[$tagName] = [math]::Round($rawVal, 4)
                }
                $hasData = $true
            }
        }

        # Cyber channels
        foreach ($ch in $agent.cyberChannels) {
            $tagName = $ch.tag
            if ($rawByChannel.ContainsKey($ch.cnl)) {
                $rawVal = $rawByChannel[$ch.cnl]
                $nominal = $Nominals[$tagName]
                if ($nominal -and $nominal -ne 0) {
                    if ($tagName -eq "packet_loss") {
                        $tags[$tagName] = [math]::Round($rawVal, 4)
                    } else {
                        $tags[$tagName] = [math]::Round($rawVal / $nominal, 4)
                    }
                } else {
                    $tags[$tagName] = [math]::Round($rawVal, 4)
                }
                $hasData = $true
            }
        }

        if (-not $hasData) {
            $statsSkipped++
            continue
        }

        # Fill missing tags with sensible defaults
        # SUB agents have no latency SCADA channel; filling with 1.0 (full nominal = 20ms)
        # caused the LSTM network branch to interpret the constant high value as DoS.
        # Fix: fill latency with a realistic ratio (~0.15 = 3ms) plus small jitter.
        $defaultFills = @{
            voltage   = 1.0
            current   = 1.0
            frequency = 1.0
            latency   = 0.15 + (Get-Random -Minimum -20 -Maximum 20) / 1000.0   # 0.13–0.17
            packet_loss = 0.003
            integrity = 1.0
            comm_freq = 1.0
        }
        foreach ($tagName in @("voltage","current","frequency","latency","packet_loss","integrity","comm_freq")) {
            if (-not $tags.ContainsKey($tagName)) {
                $tags[$tagName] = $defaultFills[$tagName]
            }
        }

        $scoreThreshold = 3.0
        if ($env:SMARTGRID_SCADA_SCORE_THRESHOLD) {
            $scoreThreshold = [double]$env:SMARTGRID_SCADA_SCORE_THRESHOLD
        }

        $records += @{
            agent_id           = $agent.id
            tags               = $tags
            criticality_weight = $agent.weight
            score_threshold    = $scoreThreshold
        }
    }

    return @{
        records = $records
        skipped = $statsSkipped
    }
}

function Send-BatchToSmartGrid ($records) {
    $payload = @{ records = $records } | ConvertTo-Json -Depth 6

    $headers = @{
        "X-API-Key"    = $env:SMARTGRID_API_KEY
        "Content-Type" = "application/json"
    }

    try {
        $result = Invoke-RestMethod -Method Post -Uri $SmartGridApiUrl -Headers $headers -Body $payload -TimeoutSec 30
        return $result
    }
    catch {
        Write-Warning "SmartGrid API error: $($_.Exception.Message)"
        return $null
    }
}

# ---------------------------------------------------------------------------
#  Single poll cycle
# ---------------------------------------------------------------------------

function Invoke-SinglePoll {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] Polling Rapid SCADA for $($AllAgents.Count) agents ..." -ForegroundColor Cyan

    $rapidResp = Get-AllScadaChannels

    # Retry once after 3s if first attempt fails (startup race condition)
    if (-not $rapidResp) {
        if (-not $script:_scadaRetried) {
            Write-Host "  Retrying SCADA connection in 3s..." -ForegroundColor Yellow
            Start-Sleep -Seconds 3
            $script:RapidScadaApiTokenCached = $null
            $script:RapidScadaWebSession = $null
            $rapidResp = Get-AllScadaChannels
            $script:_scadaRetried = $true
        }
    }

    $rawByChannel = Parse-ScadaResponse $rapidResp
    if ($rawByChannel.Count -eq 0) {
        Write-Warning "No channel data received from SCADA."
        return
    }

    $buildResult = Build-AgentRecords $rawByChannel
    $records = $buildResult.records
    $skipped = $buildResult.skipped

    Write-Host "  Channels read: $($rawByChannel.Count)  |  Agent records: $($records.Count)  |  Skipped: $skipped" -ForegroundColor Gray

    if ($records.Count -eq 0) {
        Write-Warning "No agent records to send."
        return
    }

    $result = Send-BatchToSmartGrid $records

    if ($result) {
        $resultList = @()
        if ($result.results) { $resultList = @($result.results) }

        $normalCount = 0
        $anomalyCount = 0
        $anomalyAgents = @()

        foreach ($r in $resultList) {
            $scored = if ($r.result) { $r.result } else { $r }
            $flag = 0
            if ($null -ne $scored.anomaly_flag) { $flag = [int]$scored.anomaly_flag }
            if ($flag -eq 1) {
                $anomalyCount++
                $aid = if ($scored.agent_id) { $scored.agent_id } else { "?" }
                $sc = 0.0
                if ($null -ne $scored.deviation_score) { $sc = [math]::Round([double]$scored.deviation_score, 3) }
                $dec = if ($scored.decision) { $scored.decision } else { "N/A" }
                $anomalyAgents += "$aid($sc,$dec)"
            } else {
                $normalCount++
            }
        }

        Write-Host "  Results: $($resultList.Count) agents  |  " -NoNewline
        Write-Host "NORMAL=$normalCount" -ForegroundColor Green -NoNewline
        Write-Host "  ANOMALY=$anomalyCount" -ForegroundColor $(if ($anomalyCount -gt 0) { "Red" } else { "Green" }) -NoNewline
        Write-Host ""

        if ($anomalyAgents.Count -gt 0) {
            $showMax = [math]::Min(10, $anomalyAgents.Count)
            $display = ($anomalyAgents[0..($showMax-1)] -join ", ")
            if ($anomalyAgents.Count -gt $showMax) { $display += " +$($anomalyAgents.Count - $showMax) more" }
            Write-Host "  Anomalies: $display" -ForegroundColor Red
        }

        # Show one sample agent for quick verification
        if ($resultList.Count -gt 0) {
            $sample = if ($resultList[0].result) { $resultList[0].result } else { $resultList[0] }
            $sAid = if ($sample.agent_id) { $sample.agent_id } else { $records[0].agent_id }
            $sScore = 0.0
            if ($null -ne $sample.deviation_score) { $sScore = [math]::Round([double]$sample.deviation_score, 4) }
            $sDec = if ($sample.decision) { $sample.decision } else { "N/A" }
            $sSev = if ($sample.severity) { $sample.severity } else { "N/A" }
            Write-Host "  Sample: $sAid  score=$sScore  decision=$sDec  severity=$sSev" -ForegroundColor DarkGray
        }
    }
}

# ---------------------------------------------------------------------------
#  Main
# ---------------------------------------------------------------------------
Write-Host "=== Rapid SCADA -> SmartGrid Audit Bridge (100 Agents) ===" -ForegroundColor White
Write-Host "  Rapid SCADA : $RapidScadaUrl" -ForegroundColor Gray
Write-Host "  SmartGrid   : $SmartGridApiUrl" -ForegroundColor Gray
Write-Host "  Agents      : $($AllAgents.Count) (GEN:20, SUB:30, PMU:25, BRK:25)" -ForegroundColor Gray
Write-Host "  Channels    : $($allCnlNums.Count) total" -ForegroundColor Gray
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
