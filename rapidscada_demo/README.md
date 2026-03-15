# Rapid SCADA Demo Project — GRID WITH THE AGENTS

This directory contains everything needed to set up the Rapid SCADA demo view that mirrors the website's live grid page.

---

## What You Get

| File | Purpose |
|------|---------|
| `Views/GridWithAgents.html` | Self-contained live grid view (open in browser or load as Rapid SCADA custom view) |
| `Config/Channels.xml` | Channel definitions for 100 agents (import into Rapid SCADA) |
| `Config/Objects.xml` | Object hierarchy: Generators → Substations → PMUs → Breakers |
| `Scheme/GridScheme.sch` | Rapid SCADA scheme file (mnemonics diagram) |

---

## Quick Start (Standalone HTML View)

1. Start the FastAPI server:
   ```
   cd smartgrid_mas
   python -m smartgrid_mas.run_all
   ```

2. Open `Views/GridWithAgents.html` directly in any browser.

3. The page auto-connects to `http://localhost:8000` every 2 seconds.
   - If FastAPI is offline → demo simulation mode runs automatically.
   - Click **Stop Feed** to halt live polling.
   - Click **Connect** to resume.

---

## Rapid SCADA Import Guide

### Step 1 — Create a new project

1. Open Rapid SCADA Administrator (`http://localhost:10008`)
2. Navigate to **Configuration → Projects → New Project**
3. Name it: `SmartGridAudit`

### Step 2 — Import channels

1. Go to **Configuration → Channels**
2. Click **Import → From XML**
3. Select `Config/Channels.xml`
4. Confirm — 600 channels will be created (6 per agent × 100 agents)

### Step 3 — Import objects

1. Go to **Configuration → Objects**
2. Click **Import → From XML**
3. Select `Config/Objects.xml`

### Step 4 — Add the custom view

1. Go to **Interface → Views**
2. Click **Add → Web Page** (Rapid SCADA Webstation module)
3. Set **URL** to the absolute path of `Views/GridWithAgents.html` or host it at a static path
4. Set **Name**: `GRID WITH THE AGENTS`
5. Save and publish

### Step 5 — Connect to website

The website's SCADA Live Grid page (`/scada-live`) reads from the FastAPI `/v1/scada/ingest/tags` endpoint.
The PowerShell bridge `pull_rapidscada_to_api.ps1` pushes Rapid SCADA channel values into FastAPI.

Run the bridge:
```powershell
.\pull_rapidscada_to_api.ps1 -RapidScadaUrl "http://localhost:10008" -ApiUrl "http://localhost:8000"
```

---

## Channel Naming Convention

```
GXXX_VOL   — Generator voltage (V)
GXXX_CUR   — Generator current (A)
GXXX_ANO   — Anomaly score (0.0–2.0)
SXXX_LOD   — Substation load (kW)
SXXX_LAT   — Substation latency (ms)
SXXX_ANO   — Anomaly score
PXXX_VOL   — PMU voltage
PXXX_FRQ   — PMU frequency (Hz)
PXXX_ANO   — Anomaly score
BXXX_STA   — Breaker status (0/1)
BXXX_FLT   — Fault count
BXXX_ANO   — Anomaly score
```

Agent ranges:
- **G01–G20**: Power Generators (20 agents)
- **S21–S50**: Substation Controllers (30 agents)
- **P51–P75**: PMUs (25 agents)
- **B76–B100**: Breakers (25 agents)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Grid shows grey cells | FastAPI offline — demo mode active (expected) |
| `CORS error` in browser console | Add `--cors-origin "*"` to FastAPI startup or open HTML via a local server |
| Rapid SCADA import fails | Ensure Rapid SCADA v6+ is installed; check Web API module is enabled |
| No live data after bridge starts | Verify `/v1/scada/ingest/tags` returns 200; check bridge credentials |
