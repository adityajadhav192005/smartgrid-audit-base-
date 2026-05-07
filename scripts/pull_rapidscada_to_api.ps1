<#
.SYNOPSIS
    Polls Rapid SCADA and forwards multi-agent channel values into SmartGrid FastAPI.

.DESCRIPTION
    Reads the Rapid SCADA demo channel layout by agent class:
      - Generators G01-G20: voltage, current
      - Substations S21-S50: load, latency
      - PMUs P51-P75: voltage, frequency
      - Breakers B76-B100: status

    The bridge converts the live channels into per-agent tag payloads and POSTs one
    ingest request per active agent to /v1/scada/ingest/tags.
#>

param(
    [string]$RapidScadaUrl         = "http://127.0.0.1:10109",
    [string]$SmartGridApiUrl       = "http://127.0.0.1:8000/v1/scada/ingest/tags/batch",
    [string]$AgentId               = "GEN-01",
    [double]$CriticalityWeight     = 1.0,
    [double]$NominalVoltage        = 230.0,
    [double]$NominalFrequency      = 50.0,
    [double]$NominalCurrent        = 100.0,
    [int]$PollIntervalSeconds      = 10,
    [switch]$RunOnce,
    [int]$EnableDemoAnomalies      = 1,
    [ValidateSet("Independent", "Auto", "Normal", "GeneratorFDI", "SubstationDoS", "PMUDesync", "BreakerTrip")]
    [string]$DemoAnomalyPhase      = "Independent",
    [ValidateSet("Realistic", "Balanced", "Demo")]
    [string]$IndependentRatePreset = "Realistic",
    [int]$AnomalyCycleSeconds      = 150,
    [double]$AnomalyIntensity      = 1.0,
    [ValidateRange(0.0, 1.0)]
    [double]$TargetAnomalyPressure = 0.40,
    [string]$RapidScadaBearerToken = "",
    [string]$RapidScadaUsername    = "admin",
    [string]$RapidScadaPassword    = "scada"
)

$ErrorActionPreference = "Stop"

if (-not $PSBoundParameters.ContainsKey('DemoAnomalyPhase') -and $env:SMARTGRID_SCADA_DEMO_ANOMALY_PHASE) {
    $DemoAnomalyPhase = [string]$env:SMARTGRID_SCADA_DEMO_ANOMALY_PHASE
}
if (-not $PSBoundParameters.ContainsKey('IndependentRatePreset') -and $env:SMARTGRID_SCADA_INDEPENDENT_RATE_PRESET) {
    $IndependentRatePreset = [string]$env:SMARTGRID_SCADA_INDEPENDENT_RATE_PRESET
}
if (-not $PSBoundParameters.ContainsKey('AnomalyCycleSeconds') -and $env:SMARTGRID_SCADA_ANOMALY_CYCLE_SECONDS) {
    $AnomalyCycleSeconds = [int]$env:SMARTGRID_SCADA_ANOMALY_CYCLE_SECONDS
}
if (-not $PSBoundParameters.ContainsKey('AnomalyIntensity') -and $env:SMARTGRID_SCADA_ANOMALY_INTENSITY) {
    $AnomalyIntensity = [double]$env:SMARTGRID_SCADA_ANOMALY_INTENSITY
}
if (-not $PSBoundParameters.ContainsKey('TargetAnomalyPressure') -and $env:SMARTGRID_SCADA_TARGET_ANOMALY_PRESSURE) {
    $TargetAnomalyPressure = [double]$env:SMARTGRID_SCADA_TARGET_ANOMALY_PRESSURE
}

