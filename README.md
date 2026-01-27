# Smart Grid Audit Framework

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **AI-Driven Multi-Agent Smart Grid Security Audit Framework**  
> M.Tech Research Project - Advanced Security & Optimization for Distributed Smart Grids

---

## 📋 Overview

This framework implements an **AI-driven audit system** for multi-agent smart grid security. It combines:

- **Anomaly Detection** (LSTM-based neural networks)
- **Reinforcement Learning** (Q-learning for audit scheduling optimization)
- **Multi-Layered Architecture** (Physical, Cyber, Communication layers)
- **Real-time Risk Assessment** (Adaptive baseline & threshold refinement)

The system optimizes audit scheduling to **minimize attack rates** while **reducing operational costs** by up to 70%.

---

## 🎯 Key Features

### 1. **Cross-Layer Security Model**
- Models smart grids as **Physical ⟷ Cyber ⟷ Communication** layers
- Detects cascading attacks that propagate across layers
- Monitors 100+ agents (generators, substations, PMUs, breakers)

### 2. **AI-Powered Anomaly Detection**
- **Deviation-based scoring**: Real-time deviation from baseline behavior
- **Adaptive learning**: Dynamically adjusts thresholds based on grid dynamics
- **Multi-metric analysis**: Voltage, current, frequency, communication latency

### 3. **RL-Optimized Audit Scheduling**
- **Q-learning agent**: Balances attack detection with audit costs
- **Dynamic frequency adjustment**: Increases audits for high-risk agents
- **Convergence guarantee**: Stabilizes in ~200 episodes (~2-3 minutes)

### 4. **Comprehensive Evaluation**
- **Attack type classification**: FDI, DoS, MITM, CHAIN, FAULT detection
- **Per-attack TPR/FPR metrics**: Detailed confusion matrices
- **Statistical significance tests**: Mann-Whitney U, Kolmogorov-Smirnov
- **Cross-layer stability index**: Measures cyber-physical coupling

---

## 🏗️ Architecture

```
smartgrid-audit-base/
│
├── smartgrid_mas/                 # Main framework package
│   ├── pipeline/                   # 🆕 Modular pipeline architecture
│   │   ├── config_manager.py      # Configuration management
│   │   ├── main_pipeline.py       # Pipeline orchestrator
│   │   └── __init__.py
│   │
│   ├── agents/                     # Multi-agent system
│   │   ├── smart_grid_agent.py    # Base agent class
│   │   └── agent_types.py         # Generator, substation, PMU agents
│   │
│   ├── anomaly_detection/          # Deviation-based scoring
│   │   ├── lstm_model.py          # LSTM inference
│   │   └── detector.py            # Anomaly classifier
│   │
│   ├── audit/                      # RL-based audit scheduling
│   │   ├── q_learning_agent.py    # Q-learning optimizer
│   │   └── scheduler.py           # Audit frequency manager
│   │
│   ├── behavior_analysis/          # Adaptive baseline & thresholds
│   │   ├── baseline_manager.py    # Baseline refinement (Eq. 10)
│   │   └── scoring_pipeline.py    # Deviation scoring (Eq. 8)
│   │
│   ├── simulation/                 # Simulation engine
│   │   ├── run_simulation.py      # Main simulation loop
│   │   ├── eval_suite.py          # Evaluation metrics
│   │   └── environment.py         # Grid environment
│   │
│   └── config/                     # Configuration files
│       └── default_config.json    # Default parameters
│
├── logs/                           # Experiment outputs
│   ├── summary.json               # Aggregate metrics
│   ├── dynamic_metrics.csv        # Dynamic simulation results
│   └── baseline_metrics.csv       # Baseline comparison
│
├── docs/                           # Documentation
│   └── README_DOCUMENTATION.md    # Detailed documentation guide
│
├── requirements.txt                # Python dependencies
└── README.md                       # This file
```

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd smartgrid-audit-base

# Install dependencies
pip install -r smartgrid_mas/requirements.txt
```

### Basic Usage

#### Option 1: Standard Entry Point (Recommended)

```bash
# Run full experiment (dynamic + baseline + evaluation)
python -m smartgrid_mas.run_all
```

**What it does:**
- Trains LSTM model (if weights don't exist)
- Runs 24-hour dynamic simulation (288 timesteps) with RL-based auditing
- Runs 24-hour baseline simulation (fixed audit frequency)
- Computes comprehensive evaluation metrics
- Saves results to `logs/` directory

**Duration:** ~12-15 minutes (or ~20 minutes on first run with LSTM training)

#### Option 2: Modular Pipeline Interface (New!)

```python
from smartgrid_mas.pipeline import Pipeline

# Initialize and run with default configuration
pipeline = Pipeline()
results = pipeline.run()

# Access results
print(f"Attack Rate Reduction: {results['evaluation']['attack_rate_reduction']:.2%}")
print(f"Cost Efficiency: {results['evaluation']['cost_efficiency']:.2%}")
print(f"Risk Mitigation: {results['evaluation']['risk_mitigation']:.2%}")
```

#### Option 3: Custom Configuration

```python
from pathlib import Path
from smartgrid_mas.pipeline import Pipeline

# Load custom configuration
config_path = Path("my_config.json")
pipeline = Pipeline(config_path)

