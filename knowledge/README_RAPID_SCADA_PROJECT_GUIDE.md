# Rapid SCADA Guide (Knowledge Copy)

This file mirrors the operational Rapid SCADA runbook for quick knowledge retrieval.

Primary source of truth: [README_RAPID_SCADA_PROJECT_GUIDE.md](../README_RAPID_SCADA_PROJECT_GUIDE.md).

## Integration Summary

1. Rapid SCADA runs at http://127.0.0.1:10109
2. Backend runs at http://127.0.0.1:8000
3. Bridge posts to /v1/scada/ingest/tags/batch
4. Adapter enforces strict type-aware required live tags

## Core Commands

Start full stack:

```powershell
.\scripts\start_local_demo.ps1 -OpenDashboard
```

Verify live completeness:

```powershell
.\scripts\trace_rapidscada_live_agents.ps1
```

## Expected Verification Target

1. Live agents: 100
2. Non-live: 0

## Related Files

1. [smartgrid_mas/integration/scada_adapter.py](../smartgrid_mas/integration/scada_adapter.py)
2. [scripts/pull_rapidscada_to_api.ps1](../scripts/pull_rapidscada_to_api.ps1)
3. [scripts/start_local_demo.ps1](../scripts/start_local_demo.ps1)