$script:RapidScadaApiTokenCached = $null
$script:RapidScadaWebSession = $null
$script:ScadaDefaultsByType = @{
    Generator = @{
        voltage = 230.0
        frequency = 50.0
        current = 15.0
        power = 3.0
        response_time = 3.0
        latency = 3.0
        packet_loss = 0.001
        integrity = 1.0
        comm_freq = 50.0
        substation_load = 3.0
        breaker_status = 1.0
    }
    Substation = @{
        voltage = 230.0
        frequency = 50.0
        current = 12.0
        power = 180.0
        response_time = 4.0
        latency = 4.0
        packet_loss = 0.001
        integrity = 1.0
        comm_freq = 50.0
        substation_load = 180.0
        breaker_status = 1.0
    }
    PMU = @{
        voltage = 230.0
        frequency = 50.0
        current = 0.5
        power = 1.0
        response_time = 2.0
        latency = 2.0
        packet_loss = 0.001
        integrity = 1.0
        comm_freq = 50.0
        substation_load = 1.0
        breaker_status = 1.0
    }
    Breaker = @{
        voltage = 230.0
        frequency = 50.0
        current = 0.0
        power = 0.0
        response_time = 3.0
        latency = 3.0
        packet_loss = 0.001
        integrity = 1.0
        comm_freq = 50.0
        substation_load = 0.0
        breaker_status = 1.0
    }
}

if (-not $env:SMARTGRID_API_KEY) {
    throw 'Set SMARTGRID_API_KEY before running. e.g. $env:SMARTGRID_API_KEY = "smartgrid-dev-key"'
}

function Get-InferredLoadKw([double]$Voltage, [double]$Current) {
    if ($Voltage -le 0 -or $Current -le 0) {
        return 0.0
    }

    $powerFactor = 0.92
    return (($Voltage * $Current * $powerFactor) / 1000.0)
}

function Get-AgentSequence([string]$AgentId) {
    if ($AgentId -match '(\d{2,3})$') {
        return [int]$Matches[1]
    }
    return 0
}

function Get-DeterministicFraction([double]$Seed) {
    $raw = [math]::Sin(($Seed * 12.9898) + 78.233) * 43758.5453
    return ($raw - [math]::Floor($raw))
}

function Get-IndependentRateConfig {
    $preset = [string]$IndependentRatePreset
    switch ($preset) {
        "Demo" {
            return @{
                SeverityBase = 1.00
                SeverityRange = 0.85
                Generator = @{ Probability = 0.18; DurationSlots = 4; TypeCode = 11; Name = "GeneratorFDI" }
                Substation = @{ Probability = 0.15; DurationSlots = 5; TypeCode = 23; Name = "SubstationDoS" }
                PMU = @{ Probability = 0.17; DurationSlots = 4; TypeCode = 37; Name = "PMUDesync" }
                Breaker = @{ Probability = 0.12; DurationSlots = 4; TypeCode = 47; Name = "BreakerTrip" }
            }
        }
        "Balanced" {
            return @{
                SeverityBase = 0.80
                SeverityRange = 0.70
                Generator = @{ Probability = 0.10; DurationSlots = 3; TypeCode = 11; Name = "GeneratorFDI" }
                Substation = @{ Probability = 0.08; DurationSlots = 4; TypeCode = 23; Name = "SubstationDoS" }
                PMU = @{ Probability = 0.09; DurationSlots = 3; TypeCode = 37; Name = "PMUDesync" }
                Breaker = @{ Probability = 0.07; DurationSlots = 3; TypeCode = 47; Name = "BreakerTrip" }
            }
        }
        default {
            return @{
                SeverityBase = 0.65
                SeverityRange = 0.45
                Generator = @{ Probability = 0.030; DurationSlots = 2; TypeCode = 11; Name = "GeneratorFDI" }
                Substation = @{ Probability = 0.022; DurationSlots = 3; TypeCode = 23; Name = "SubstationDoS" }
                PMU = @{ Probability = 0.028; DurationSlots = 2; TypeCode = 37; Name = "PMUDesync" }
                Breaker = @{ Probability = 0.018; DurationSlots = 2; TypeCode = 47; Name = "BreakerTrip" }
            }
        }
    }
}

