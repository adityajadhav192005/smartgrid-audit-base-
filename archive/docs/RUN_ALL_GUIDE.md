# End-to-End Experiment Runner

## Overview

The Smart Grid Audit Framework now includes a complete end-to-end experiment runner that orchestrates the entire experimental pipeline with a single command.

## Command

```bash
python -m smartgrid_mas.run_all
```

This is equivalent to:
```bash
python smartgrid_mas/run_all.py
```

## What It Does

The runner executes the following steps in order:

### 1. **Deterministic Seeding**
- Sets seeds for Python `random`, NumPy, PyTorch, and CUDA
- Ensures reproducible results across runs
- Seed: `42`

### 2. **Environment Validation**
- Checks that required configuration file exists
- Creates `logs/` directory for output
- Creates `smartgrid_mas/data/` directory for models
- Creates `smartgrid_mas/data/anomaly_inputs/` for LSTM weights

### 3. **LSTM Model Training** (if needed)
- Checks if LSTM weights exist at `smartgrid_mas/data/anomaly_inputs/lstm.pt`
- If missing: generates synthetic training data and trains LSTM
  - Generates 2000 samples with 20% anomalies
  - Uses sliding window of size 10
  - 80/20 train/validation split
  - 50 epochs, batch size 32
  - Saves trained model to disk
- If exists: skips training and proceeds to inference

### 4. **Load LSTM Model**
- Loads the trained (or pre-trained) LSTM model
- Falls back to mock inferencer if model load fails

### 5. **Build Agent Pools**
- Creates two identical agent pools (100 agents each):
  - **Dynamic pool**: for RL+gradient simulation
  - **Baseline pool**: for fixed frequency simulation
- Paper-faithful distribution:
  - 20% Generators (criticality: ~1.5)
  - 30% Substations (criticality: ~1.2)
  - 25% PMUs (criticality: ~0.8)
  - 25% Breakers (criticality: ~1.0)

### 6. **Configure Scenarios**
- Attack rates:
  - FDI: 10%
  - DoS: 5%
  - Coordinated attacks: 20%
- Faults: 20% physical fault rate

### 7. **Run Dynamic Simulation** (24 hours)
- Full integration test with all components:
  - GridEnvironment step function
  - Scenario engine (attack/fault injection)
  - LSTM anomaly detection
  - Deviation scoring
  - Baseline & threshold adaptation
  - KMeans trend clustering
  - Hybrid scheduler (Q-learning + gradient, LR=0.01)
  - Budget constraint: 10% of operational cost
  - Max audits per cycle: 5
  - Real audit execution & ledger recording
  - Outcome validation (TP/TN/FP/FN)
  - RL post-audit learning

### 8. **Run Baseline Simulation** (24 hours)
- Fixed audit frequency: f=1 (every timestep)
- Same 100-agent grid, same seed as dynamic run
- Provides reference for cost-efficiency comparison

### 9. **Compute Evaluation Metrics**
- Precision, Recall, F1-score
- Attack rate reduction (dynamic vs baseline)
- Audit coverage from ledger
- Total audit cost
- Cost efficiency percentage

### 10. **Export Results**
All outputs saved to `logs/` folder:
- **dynamic_metrics.csv**: Timestep-by-timestep metrics (RL+gradient run)
- **baseline_metrics.csv**: Timestep-by-timestep metrics (fixed f=1 run)
- **events_dynamic.csv**: Audit events from dynamic simulation
- **events_baseline.csv**: Audit events from baseline simulation
- **audit_ledger.csv**: Complete audit ledger with outcomes
- **summary.json**: Final summary metrics in JSON format

### 11. **Print Summary Report**
Displays results in clean table format:
```
Attack Rate (Dynamic)          XX.XX%
Attack Rate (Baseline)         XX.XX%
Attack Rate Reduction          XX.XX%
...
Precision (Dynamic)            X.XXX
Recall (Dynamic)               X.XXX
F1-Score (Dynamic)             X.XXX
...
Audit Coverage (Dynamic)       XX.XX%
Audit Coverage (Baseline)      XX.XX%
...
Total Cost (Dynamic)           $XXXX.XX
Total Cost (Baseline)          $XXXX.XX
Cost Efficiency                XX.XX%
```

## Configuration

All parameters are defined as constants at the top of `smartgrid_mas/run_all.py`:

### Paper Parameters (Non-negotiable)
```python
GAMMA = 0.9                    # RL discount factor
RISK_THRESHOLD = 0.5           # Risk score threshold for audit
AUDIT_BUDGET_RATIO = 0.10      # 10% of operational cost
GRADIENT_LR = 0.01             # Gradient-based optimization learning rate
MAX_AUDITS_PER_CYCLE = 5       # Max audits per timestep
```

### Attack Scenario Rates
```python
FDI_RATE = 0.10                # 10% of agents have FDI
DOS_RATE = 0.05                # 5% of agents have DoS
CHAIN_RATE = 0.20              # 20% coordinated breaker attacks
FAULT_RATE = 0.20              # 20% physical faults
```

