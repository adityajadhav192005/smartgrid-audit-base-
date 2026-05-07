# Rapid SCADA Demo Assets

This folder contains the Rapid SCADA project assets used by the live demo integration.

## Included Assets

1. View files for grid visualization
2. XML definitions for channels and objects
3. Scheme and configuration support files
4. Import and publish checklists

## Purpose

These assets help you:

1. Build the 100-agent Rapid SCADA project model.
2. Publish channels required by backend mapping.
3. Validate live data flow into the Smart Grid API.

## Standard Integration Flow

1. Import XML assets into Rapid SCADA project.
2. Publish and ensure channels are updating.
3. Run local backend stack.
4. Start bridge poller to post batch ingest payloads.
5. Validate 100 live agents with tracer script.

## Commands

Start stack:

```powershell
cd "D:\Mtech Main project\smartgrid-audit-base-"
\.venv\Scripts\Activate.ps1
.\scripts\start_local_demo.ps1 -OpenDashboard
```

Trace live agents:

```powershell
.\scripts\trace_rapidscada_live_agents.ps1
```

## Operational Policy

1. Live mode uses strict no-default ingestion.
2. Missing required live tags are rejected.
3. Use batch endpoint, not per-agent ingestion.

## Related Documentation

1. Full Rapid SCADA runbook: [README_RAPID_SCADA_PROJECT_GUIDE.md](../README_RAPID_SCADA_PROJECT_GUIDE.md)
2. Architecture overview: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
3. Root project README: [README.md](../README.md)