function Get-DemoAnomalyState {
    if ($EnableDemoAnomalies -le 0) {
        return [pscustomobject]@{
            Name = "Normal"
            Active = $false
        }
    }

    switch ($DemoAnomalyPhase) {
        "Independent" {
            return [pscustomobject]@{
                Name = "Independent"
                Active = $true
            }
        }
        "Normal" {
            return [pscustomobject]@{
                Name = "Normal"
                Active = $false
            }
        }
        "GeneratorFDI" {
            return [pscustomobject]@{
                Name = "GeneratorFDI"
                Active = $true
            }
        }
        "SubstationDoS" {
            return [pscustomobject]@{
                Name = "SubstationDoS"
                Active = $true
            }
        }
        "PMUDesync" {
            return [pscustomobject]@{
                Name = "PMUDesync"
                Active = $true
            }
        }
        "BreakerTrip" {
            return [pscustomobject]@{
                Name = "BreakerTrip"
                Active = $true
            }
        }
    }

    $phases = @("Normal", "GeneratorFDI", "SubstationDoS", "PMUDesync", "BreakerTrip")
    $cycleSec = [math]::Max(50, [int]$AnomalyCycleSeconds)
    $elapsed = [int][math]::Floor((Get-Date).ToUniversalTime().Subtract([datetime]'2026-01-01T00:00:00Z').TotalSeconds)
    $slotSec = [math]::Max(10, [int]($cycleSec / $phases.Count))
    $slot = [int](($elapsed % $cycleSec) / $slotSec)
    if ($slot -ge $phases.Count) {
        $slot = $phases.Count - 1
    }

    $name = [string]$phases[$slot]
    return [pscustomobject]@{
        Name = $name
        Active = ($name -ne "Normal")
    }
}

function Get-IndependentScenarioState {
    param(
        $Spec
    )

    $rateConfig = Get-IndependentRateConfig
    $typeConfigs = @{
        Generator = $rateConfig.Generator
        Substation = $rateConfig.Substation
        PMU = $rateConfig.PMU
        Breaker = $rateConfig.Breaker
    }

    if (-not $typeConfigs.ContainsKey($Spec.Type)) {
        return [pscustomobject]@{
            Name = "Normal"
            Active = $false
            Intensity = 0.0
        }
    }

    $config = $typeConfigs[$Spec.Type]
    $slotSec = [math]::Max(20, [int]($AnomalyCycleSeconds / 6))
    $elapsed = [int][math]::Floor((Get-Date).ToUniversalTime().Subtract([datetime]'2026-01-01T00:00:00Z').TotalSeconds)
    $currentSlot = [int][math]::Floor($elapsed / $slotSec)
    $seq = Get-AgentSequence -AgentId $Spec.AgentId

    if ([double]$TargetAnomalyPressure -gt 0.0) {
        $targetCount = [math]::Min(100, [math]::Max(0, [int][math]::Round([double]$TargetAnomalyPressure * 100.0)))
        $bucket = ((($seq - 1) * 73) + ($currentSlot * 17)) % 100
        if ($bucket -lt 0) {
            $bucket += 100
        }

        if ($bucket -lt $targetCount) {
            $seed = ([int]$config.TypeCode * 100000) + ($seq * 101) + ($currentSlot * 37)
            $severity = [double]$rateConfig.SeverityBase + (Get-DeterministicFraction -Seed ($seed + 791)) * [double]$rateConfig.SeverityRange
            return [pscustomobject]@{
                Name = [string]$config.Name
                Active = $true
                Intensity = [math]::Round($severity, 4)
            }
        }

        return [pscustomobject]@{
            Name = "Normal"
            Active = $false
            Intensity = 0.0
        }
    }

    for ($offset = 0; $offset -lt [int]$config.DurationSlots; $offset++) {
        $slot = $currentSlot - $offset
        if ($slot -lt 0) {
            continue
        }

        $seed = ([int]$config.TypeCode * 100000) + ($seq * 101) + ($slot * 37)
        $roll = Get-DeterministicFraction -Seed $seed
        if ($roll -ge [double]$config.Probability) {
            continue
        }

        $severity = [double]$rateConfig.SeverityBase + (Get-DeterministicFraction -Seed ($seed + 791)) * [double]$rateConfig.SeverityRange
        return [pscustomobject]@{
            Name = [string]$config.Name
            Active = $true
            Intensity = [math]::Round($severity, 4)
        }
    }

    return [pscustomobject]@{
        Name = "Normal"
        Active = $false
        Intensity = 0.0
    }
}