# Run specific modes
results = pipeline.run(modes=['dynamic', 'baseline'])
```

---

## ⚙️ Configuration

### Default Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|  
| `n_agents` | 100, 200, 500 | Grid sizes (scalable sweep) |
| `cycle_hours` | 24 | Simulation duration (24h) |
| `timestep_minutes` | 5 | Time resolution (288 steps/24h) |
| `audit_budget_ratio` | 0.70 | Audit budget (70% of operational cost) |
| `max_audits_per_cycle` | 10 | Maximum audits per timestep |
| `learning_rate` | 0.4 | RL learning rate (α) - faster convergence |
| `discount_factor` | 0.95 | RL discount factor (γ) |

### Custom Configuration

Edit `smartgrid_mas/config/global_config.yaml`:

```yaml
audit:
  audit_budget_ratio: 0.70     # Default for all N
  max_audits_per_cycle: 10
  
  # Per-N budget overrides (optional)
  budget_per_n:
    100: 0.80                  # 80% for N=100
    200: 0.70                  # 70% for N=200
    500: 0.60                  # 60% for N=500

rl:
  learning_rate: 0.4           # Q-learning alpha
  gamma: 0.95                  # Discount factor
  epsilon_start: 1.0
  epsilon_min: 0.05
  epsilon_decay: 0.995
```

---

## 📊 Results & Metrics

### Key Performance Indicators

| Grid Size | Attack Rate (Dyn) | Attack Rate Reduction | Cost Efficiency | Risk Mitigation | Coverage |
|-----------|-------------------|----------------------|-----------------|-----------------|----------|
| **N=100** | 0.98% | 25.40% | 55.10% | 15.84% | 66.00% |
| **N=200** | 1.14% | 15.66% | 54.43% | 9.35% | 31.50% |
| **N=500** | 1.20% | 7.39% | 23.07% | 4.47% | 18.20% |

**Detection Metrics (N=100):**
- **Precision**: 0.114 | **Recall**: 1.000 | **F1-Score**: 0.204
- **Accuracy**: 98.84% | **TPR**: 100% | **TNR**: 98.84%
- **RL Convergence**: ~30k iterations | **Runtime**: ~18 seconds

### Output Files

All results are saved to the `logs/` directory:

- **`summary.json`**: Aggregate metrics & statistics
- **`dynamic_metrics.csv`**: Per-timestep metrics (dynamic simulation)
- **`baseline_metrics.csv`**: Per-timestep metrics (baseline simulation)
- **`events_dynamic.csv`**: Attack and audit events log
- **`events_baseline.csv`**: Baseline events log

---

## 🔬 Research Foundation

### Core Algorithms

#### 1. Anomaly Scoring (Eq. 8)
```
Score(i) = F_w[i] × √(Σ((X[i,j] - B[i,j]) / Th[i,j])²)
```
- Classifies agents as anomalous when `Score ≥ 1.0`
- Weighted by criticality factor `F_w`

#### 2. Adaptive Baseline (Eq. 10)
```
B'[i,j] = (1-α)B[i,j] + α×X[i,j]
```
- `α_high (0.5-0.9)` during anomalies → rapid adaptation
- `α_low (0.001-0.3)` during stable conditions

#### 3. Q-Learning Update
```
Q(s,a) ← Q(s,a) + α[R + γ×max(Q(s',a')) - Q(s,a)]
```
- Reward: `-α₁×(False Positives) - α₂×(False Negatives)`
- Converges when `E[R]` stabilizes over 10 episodes

---

## 🧪 Testing & Validation

### Run Test Suite

```bash
# Run all tests
pytest -q

# Expected output: 36 passed
```

### Test Scenarios

1. **Normal Operation**: No attacks/faults (baseline validation)
2. **Physical Faults**: Line faults, transformer failures
3. **Cyber Attacks**: FDI, DoS, MITM, communication tampering
4. **Cascading Failures**: Coordinated breaker-substation attacks

### Validation Datasets

- **IEEE PES Power Grid Test Cases**
- **NREL Smart Grid Datasets**
- **Synthetic MATLAB Simulink Scenarios**

---

## 📚 Documentation

- **[Documentation Guide](docs/README_DOCUMENTATION.md)**: Comprehensive module documentation
- **[Copilot Instructions](.github/copilot-instructions.md)**: AI coding guidelines
- **[Step-by-step Guides](docs/)**: Implementation details for each component

---

## 🛠️ Recent Improvements

### ✅ Fixed Risk Mitigation Calculation
- **Issue**: Risk mitigation always showed 0.00% even when dynamic risk > baseline
- **Fix**: Removed `max(0.0, risk_mitigation)` clamp in `eval_suite.py`
- **Result**: Now displays actual values including negative risk mitigation

### ✅ Modular Pipeline Architecture
- Clean separation of concerns (Config → Data → Detection → Audit → Evaluation)
- Type-safe configuration management with dataclasses
- Professional logging and error handling
- Extensible design for future enhancements

### ✅ Code Organization
- Removed temporary test scripts and old documentation
- Professional directory structure
- Clear separation between core framework and experiments

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

## 👥 Authors

**M.Tech Research Project**  
Advanced Security & Optimization for Multi-Agent Smart Grids

---

## 🙏 Acknowledgments

- IEEE PES for power grid test cases
- NREL for smart grid datasets
- Research advisor and committee members

---

## 📞 Contact

For questions or collaboration opportunities, please open an issue or contact the project maintainer.

---

**Status**: ✅ Production-Ready  
**Last Updated**: January 2026  
**Framework Version**: 2.0.0
