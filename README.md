# Smart Grid AI Audit Framework

This repository implements an AI-driven cyber-physical audit framework for multi-agent smart grids. It combines anomaly detection, adaptive behavior analysis, RL-based audit scheduling, and response actions under cost and safety constraints.

The project supports two operational modes:

1. Experiment Running: offline simulation and evaluation pipeline for thesis metrics.
2. Rapid SCADA Live: live ingest pipeline from Rapid SCADA to backend scoring and dashboard views.

## Current Status

Paper baseline targets are exceeded for headline metrics (cost efficiency, risk mitigation, accuracy). Precision improvement remains an open gap.

Latest validated status (March 2026):

| N | Cost Efficiency | Risk Mitigation | Accuracy | Precision | Recall |
|---|---:|---:|---:|---:|---:|
| 100 | 83.55% | 67.62% | 99.56% | 0.2515 | 1.0000 |
| 200 | 84.75% | 71.33% | 99.55% | 0.2362 | 1.0000 |
| 500 | 92.65% | 72.08% | 99.54% | 0.2278 | 1.0000 |

Precision target still pending: >= 0.35.

## Repository Map

- Core package: [smartgrid_mas](smartgrid_mas)
- Main runner: [smartgrid_mas/run_all.py](smartgrid_mas/run_all.py)
- Experiment launcher: [run_experiment.py](run_experiment.py)
- Architecture doc: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Rapid SCADA guide: [README_RAPID_SCADA_PROJECT_GUIDE.md](README_RAPID_SCADA_PROJECT_GUIDE.md)
- Viva defense guide: [README_VIVA_READY_TECHNICAL_FORTRESS.md](README_VIVA_READY_TECHNICAL_FORTRESS.md)
- Deep trace notes: [README_DEEP_ANALYSIS_DECISION_TRACE.md](README_DEEP_ANALYSIS_DECISION_TRACE.md)

## Quick Start (Experiment Mode)

Prerequisites:

1. Windows PowerShell or Linux shell
2. Python 3.10+
3. Virtual environment with project dependencies

Run:

```powershell
cd "D:\Mtech Main project\smartgrid-audit-base-"
\.venv\Scripts\Activate.ps1
python -m smartgrid_mas.run_all
```

Outputs are written under [logs](logs).

## Quick Start (Rapid SCADA Live)

Start full local stack:

```powershell
cd "D:\Mtech Main project\smartgrid-audit-base-"
\.venv\Scripts\Activate.ps1
.\scripts\start_local_demo.ps1 -OpenDashboard
```

Expected endpoints:

1. Rapid SCADA Webstation: http://127.0.0.1:10109
2. Backend API health: http://127.0.0.1:8000/health
3. Dashboard: http://localhost:3000

Verify live agent completeness:

```powershell
.\scripts\trace_rapidscada_live_agents.ps1
```

Target result:

1. Live agents: 100
2. Non-live: 0

## No-Default Live Policy

Rapid SCADA live ingest is strict and type-aware:

1. Required live tags are enforced by agent type.
2. Missing mandatory live fields are rejected.
3. Per-agent fallback and synthetic substitution are not allowed in live mode.

Core implementation: [smartgrid_mas/integration/scada_adapter.py](smartgrid_mas/integration/scada_adapter.py).

## Viva Documentation Pack

Start here for presentation and defense:

1. Project overview: [README.md](README.md)
2. Architecture and data flow: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
3. Rapid SCADA integration runbook: [README_RAPID_SCADA_PROJECT_GUIDE.md](README_RAPID_SCADA_PROJECT_GUIDE.md)
4. Defense Q and A and positioning: [README_VIVA_READY_TECHNICAL_FORTRESS.md](README_VIVA_READY_TECHNICAL_FORTRESS.md)
5. Decision and trace details: [README_DEEP_ANALYSIS_DECISION_TRACE.md](README_DEEP_ANALYSIS_DECISION_TRACE.md)
6. Knowledge mirror: [knowledge/README.md](knowledge/README.md)

## Reproducibility Checklist

1. Record exact env vars for each run.
2. Run at least 3 seeds for headline metrics.
3. Keep identical scenario settings for ablations.
4. Report mean +- std for N=100, N=200, and N=500.
5. Include per-attack support values when presenting per-attack metrics.

## License and Academic Use

This repository is structured for M.Tech thesis evaluation and demonstration. Use the cited references and report files for academic presentation claims.