function Apply-ScenarioToTags {
    param(
        $Spec,
        [hashtable]$Tags,
        [string]$Phase,
        [double]$Intensity
    )

    $seq = Get-AgentSequence -AgentId $Spec.AgentId
    $intensity = [math]::Max(0.25, [double]$Intensity)
    $polarity = if (($seq % 2) -eq 0) { -1.0 } else { 1.0 }

    switch ($Phase) {
        "GeneratorFDI" {
            if ($Spec.Type -ne "Generator" -or ((($seq - 1) % 6) -notin @(0, 1, 2, 3))) {
                return "Normal"
            }
            $Tags["voltage"] = [math]::Round(([double]$Tags["voltage"] + (24.0 * $intensity * $polarity)), 4)
            $Tags["frequency"] = [math]::Round(([double]$Tags["frequency"] - (0.35 * $intensity * $polarity)), 4)
            $Tags["current"] = [math]::Round([math]::Max(0.0, ([double]$Tags["current"] + (15.0 * $intensity))), 4)
            $Tags["power"] = [math]::Round([math]::Max(0.0, ([double]$Tags["power"] + (28.0 * $intensity))), 4)
            $Tags["substation_load"] = [double]$Tags["power"]
            $Tags["latency"] = [math]::Round(([double]$Tags["latency"] + (2.5 * $intensity)), 4)
            $Tags["response_time"] = [math]::Round(([double]$Tags["response_time"] + (3.5 * $intensity)), 4)
            $Tags["packet_loss"] = [math]::Round([math]::Max([double]$Tags["packet_loss"], (0.020 * $intensity)), 4)
            $Tags["integrity"] = [math]::Round([math]::Max(0.35, (1.0 - (0.22 * $intensity))), 4)
            $Tags["comm_freq"] = [math]::Round([math]::Max(22.0, (50.0 - (9.0 * $intensity))), 4)
            return $Phase
        }
        "SubstationDoS" {
            if ($Spec.Type -ne "Substation" -or ((($seq - 21) % 5) -notin @(0, 1))) {
                return "Normal"
            }
            $Tags["voltage"] = [math]::Round(([double]$Tags["voltage"] - (12.0 * $intensity)), 4)
            $Tags["current"] = [math]::Round([math]::Max(0.0, ([double]$Tags["current"] + (8.0 * $intensity))), 4)
            $Tags["power"] = [math]::Round([math]::Max(0.0, ([double]$Tags["power"] + (160.0 * $intensity))), 4)
            $Tags["substation_load"] = [double]$Tags["power"]
            $Tags["latency"] = [math]::Round(([double]$Tags["latency"] + (14.0 * $intensity)), 4)
            $Tags["response_time"] = [math]::Round(([double]$Tags["response_time"] + (10.0 * $intensity)), 4)
            $Tags["packet_loss"] = [math]::Round([math]::Max([double]$Tags["packet_loss"], (0.08 * $intensity)), 4)
            $Tags["integrity"] = [math]::Round([math]::Max(0.10, (1.0 - (0.55 * $intensity))), 4)
            $Tags["comm_freq"] = [math]::Round([math]::Max(6.0, (50.0 - (32.0 * $intensity))), 4)
            return $Phase
        }
        "PMUDesync" {
            if ($Spec.Type -ne "PMU" -or ((($seq - 51) % 5) -notin @(0, 1, 2))) {
                return "Normal"
            }
            $Tags["voltage"] = [math]::Round(([double]$Tags["voltage"] + (7.0 * $intensity * $polarity)), 4)
            $Tags["frequency"] = [math]::Round(([double]$Tags["frequency"] + (0.45 * $intensity * $polarity)), 4)
            $Tags["current"] = [math]::Round([math]::Max(0.0, ([double]$Tags["current"] + (1.8 * $intensity))), 4)
            $Tags["power"] = [math]::Round([math]::Max(0.0, ([double]$Tags["power"] + (3.0 * $intensity))), 4)
            $Tags["substation_load"] = [double]$Tags["power"]
            $Tags["latency"] = [math]::Round(([double]$Tags["latency"] + (9.0 * $intensity)), 4)
            $Tags["response_time"] = [math]::Round(([double]$Tags["response_time"] + (6.0 * $intensity)), 4)
            $Tags["packet_loss"] = [math]::Round([math]::Max([double]$Tags["packet_loss"], (0.045 * $intensity)), 4)
            $Tags["integrity"] = [math]::Round([math]::Max(0.12, (1.0 - (0.48 * $intensity))), 4)
            $Tags["comm_freq"] = [math]::Round([math]::Max(18.0, (50.0 - (10.0 * $intensity))), 4)
            return $Phase
        }
        "BreakerTrip" {
            if ($Spec.Type -ne "Breaker" -or ((($seq - 76) % 5) -notin @(0, 1))) {
                return "Normal"
            }
            $Tags["breaker_status"] = 0.0
            $Tags["voltage"] = [math]::Round(([double]$Tags["voltage"] - (24.0 * $intensity)), 4)
            $Tags["frequency"] = [math]::Round(([double]$Tags["frequency"] - (0.60 * $intensity)), 4)
            $Tags["current"] = [math]::Round([math]::Max(0.0, ([double]$Tags["current"] + (11.0 * $intensity))), 4)
            $Tags["power"] = [math]::Round([math]::Max(0.0, ([double]$Tags["power"] - (18.0 * $intensity))), 4)
            $Tags["substation_load"] = [double]$Tags["power"]
            $Tags["latency"] = [math]::Round(([double]$Tags["latency"] + (6.5 * $intensity)), 4)
            $Tags["response_time"] = [math]::Round(([double]$Tags["response_time"] + (8.0 * $intensity)), 4)
            $Tags["packet_loss"] = [math]::Round([math]::Max([double]$Tags["packet_loss"], (0.030 * $intensity)), 4)
            $Tags["integrity"] = [math]::Round([math]::Max(0.20, (1.0 - (0.35 * $intensity))), 4)
            $Tags["comm_freq"] = [math]::Round([math]::Max(20.0, (50.0 - (12.0 * $intensity))), 4)
            return $Phase
        }
    }

    return "Normal"
}

