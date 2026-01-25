# Quick Command Reference - Smart Grid Audit Framework

After project cleanup, here are all the essential commands you need.

## 🚀 Core Operations

### Run Full Experiment (24-hour simulation)
```bash
python -m smartgrid_mas.run_all
```
- **Duration**: 15-20 minutes (first run with LSTM training), 12-15 minutes (subsequent)
- **Output**: Generates `logs/dynamic_metrics.csv`, `logs/baseline_metrics.csv`, `logs/summary.json`
- **What it does**: Trains LSTM (if needed), builds 100-agent grid, runs dynamic + baseline simulations, computes metrics

### Run All Tests
```bash
python -m pytest smartgrid_mas/tests/ -q
```
- **Expected**: 36 passed, 2 warnings (convergence warnings are normal)
- **Time**: ~6 seconds

### Run Specific Test
```bash
python -m pytest smartgrid_mas/tests/test_lstm_smoke.py -v
python -m pytest smartgrid_mas/tests/test_rl_scheduler.py -v
```

---

## 🧪 Test Utilities (in `archive/`)

### Quick 5-Timestep Test
```bash
python archive/quick_test.py
```
- **Duration**: ~10 seconds
- **Purpose**: Verify basic framework functionality
- **Output**: Console summary

### Demo Simulation
```bash
python archive/run_demo.py
```
- **Duration**: Variable (configurable)
- **Purpose**: Full demonstration with detailed output
- **Output**: Metrics, events, summary table

### Verify Pylance Fixes
```bash
python archive/verify_fixes.py
```
- **Purpose**: Verify all type checking fixes are applied
- **Output**: Check results for each module

---

## 📂 File Locations

### Configuration
```bash
# Edit to customize parameters
nano smartgrid_mas/config/global_config.yaml
```
- Seed, cycle hours, timestep minutes
- Risk threshold, budget ratio
- RL parameters (gamma, learning rate)
- Attack scenario rates

### Core Code
```bash
# Main entry point
cat smartgrid_mas/run_all.py

# Simulation runners
cat smartgrid_mas/simulation/run_baseline_fixed.py

# LSTM model training
cat smartgrid_mas/anomaly_detection/train_lstm.py
```

### Test Suite
```bash
# All tests
ls smartgrid_mas/tests/test_*.py

# Run with coverage
python -m pytest smartgrid_mas/tests/ --cov=smartgrid_mas
```

---

## 📊 Output Files

After running `python -m smartgrid_mas.run_all`:

```
logs/
├── dynamic_metrics.csv          # Per-timestep metrics (RL run)
├── baseline_metrics.csv         # Per-timestep metrics (fixed f=1 run)
├── events_dynamic.csv           # Audit events from dynamic run
├── events_baseline.csv          # Audit events from baseline run
├── audit_ledger.csv             # Complete audit ledger
└── summary.json                 # Final metrics (JSON format)
```

### View Summary Results
```bash
# Show summary statistics
cat logs/summary.json | python -m json.tool

# Show first 10 rows of metrics
head -10 logs/dynamic_metrics.csv

# Count audit events
wc -l logs/events_dynamic.csv
```

---

## 🔧 Configuration Examples

### Customize Grid Size
Edit `smartgrid_mas/run_all.py`:
```python
# Change this line:
base_metrics, base_events = run_fixed_audit_24h(
    agents=agents_base,
    ...
    cycle_hours=48,  # Change from 24 to 48 hours
)
```

### Customize Attack Rates
Edit `smartgrid_mas/run_all.py` (line ~380):
```python
FDI_RATE = 0.20          # Increase FDI from 10% to 20%
DOS_RATE = 0.10          # Increase DoS from 5% to 10%
CHAIN_RATE = 0.30        # Increase coordinated from 20% to 30%
FAULT_RATE = 0.25        # Increase faults from 20% to 25%
```

### Customize RL Parameters
Edit `smartgrid_mas/run_all.py` (line ~320):
```python
GAMMA = 0.95             # Increase discount factor
AUDIT_BUDGET_RATIO = 0.15  # Increase budget from 10% to 15%
GRADIENT_LR = 0.02       # Increase learning rate
```

---

## 🐛 Debugging

### Enable Verbose Output
Most scripts support verbose flags:
```bash
python -m smartgrid_mas.run_all 2>&1 | tee run.log
```

### Check Python Version
```bash
python --version
# Need: 3.10+
```

### Check Dependencies
```bash
python -c "import torch; import numpy; import sklearn; print('✓ All deps OK')"
```

### Run Tests with Details
```bash
python -m pytest smartgrid_mas/tests/ -vv --tb=long
```

---

## 📖 Documentation Reference

| File | Purpose |
|------|---------|
| `README.md` | Main documentation - start here |
| `CLEANUP_SUMMARY.md` | Project reorganization details |
| `archive/README.md` | Index of archived test utilities |
| `smartgrid_mas/*/` | Inline docstrings and code |
| `smartgrid_mas/tests/` | Usage examples in test code |

---

## 🔍 Finding Things

### Find Test Files
```bash
find smartgrid_mas/tests -name "test_*.py"
```

### Find Configuration
```bash
find smartgrid_mas -name "*.yaml"
```

### Find LSTM Model
```bash
find smartgrid_mas -name "*.pt" -o -name "*.pth"
```

### Search Code
```bash
grep -r "class LSTMInferencer" smartgrid_mas/
grep -r "def run_fixed_audit_24h" smartgrid_mas/
```

---

## 📦 Git Operations (After Cleanup)

### Check Status
```bash
git status
```
Should only show modified framework files, not random .py files or build artifacts.

### Add Changes
```bash
git add -A
git commit -m "chore: clean project structure"
```

### Push to Remote
```bash
git push origin main
```

---

## ⚙️ Common Tasks

### Regenerate LSTM Model
```bash
rm smartgrid_mas/data/anomaly_inputs/lstm.pt
python -m smartgrid_mas.run_all  # Will auto-train LSTM
```

### Clear All Outputs
```bash
rm -rf logs/*.csv logs/*.json
```

### Run Experiment and Save Report
```bash
python -m smartgrid_mas.run_all 2>&1 | tee experiment_$(date +%Y%m%d_%H%M%S).log
```

### Benchmark Performance
```bash
time python -m smartgrid_mas.run_all
```

---

## 🆘 Troubleshooting

### Tests Fail
```bash
# Run single test with full output
python -m pytest smartgrid_mas/tests/test_agent.py -vv --tb=short
```

### Import Errors
```bash
# Verify imports work
python -c "from smartgrid_mas.run_all import main; print('✓ Imports OK')"
```

### LSTM Not Found
```bash
# Check if model exists
ls -la smartgrid_mas/data/anomaly_inputs/lstm.pt
# If missing, run full experiment to train it
python -m smartgrid_mas.run_all
```

### Out of Memory
```bash
# Reduce agent count in run_all.py, line ~360:
n_agents = 50  # Instead of 100
```

### Too Slow
```bash
# Check CPU/GPU:
python -c "import torch; print(f'GPU available: {torch.cuda.is_available()}')"
# Use smaller grid (see "Out of Memory" fix)
```

---

## 📞 Getting Help

1. **Check README.md** - Most answers are there
2. **Look at archive/docs/** - Step-by-step guides
3. **Review test files** - Examples in `smartgrid_mas/tests/`
4. **Check inline docs** - Docstrings in all modules
5. **Run help**: `python -m smartgrid_mas.run_all --help` (if available)

---

**Last Updated**: 2026-01-18  
**Status**: ✅ Production Ready  
**Entry Point**: `python -m smartgrid_mas.run_all`
