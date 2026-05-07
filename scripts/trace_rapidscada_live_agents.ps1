<#
.SYNOPSIS
  Query Rapid SCADA and report which of the 100 SmartGrid agents are truly live.

.DESCRIPTION
  Uses the same channel mapping as the bridge:
    - Generators G01-G20: voltage, current
    - Substations S21-S50: load, latency
    - PMUs P51-P75: voltage, frequency
    - Breakers B76-B100: status

  An agent is considered live only if all expected mapped channels have stat > 0.
#>

param(
    [string]$RapidScadaUrl = "http://127.0.0.1:10109",
    [string]$Username = "admin",
    [string]$Password = "scada"
)

$ErrorActionPreference = "Stop"

function Get-AgentProbeSpecs {
    $specs = @()

    for ($seq = 1; $seq -le 20; $seq++) {
        $base = 101 + (($seq - 1) * 3)
        $specs += [pscustomobject]@{
            AgentId  = "GEN-{0:d2}" -f $seq
            Type     = "Generator"
            Channels = @($base, ($base + 1))
        }
    }

    for ($seq = 21; $seq -le 50; $seq++) {
        $base = 201 + (($seq - 21) * 3)
        $specs += [pscustomobject]@{
            AgentId  = "SUB-{0:d2}" -f $seq
            Type     = "Substation"
            Channels = @($base, ($base + 1))
        }
    }

    for ($seq = 51; $seq -le 75; $seq++) {
        $base = 301 + (($seq - 51) * 3)
        $specs += [pscustomobject]@{
            AgentId  = "PMU-{0:d2}" -f $seq
            Type     = "PMU"
            Channels = @($base, ($base + 1))
        }
    }

    for ($seq = 76; $seq -le 100; $seq++) {
        $base = 401 + (($seq - 76) * 3)
        $specs += [pscustomobject]@{
            AgentId  = "BRK-{0:d2}" -f $seq
            Type     = "Breaker"
            Channels = @($base)
        }
    }

    return $specs
}

function Get-RapidScadaCurData {
    param(
        [string]$BaseUrl,
        [string]$CnlCsv,
        [string]$User,
        [string]$Pass
    )

    $uri = "$BaseUrl/Api/Main/GetCurData?cnlNums=$CnlCsv"

    try {
        return Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 12
    }
    catch {
        # Fall through to authenticated attempts.
    }

    $headers = @{}
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $loginBody = @{ username = $User; password = $Pass } | ConvertTo-Json

    try {
        $loginRaw = Invoke-WebRequest -Uri "$BaseUrl/Api/Auth/Login" -Method Post -ContentType "application/json" -Body $loginBody -WebSession $session -TimeoutSec 8 -UseBasicParsing
        $loginResp = $loginRaw.Content | ConvertFrom-Json
        if ($loginResp.ok) {
            $token = $null
            if ($loginResp.token) { $token = [string]$loginResp.token }
            elseif ($loginResp.access_token) { $token = [string]$loginResp.access_token }
            elseif ($loginResp.accessToken) { $token = [string]$loginResp.accessToken }
            elseif ($loginResp.data -and $loginResp.data.token) { $token = [string]$loginResp.data.token }
            elseif ($loginResp.data -and $loginResp.data.access_token) { $token = [string]$loginResp.data.access_token }
            elseif ($loginResp.data -and $loginResp.data.accessToken) { $token = [string]$loginResp.data.accessToken }

            if ($token) {
                $headers["Authorization"] = "Bearer $token"
            } else {
                return Invoke-RestMethod -Uri $uri -Method Get -WebSession $session -TimeoutSec 12
            }
        }
    }
    catch {
        # Continue to basic fallback.
    }

    if ($headers.Count -eq 0) {
        $pair = "{0}:{1}" -f $User, $Pass
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($pair)
        $basic = [Convert]::ToBase64String($bytes)
        $headers["Authorization"] = "Basic $basic"
    }

    return Invoke-RestMethod -Uri $uri -Method Get -Headers $headers -TimeoutSec 12
}

$specs = Get-AgentProbeSpecs
$channelNums = $specs.Channels | ForEach-Object { $_ } | Sort-Object -Unique
$curData = Get-RapidScadaCurData -BaseUrl $RapidScadaUrl -CnlCsv ($channelNums -join ",") -User $Username -Pass $Password

if (-not $curData.ok) {
    throw "Rapid SCADA GetCurData failed."
}

$channelMap = @{}
foreach ($row in $curData.data) {
    $channelMap[[int]$row.cnlNum] = [pscustomobject]@{
        Value = [double]$row.val
        Stat  = [int]$row.stat
    }
}

$results = foreach ($spec in $specs) {
    $rows = foreach ($cnlNum in $spec.Channels) { $channelMap[$cnlNum] }
    $present = @($rows | Where-Object { $_ -and $_.Stat -gt 0 }).Count
    [pscustomobject]@{
        AgentId  = $spec.AgentId
        Type     = $spec.Type
        Live     = ($present -eq $spec.Channels.Count)
        Present  = $present
        Expected = $spec.Channels.Count
        Channels = (($spec.Channels | ForEach-Object {
            $entry = $channelMap[$_]
            if ($entry) {
                "{0}:{1}" -f $entry.Stat, [math]::Round($entry.Value, 4)
            }
            else {
                "missing"
            }
        }) -join ", ")
    }
}

$liveAgents = @($results | Where-Object Live)
$fallbackAgents = @($results | Where-Object { -not $_.Live })

Write-Host "Rapid SCADA live-agent trace" -ForegroundColor Cyan
Write-Host "  URL           : $RapidScadaUrl" -ForegroundColor Gray
Write-Host "  Live agents   : $($liveAgents.Count)" -ForegroundColor Green
Write-Host "  Non-live      : $($fallbackAgents.Count)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Live agents:" -ForegroundColor Green
$liveAgents | Format-Table AgentId, Type, Present, Expected, Channels -AutoSize

if ($fallbackAgents.Count -gt 0) {
    Write-Host ""
    Write-Host "First 20 non-live agents:" -ForegroundColor Yellow
    $fallbackAgents | Select-Object -First 20 | Format-Table AgentId, Type, Present, Expected, Channels -AutoSize
}