function Apply-DemoAnomalyOverlay {
    param(
        $Spec,
        [hashtable]$Tags
    )

    $state = Get-DemoAnomalyState
    if (-not $state.Active) {
        return "Normal"
    }

    if ([string]$state.Name -eq "Independent") {
        $independent = Get-IndependentScenarioState -Spec $Spec
        if (-not $independent.Active) {
            return "Normal"
        }
        return Apply-ScenarioToTags -Spec $Spec -Tags $Tags -Phase ([string]$independent.Name) -Intensity ([double]$AnomalyIntensity * [double]$independent.Intensity)
    }

    return Apply-ScenarioToTags -Spec $Spec -Tags $Tags -Phase ([string]$state.Name) -Intensity ([double]$AnomalyIntensity)
}

function New-AgentSpec {
    param(
        [string]$AgentId,
        [string]$Type,
        [double]$Criticality,
        [hashtable]$Channels
    )

    return [pscustomobject]@{
        AgentId = $AgentId
        Type = $Type
        Criticality = $Criticality
        Channels = $Channels
    }
}

function Get-AgentSpecs {
    $specs = @()

    for ($seq = 1; $seq -le 20; $seq++) {
        $base = 101 + (($seq - 1) * 3)
        $cyberBase = 501 + (($seq - 1) * 4)
        $specs += New-AgentSpec -AgentId ("GEN-{0}" -f $seq.ToString("00")) -Type "Generator" -Criticality 1.0 -Channels @{
            voltage = $base
            current = $base + 1
            latency = $cyberBase
            packet_loss = $cyberBase + 1
            integrity = $cyberBase + 2
            comm_freq = $cyberBase + 3
        }
    }

    for ($seq = 21; $seq -le 50; $seq++) {
        $base = 201 + (($seq - 21) * 3)
        $cyberBase = 601 + (($seq - 21) * 3)
        $specs += New-AgentSpec -AgentId ("SUB-{0}" -f $seq.ToString("00")) -Type "Substation" -Criticality 0.7 -Channels @{
            substation_load = $base
            latency = $base + 1
            packet_loss = $cyberBase
            integrity = $cyberBase + 1
            comm_freq = $cyberBase + 2
        }
    }

    for ($seq = 51; $seq -le 75; $seq++) {
        $base = 301 + (($seq - 51) * 3)
        $cyberBase = 701 + (($seq - 51) * 4)
        $specs += New-AgentSpec -AgentId ("PMU-{0}" -f $seq.ToString("00")) -Type "PMU" -Criticality 0.3 -Channels @{
            voltage = $base
            frequency = $base + 1
            latency = $cyberBase
            packet_loss = $cyberBase + 1
            integrity = $cyberBase + 2
            comm_freq = $cyberBase + 3
        }
    }

    for ($seq = 76; $seq -le 100; $seq++) {
        $base = 401 + (($seq - 76) * 3)
        $cyberBase = 801 + (($seq - 76) * 4)
        $specs += New-AgentSpec -AgentId ("BRK-{0}" -f $seq.ToString("00")) -Type "Breaker" -Criticality 0.5 -Channels @{
            breaker_status = $base
            latency = $cyberBase
            packet_loss = $cyberBase + 1
            integrity = $cyberBase + 2
            comm_freq = $cyberBase + 3
        }
    }

    return $specs
}