### Agent Distribution
```python
GEN_RATIO = 0.20               # 20% generators
SUB_RATIO = 0.30               # 30% substations
PMU_RATIO = 0.25               # 25% PMUs
BRK_RATIO = 0.25               # 25% breakers
```

### Other Constants
```python
SEED = 42                       # Reproducibility seed
CONFIG_PATH = "smartgrid_mas/config/global_config.yaml"
LSTM_MODEL_PATH = "smartgrid_mas/data/anomaly_inputs/lstm.pt"
LOGS_DIR = Path("logs")
DATA_DIR = Path("smartgrid_mas/data")
```

## Expected Output

### Console Output
- Progress messages showing each step
- Final summary table with key metrics
- Total execution time

### File Output (in `logs/` folder)
```
logs/
├── dynamic_metrics.csv         (metrics from RL+gradient run)
├── baseline_metrics.csv        (metrics from fixed f=1 run)
├── events_dynamic.csv          (audit events, dynamic)
├── events_baseline.csv         (audit events, baseline)
├── audit_ledger.csv            (complete audit ledger)
└── summary.json                (JSON summary of metrics)
```

## Execution Time

Expected runtimes:
- LSTM training (if needed): ~2-3 minutes
- Dynamic simulation (100 agents, 288 timesteps): ~8-10 minutes
- Baseline simulation (100 agents, 288 timesteps): ~3-5 minutes
- Metrics computation & export: ~10 seconds
- **Total**: ~15-20 minutes (first run with training), ~12-15 minutes (subsequent runs)

## Error Handling

The runner includes graceful error handling:
- **LSTM training fails**: Falls back to mock LSTM inferencer
- **Config missing**: Raises clear error
- **Output directories missing**: Creates them automatically
- **Simulation errors**: Logged and reported

## Reproducibility

All randomness is controlled:
- Python `random` seeded to 42
- NumPy `default_rng` seeded to 42
- PyTorch `manual_seed` seeded to 42
- CUDA `manual_seed_all` seeded to 42 (if available)
- Both simulations use same seed for controlled comparison

## Key Features

✅ **Complete**: All 11 steps from config to summary report  
✅ **Reproducible**: Deterministic seeding across all sources  
✅ **Robust**: Graceful error handling with informative logging  
✅ **Paper-Faithful**: All paper parameters preserved exactly  
✅ **Modular**: Each step is independent and testable  
✅ **Single Command**: No manual steps required  
✅ **Comprehensive Logging**: Debug info at every stage  

## Example Usage

```bash
# Basic run (uses defaults)
python -m smartgrid_mas.run_all

# Or equivalently
python smartgrid_mas/run_all.py
```

## Verification

To verify the runner works on your system:

1. **Quick test** (skip LSTM training):
   ```bash
   # Pre-train LSTM first
   python -c "from smartgrid_mas.run_all import *; train_lstm_if_needed(setup_logging())"
   
   # Then run main
   python -m smartgrid_mas.run_all
   ```

2. **Check outputs**:
   ```bash
   ls -la logs/
   ```
   Should show: `dynamic_metrics.csv`, `baseline_metrics.csv`, `events_dynamic.csv`, `events_baseline.csv`, `summary.json`

3. **Read results**:
   ```bash
   cat logs/summary.json
   ```

## Advanced

### Modifying Parameters

Edit constants in `smartgrid_mas/run_all.py`:
- Change `n_agents` in the `build_agent_pool()` call
- Modify attack rates (FDI_RATE, DOS_RATE, etc.)
- Adjust RL parameters (GAMMA, RISK_THRESHOLD, etc.)

### Extending Functionality

The runner is designed to be extensible:
- Each step is a separate function
- Easy to add new evaluation metrics
- Can hook into any step for custom analysis
- All data structures are standard Python (dicts, lists, DataFrames)

## Troubleshooting

### LSTM model won't train
- Check CUDA is available (if you want GPU): `python -c "import torch; print(torch.cuda.is_available())"`
- Mock LSTM will be used as fallback
- See logs for detailed error message

### Simulation runs very slowly
- Expected: ~15-20 minutes for first run (with LSTM training)
- Expected: ~12-15 minutes for subsequent runs (LSTM cached)
- Subsequent runs skip LSTM training if model exists

### Out of memory
- Reduce `n_agents` in `build_agent_pool()` calls
- Or increase system RAM (framework requires ~2-3 GB for 100 agents)

### Results don't match expected values
- Verify you're using seed=42 (check `SEED` constant)
- Check that all configuration parameters match paper values
- Review `logs/` output files for detailed timestep-by-timestep metrics

## References

- **Paper**: Multi-Agent Smart Grid Security with Reinforcement Learning Audit Scheduling
- **Framework**: 15-step implementation with LSTM, RL, and outcome learning
- **Configuration**: YAML-based with all paper parameters

---

**Version**: 1.0  
**Entry Point**: `python -m smartgrid_mas.run_all`  
**Status**: Production Ready
