# Rapid SCADA Project Guide

This guide documents the live Rapid SCADA integration used by the Smart Grid AI Audit Framework.

## Scope

This runbook covers:

1. 100-agent SCADA model used in the project.
2. Live ingest flow from Rapid SCADA to backend.
3. Strict no-default policy for live scoring.
4. Startup, verification, and troubleshooting commands.

## Live Topology

The project uses a 10 x 10 logical grid with 100 agents:

1. GEN-01 to GEN-20
2. SUB-21 to SUB-50
3. PMU-51 to PMU-75
4. BRK-76 to BRK-100

Current operational note:

1. Pipeline is live.
2. Telemetry is from Rapid SCADA calculated channels.
3. Telemetry is not yet direct field instrumentation.

## Runtime Endpoints

1. Rapid SCADA Webstation: http://127.0.0.1:10109
2. Backend health: http://127.0.0.1:8000/health
3. Grid status: http://127.0.0.1:8000/grid/status
4. Batch ingest: http://127.0.0.1:8000/v1/scada/ingest/tags/batch

## Main Integration Files

1. API service: [smartgrid_mas/api/app.py](smartgrid_mas/api/app.py)
2. SCADA adapter: [smartgrid_mas/integration/scada_adapter.py](smartgrid_mas/integration/scada_adapter.py)
3. Batch bridge puller: [scripts/pull_rapidscada_to_api.ps1](scripts/pull_rapidscada_to_api.ps1)
4. Full local startup: [scripts/start_local_demo.ps1](scripts/start_local_demo.ps1)
5. Live completeness tracer: [scripts/trace_rapidscada_live_agents.ps1](scripts/trace_rapidscada_live_agents.ps1)

## End-to-End Data Path

1. Rapid SCADA generates channel values.
2. Bridge authenticates and fetches current channel data.
3. Bridge maps channels to agent tags.
4. Bridge sends one batched payload for all agents.
5. Backend validates required live fields by agent type.
6. Backend computes score, severity, and audit decisions.
7. Dashboard renders live SCADA state.

## No-Defaults Enforcement

In live mode, adapter behavior is strict:

1. Required tags are agent-type-aware.
2. Missing required live tags cause rejection.
3. Synthetic fallback values are not used.

Implementation reference: [smartgrid_mas/integration/scada_adapter.py](smartgrid_mas/integration/scada_adapter.py).

## Start Commands

```powershell
cd "D:\Mtech Main project\smartgrid-audit-base-"
\.venv\Scripts\Activate.ps1
.\scripts\start_local_demo.ps1 -OpenDashboard
```

## Verification Commands

Health check:

```powershell
Invoke-WebRequest "http://127.0.0.1:8000/health" | Select-Object -ExpandProperty Content
```

Live completeness:

```powershell
.\scripts\trace_rapidscada_live_agents.ps1
```

Expected target:

1. Live agents: 100
2. Non-live: 0

## Known Failure Modes and Fixes

1. Wrong Rapid SCADA port
   Fix: use 10109, not legacy values.
2. 429 during ingest
   Fix: use batch ingest endpoint only.
3. Channels visible but not updating
   Fix: ensure channels are Calculated type where applicable.
4. Auth failures on current data API
   Fix: validate session/token flow in bridge and tracer scripts.

## Related Docs

1. Root project overview: [README.md](README.md)
2. Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
3. Rapid SCADA demo assets: [rapidscada_demo/README.md](rapidscada_demo/README.md)