function Get-RequestedChannels([object[]]$Specs) {
    $all = New-Object System.Collections.Generic.List[int]
    foreach ($spec in $Specs) {
        foreach ($value in $spec.Channels.Values) {
            if ($null -ne $value) {
                [void]$all.Add([int]$value)
            }
        }
    }
    return $all | Sort-Object -Unique
}

function Get-RapidScadaChannels([int[]]$ChannelNumbers) {
    $cnlList = ($ChannelNumbers -join ",")
    $uri = "$RapidScadaUrl/Api/Main/GetCurData?cnlNums=$cnlList"

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
                    $script:RapidScadaWebSession = $loginSession
                    $useWebSession = $true
                }
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
            return Invoke-RestMethod -Uri $uri -Method Get -WebSession $script:RapidScadaWebSession -TimeoutSec 8
        }
        if ($headers.Count -gt 0) {
            return Invoke-RestMethod -Uri $uri -Method Get -Headers $headers -TimeoutSec 8
        }
        return Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 8
    }
    catch {
        Write-Warning "Could not reach Rapid SCADA at $uri - $($_.Exception.Message)"
        return $null
    }
}

function Parse-RapidScadaResponse {
    param(
        $RapidResp,
        [int[]]$ChannelNumbers
    )

    $respOk = $false
    if ($RapidResp) {
        if ($null -ne $RapidResp.Ok) { $respOk = [bool]$RapidResp.Ok }
        elseif ($null -ne $RapidResp.ok) { $respOk = [bool]$RapidResp.ok }
    }

    if (-not $RapidResp -or -not $respOk) {
        return $null
    }

    $parsed = @{}
    $container = $null
    if ($null -ne $RapidResp.Data) { $container = $RapidResp.Data }
    elseif ($null -ne $RapidResp.data) { $container = $RapidResp.data }

    if ($container -is [System.Array]) {
        foreach ($row in $container) {
            if ($null -eq $row.cnlNum -or $null -eq $row.val) { continue }
            $parsed[[int]$row.cnlNum] = @{
                value = [double]$row.val
                stat = if ($null -ne $row.stat) { [int]$row.stat } else { 1 }
            }
        }
        return $parsed
    }

    $curData = $null
    if ($container -and $null -ne $container.CurData) { $curData = $container.CurData }
    elseif ($container -and $null -ne $container.curData) { $curData = $container.curData }

    if (-not $curData) {
        return $parsed
    }

    for ($idx = 0; $idx -lt $ChannelNumbers.Count; $idx++) {
        if ($idx -ge $curData.Count) { break }
        $entry = $curData[$idx]
        if ($null -eq $entry.D.Val) { continue }
        $parsed[[int]$ChannelNumbers[$idx]] = @{
            value = [double]$entry.D.Val
            stat = if ($null -ne $entry.D.Stat) { [int]$entry.D.Stat } else { 1 }
        }
    }

    return $parsed
}

function Get-ScaledValue([string]$TagName, [double]$RawValue) {
    if ($TagName -eq "voltage" -and $RawValue -ge 0 -and $RawValue -le 2) {
        return $RawValue * $NominalVoltage
    }
    if ($TagName -eq "frequency" -and $RawValue -ge 0 -and $RawValue -le 2) {
        return $RawValue * $NominalFrequency
    }
    if ($TagName -eq "current" -and $RawValue -ge 0 -and $RawValue -le 2) {
        return $RawValue * $NominalCurrent
    }
    return $RawValue
}

