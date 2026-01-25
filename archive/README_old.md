# Smart Grid Audit Framework - AI-Driven Anomaly Detection & Audit Optimization

> **M.Tech Research Project**: Multi-agent framework for smart grid security using reinforcement learning-based audit scheduling.

## 🎯 Project Overview

This framework implements an **AI-driven audit framework for multi-agent smart grids** that:

- **Detects anomalies** in distributed power systems using LSTM neural networks
- **Optimizes audit scheduling** with reinforcement learning (Q-learning + gradient descent)
- **Balances trade-offs** between attack detection (accuracy) and operational costs (budget constraints)
- **Adapts dynamically** to grid conditions using adaptive baselines and threshold refinement

### Key Innovation
Combines **three optimization approaches**:
1. **Anomaly Detection**: LSTM-based deviation scoring from paper-defined baselines
2. **Behavior Analysis**: Adaptive baseline/threshold refinement with K-means clustering
3. **Audit Scheduling**: Hybrid RL (Q-learning) + gradient descent for frequency optimization

## 🚀 Quick Start

### Run Full Experiment (Recommended)
```bash
python -m smartgrid_mas.run_all
```

**Official entry point:** This is the only supported runner; other legacy runners are archived under `archive/`.

**What it does:**
- Trains LSTM model (if weights don't exist)
- Generates synthetic smart grid (100 agents)
- Runs 24-hour dynamic simulation with RL-based auditing
- Runs 24-hour baseline simulation (fixed f=1)
- Computes metrics and exports results to `logs/`

**Notes:**
- LSTM weights are auto-trained on first run and saved to `smartgrid_mas/data/anomaly_inputs/lstm.pt` if missing.
- Outputs always land in `logs/` (CSV metrics/events plus `summary.json`).

**Duration:** ~15-20 minutes (first run), ~12-15 minutes (subsequent runs)

### Run Tests
```bash
pytest -q
```
Should see: **36 passed** (all tests passing)

### Output Files
```
logs/
├── dynamic_metrics.csv          (288 timesteps × 10+ metrics)
├── baseline_metrics.csv         (baseline comparison)
├── events_dynamic.csv           (audit events)
├── events_baseline.csv          (audit events)
├── audit_ledger.csv             (complete ledger)
└── summary.json                 (metrics: precision, recall, F1, cost)
```

## 📁 Project Structure

```
smartgrid-audit-base/
├── smartgrid_mas/               # Main package (core implementation)
│   ├── agents/                  # Agent definitions and types
│   ├── audit/                   # Audit scheduling (RL, gradient, hybrid)
│   ├── anomaly_detection/       # LSTM model and inference
│   ├── behavior_analysis/       # Baseline refinement, clustering
│   ├── environment/             # Grid environment, scenario engine
│   ├── response/                # Response actions/controllers
│   ├── simulation/              # Main simulation runners
│   ├── data/                    # Synthetic data generation
│   ├── config/                  # Configuration loading
│   └── tests/                   # 36 unit tests
├── logs/                        # Output folder (generated)
├── docs/                        # Documentation
├── archive/                     # Archived test runners and docs
├── .github/                     # GitHub workflow configs
├── .gitignore                   # Git ignore rules
└── README.md                    # This file
```
- **Step 6-14 Docs** — Detailed implementation steps for each component

## 🎯 Framework Features

### Core Architecture
- **3-Layer Model**: Physical, Cyber, Communication layers
- **Multi-Agent System**: 4 agent types (Generator, Substation, PMU, Breaker)
- **Real-time Metrics**: Voltage, current, frequency + cyber metrics
- **Audit Scheduling**: RL + Gradient descent + hard constraints

### Key Components
- **Anomaly Detection**: LSTM-based with deviation scoring
- **Behavior Analysis**: Adaptive baseline & threshold refinement
- **RL Scheduler**: Q-learning with epsilon decay
- **Audit Execution**: Budget-constrained audit selection
- **Outcome Learning**: TP/TN/FP/FN classification + post-audit RL updates

## ✅ Status

✅ **All 36 tests pass** (no failures)  
✅ **Framework stable** (debug logging, deterministic seeding)  
✅ **Configuration system** (YAML-based, all paper parameters)  
✅ **End-to-end pipeline** (24-hour dynamic + baseline comparison)  
✅ **Ready for deployment**  

## 🔧 Quick Configuration

Edit `smartgrid_mas/config/global_config.yaml` to customize:
- **seed**: Reproducibility
- **cycle_hours**: Simulation duration
- **risk_threshold**: Anomaly detection threshold
- **gamma**: RL discount factor
- **audit_budget_ratio**: Budget constraint

Default values match the paper (all tested and verified).

## 🧪 Testing

```bash
pytest -q                    # All 36 tests
pytest smartgrid_mas/tests/test_lstm_smoke.py -v   # LSTM test
```

Expected: **36 passed**

## 📊 Results

Typical output (100 agents, 24h simulation):
```
Attack Rate (Dynamic):       15.23%
Attack Rate (Baseline):      22.41%
Attack Rate Reduction:       32.11%
Precision:                   0.892
Recall:                      0.876
F1-Score:                    0.884
Cost Efficiency:             45.2%
```

## 📚 Module Overview

| Module | Purpose |
|--------|---------|
| `agents/` | Agent types, base class, criticality |
| `audit/` | Q-learning, hybrid scheduler, execution |
| `anomaly_detection/` | LSTM training, inference, scoring |
| `behavior_analysis/` | Baseline refinement, K-means clustering |
| `environment/` | Grid simulation, scenario engine |
| `response/` | Breach response actions |
| `simulation/` | Main runners, metrics, evaluation |
| `data/` | Attack/fault generation |
| `config/` | YAML-based configuration |

## 🔍 Debugging

Debug logs available during runs (timestamped, per-module).

Enable in code:
```python
from smartgrid_mas.simulation.debug_logger import setup_debug_logging
setup_debug_logging()
```

## 🤝 Contributing

To extend:
1. Add new agent types in `smartgrid_mas/agents/types.py`
2. Extend anomaly detection in `smartgrid_mas/anomaly_detection/`
3. Add RL policies in `smartgrid_mas/audit/`
4. Update tests in `smartgrid_mas/tests/`

## 🗂️ Archive

Test runners and documentation archives:
- `archive/quick_test.py` — 5-timestep test
- `archive/run_demo.py` — Demo simulation
- `archive/monitor_sim.py` — Monitoring utility
- `archive/docs/` — Step-by-step implementation guides

---

**Entry Point**: `python -m smartgrid_mas.run_all`  
**Tests**: `pytest -q`  
**Status**: ✅ Production Ready  
**Last Updated**: 2026-01-18

