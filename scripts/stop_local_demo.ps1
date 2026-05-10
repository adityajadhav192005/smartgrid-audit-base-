<#
.SYNOPSIS
  One-shot stop: kills all SmartGrid demo processes and frees ports 3000, 8000, 10109.
.EXAMPLE
  .\scripts\stop_local_demo.ps1
#>

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "  SmartGrid MAS - stopping local stack" -ForegroundColor Cyan

# ── 1. Kill titled PowerShell windows launched by start_local_demo.ps1 ────────
$titles = 'SmartGrid API', 'SCADA Bridge', 'Dashboard (Next.js)'
Get-Process powershell, powershell_ise -EA SilentlyContinue | ForEach-Object {
    $t = $_.MainWindowTitle
    if ($t -and ($titles | Where-Object { $t -like "*$_*" })) {
        Write-Host "  Stopping window: $t" -ForegroundColor DarkGray
        Stop-Process -Id $_.Id -Force -EA SilentlyContinue
    }
}

# ── 2. Kill by port (catches anything still holding 8000, 3000, 10109) ────────
foreach ($port in @(8000, 3000, 10109)) {
    Get-NetTCPConnection -LocalPort $port -State Listen -EA SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object {
            $procId = $_
            $proc = Get-Process -Id $procId -EA SilentlyContinue
            if ($proc) {
                $procName = $proc.ProcessName
                Write-Host "  Killing $procName (PID $procId, port $port)" -ForegroundColor DarkGray
                Stop-Process -Id $procId -Force -EA SilentlyContinue
            }
        }
}

# ── 3. Kill ScadaWeb.exe if running ───────────────────────────────────────────
Get-Process ScadaWeb -EA SilentlyContinue | ForEach-Object {
    Write-Host "  Stopping ScadaWeb (PID $($_.Id))" -ForegroundColor DarkGray
    Stop-Process -Id $_.Id -Force -EA SilentlyContinue
}

Write-Host "  Done. Ports 8000, 3000, 10109 released." -ForegroundColor Green
Write-Host ""