function Convert-AgentSpecToTags {
    param(
        $Spec,
        [hashtable]$ParsedChannels
    )

    $tags = @{}
    $liveTagCount = 0
    $expectedTagCount = $Spec.Channels.Count
    foreach ($pair in $Spec.Channels.GetEnumerator()) {
        $tagName = [string]$pair.Key
        $channelNum = [int]$pair.Value
        if (-not $ParsedChannels.ContainsKey($channelNum)) { continue }

        $entry = $ParsedChannels[$channelNum]
        if ([int]$entry.stat -eq 0) { continue }

        $rawValue = [double]$entry.value
        if ($tagName -eq "frequency" -and $rawValue -le 0.01) { continue }
        if ($tagName -eq "latency" -and $rawValue -lt 0) { continue }

        if ($tagName -eq "breaker_status") {
            $tags[$tagName] = if ($rawValue -gt 0.5) { 1 } else { 0 }
            $liveTagCount += 1
            continue
        }

        $tags[$tagName] = [math]::Round((Get-ScaledValue -TagName $tagName -RawValue $rawValue), 4)
        $liveTagCount += 1
    }

    if ($tags.ContainsKey("latency") -and -not $tags.ContainsKey("response_time")) {
        $tags["response_time"] = $tags["latency"]
    }
    if ($tags.ContainsKey("substation_load") -and -not $tags.ContainsKey("power")) {
        $tags["power"] = $tags["substation_load"]
    }
    if ((-not $tags.ContainsKey("power")) -and $tags.ContainsKey("voltage") -and $tags.ContainsKey("current")) {
        $inferredLoadKw = Get-InferredLoadKw -Voltage ([double]$tags["voltage"]) -Current ([double]$tags["current"])
        if ($inferredLoadKw -gt 0) {
            $tags["power"] = [math]::Round($inferredLoadKw, 4)
        }
    }
    if ((-not $tags.ContainsKey("substation_load")) -and $tags.ContainsKey("power")) {
        $tags["substation_load"] = [math]::Round([double]$tags["power"], 4)
    }
    if ((-not $tags.ContainsKey("breaker_status")) -and $tags.ContainsKey("current")) {
        $tags["breaker_status"] = if ([double]$tags["current"] -gt 0.5) { 1 } else { 0 }
    }

    $scenario = Apply-DemoAnomalyOverlay -Spec $Spec -Tags $tags

    $source = "fallback"
    if ($liveTagCount -ge $expectedTagCount -and $expectedTagCount -gt 0) {
        $source = "live"
    }
    elseif ($liveTagCount -gt 0) {
        $source = "mixed"
    }

    return [pscustomobject]@{
        Tags = $tags
        Source = $source
        LiveTagCount = $liveTagCount
        ExpectedTagCount = $expectedTagCount
        Scenario = $scenario
    }
}

function Send-AgentTagsBatchToSmartGrid {
    param(
        [object[]]$Records
    )

    $payload = @{
        records = $Records
    } | ConvertTo-Json -Depth 6

    $headers = @{
        "X-API-Key" = $env:SMARTGRID_API_KEY
        "Content-Type" = "application/json"
    }

    try {
        return Invoke-RestMethod -Method Post -Uri $SmartGridApiUrl -Headers $headers -Body $payload -TimeoutSec 10
    }
    catch {
        Write-Warning "SmartGrid batch ingest error: $($_.Exception.Message)"
        return $null
    }
}

function Invoke-SinglePoll {
    $specs = Get-AgentSpecs
    $channelNumbers = @(Get-RequestedChannels -Specs $specs)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] Polling Rapid SCADA at $RapidScadaUrl for $($specs.Count) agents ..." -ForegroundColor Cyan

    $rapidResp = Get-RapidScadaChannels -ChannelNumbers $channelNumbers
    $parsedChannels = Parse-RapidScadaResponse -RapidResp $rapidResp -ChannelNumbers $channelNumbers
    if (-not $parsedChannels) {
        Write-Warning "Rapid SCADA returned no valid channel data. Skipping publish to avoid fallback/default contamination."
        return
    }

    $records = New-Object System.Collections.Generic.List[object]
    $activeCount = 0
    $scenarioCounts = @{}
    $incompleteCount = 0
    foreach ($spec in $specs) {
        $tagPayload = Convert-AgentSpecToTags -Spec $spec -ParsedChannels $parsedChannels
        if ([string]$tagPayload.Source -eq "incomplete") {
            $incompleteCount += 1
            continue
        }
        $activeCount += 1
        $scenarioName = if ($tagPayload.Scenario) { [string]$tagPayload.Scenario } else { "Normal" }
        if (-not $scenarioCounts.ContainsKey($scenarioName)) {
            $scenarioCounts[$scenarioName] = 0
        }
        $scenarioCounts[$scenarioName] += 1
        [void]$records.Add([pscustomobject]@{
            agent_id = $spec.AgentId
            tags = $tagPayload.Tags
            criticality_weight = $spec.Criticality
            score_threshold = 3.0
            source = $tagPayload.Source
        })
    }

    if ($records.Count -eq 0) {
        Write-Warning "No complete live agent records available in this poll. Skipping publish."
        if ($incompleteCount -gt 0) {
            Write-Host "  Incomplete agents skipped: $incompleteCount" -ForegroundColor Yellow
        }
        return
    }

    $result = Send-AgentTagsBatchToSmartGrid -Records $records
    if (-not $result) {
        Write-Host "  Active agent payloads: $activeCount | posted: 0" -ForegroundColor Yellow
        return
    }

    $postedCount = if ($null -ne $result.count) { [int]$result.count } else { 0 }
    foreach ($row in @($result.results | Select-Object -First 6)) {
        $scored = if ($row.result) { $row.result } else { $row }
        $agentName = if ($scored.agent_id) { [string]$scored.agent_id } elseif ($row.normalized_request.agent_id) { [string]$row.normalized_request.agent_id } else { "agent" }
        $scoreVal = if ($null -ne $scored.deviation_score) { [double]$scored.deviation_score } elseif ($null -ne $scored.risk_score) { [double]$scored.risk_score } else { 0.0 }
        $severity = if ($scored.severity) { $scored.severity } else { "N/A" }
        Write-Host ("  {0} -> score={1} severity={2}" -f $agentName, ([math]::Round($scoreVal, 3)), $severity) -ForegroundColor Gray
    }

    Write-Host "  Active agent payloads: $activeCount | posted: $postedCount" -ForegroundColor Green
    if ($incompleteCount -gt 0) {
        Write-Host "  Incomplete agents skipped: $incompleteCount" -ForegroundColor Yellow
    }
    $activeScenarioPairs = @($scenarioCounts.GetEnumerator() | Where-Object { $_.Key -ne "Normal" -and $_.Value -gt 0 } | Sort-Object Name)
    if ($activeScenarioPairs.Count -gt 0) {
        $scenarioText = ($activeScenarioPairs | ForEach-Object { "{0}:{1}" -f $_.Key, $_.Value }) -join ", "
        Write-Host "  Demo anomaly overlay: $scenarioText" -ForegroundColor Yellow
    }
    else {
        Write-Host "  Demo anomaly overlay: Normal" -ForegroundColor DarkGray
    }
}

Write-Host "=== Rapid SCADA -> SmartGrid Multi-Agent Bridge ===" -ForegroundColor White
Write-Host "  Rapid SCADA : $RapidScadaUrl" -ForegroundColor Gray
Write-Host "  SmartGrid   : $SmartGridApiUrl" -ForegroundColor Gray
Write-Host "  Primary feed: $AgentId" -ForegroundColor Gray
Write-Host "  Mode        : 100-agent channel pattern ingest" -ForegroundColor Gray
if ($DemoAnomalyPhase -eq "Independent") {
    Write-Host "  Independent : $IndependentRatePreset preset" -ForegroundColor Gray
    Write-Host "  Target load : $([int][math]::Round($TargetAnomalyPressure * 100.0))% active anomalies" -ForegroundColor Gray
}
Write-Host ""

if ($RunOnce -or $PollIntervalSeconds -le 0) {
    Invoke-SinglePoll
}
else {
    Write-Host "Polling every $PollIntervalSeconds s (Ctrl-C to stop)" -ForegroundColor DarkCyan
    while ($true) {
        Invoke-SinglePoll
        Start-Sleep -Seconds $PollIntervalSeconds
    }
}
