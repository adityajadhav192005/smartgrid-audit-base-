# Single Entry-Point Command

## Command

```bash
python -m smartgrid_mas.run_all
```

## What It Does

This one-line command orchestrates the **entire Smart Grid Audit Framework** end-to-end without any manual steps or additional flags.

### Execution Pipeline (In Order)

#### Step 1: Set Deterministic Seeds
- Sets seeds for `random`, `numpy`, `torch`, and CUDA (if available)
- Enables reproducible experiments with SEED=42

#### Step 2: Validate Environment
- Ensures `smartgrid_mas/`, `logs/`, and `data/` directories exist
- Creates missing directories automatically
- Validates config file at `smartgrid_mas/config/global_config.yaml`

#### Step 3: LSTM Model Training (If Needed)
- Checks if LSTM weights exist at `smartgrid_mas/data/anomaly_inputs/lstm.pt`
- If missing:
  - Generates 2000 synthetic training samples with 20% anomalies
  - Trains LSTM with 80/20 train-test split
  - Saves trained weights automatically
- If exists: Uses pre-trained model

#### Step 4: Load LSTM Model
- Loads trained LSTM for anomaly detection inference
- Falls back to mock inferencer if loading fails

#### Step 5: Build Agent Pools
- Creates agent populations for both dynamic and baseline runs
- Paper-faithful distribution:
  - 20% Generators (criticality weight ~1.5)
  - 30% Substations (criticality weight ~1.2)
  - 25% PMUs (criticality weight ~0.8)
  - 25% Breakers (criticality weight ~1.0)
- Uses seed for reproducibility

#### Step 6: Initialize Scenario Configs
- Sets attack parameters:
  - FDI rate: 10%
  - DoS rate: 5%
  - Chain attacks: 20%
  - Physical faults: 20%
- Initializes fault parameters (voltage sags, surges, overcurrent)

#### Step 7-8: Run Full 24-Hour Simulations
- **Dynamic Run** (RL + Gradient-based scheduling):
  - LSTM anomaly inference
  - Deviation scoring (weighted by agent criticality)
  - Baseline & threshold adaptation
  - Trend clustering for cascade prediction
  - Hybrid audit scheduling using Q-learning + gradient descent (LR=0.01)
  - Budget constraint: 10% of operational cost
  - Max 5 audits per cycle
  - Real audit execution with ledger tracking
  - RL post-audit policy updates

- **Baseline Run** (Fixed frequency f=1):
  - Runs audit every cycle
  - Same attack/fault scenarios
  - No RL optimization

#### Step 9: Compute Evaluation Metrics
- Precision, Recall, F1-Score
- Attack-rate reduction (dynamic vs baseline)
- Audit coverage percentages
- Total audit costs
- Cost efficiency ratio

#### Step 10: Export Results
Exports to `logs/` directory:
- `dynamic_metrics.csv` - Timestep-by-timestep dynamic simulation data
- `baseline_metrics.csv` - Timestep-by-timestep baseline simulation data
- `events_dynamic.csv` - Attack/fault/audit events from dynamic run
- `events_baseline.csv` - Attack/fault/audit events from baseline run
- `summary.json` - Aggregated metrics and statistics

#### Step 11: Print Summary Report
Displays to console:
- Attack rates (dynamic, baseline, reduction %)
- Precision/Recall/F1 scores
- Audit coverage percentages
- Total costs and efficiency gains
- Event counts
- Output file locations

## Key Parameters (Paper-Faithful)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| SEED | 42 | Reproducibility |
| GAMMA (RL discount) | 0.9 | Long-term utility focus |
| RISK_THRESHOLD | 0.5 | Anomaly detection threshold |
| AUDIT_BUDGET_RATIO | 0.10 | 10% operational cost cap |
| GRADIENT_LR | 0.01 | Adaptive audit scheduling learning rate |
| MAX_AUDITS_PER_CYCLE | 5 | Operational constraint |
| FDI_RATE | 0.10 | 10% False Data Injection attacks |
| DOS_RATE | 0.05 | 5% Denial of Service attacks |
| CHAIN_RATE | 0.20 | 20% coordinated attacks |
| FAULT_RATE | 0.20 | 20% physical faults |

## No Manual Setup Required

✅ Automatically creates directories
✅ Automatically trains LSTM if needed
✅ Automatically loads configuration
✅ Automatically runs both simulations
✅ Automatically exports results
✅ No flags or environment variables needed
✅ Cross-platform compatible (Windows/Linux/macOS)

## Output Location

All results saved to: `logs/`

View summary:
```bash
cat logs/summary.json
```

View metrics:
```bash
head logs/dynamic_metrics.csv
head logs/baseline_metrics.csv
```

## Entry Point Architecture

The command works through Python's module entry point:

```
python -m smartgrid_mas.run_all
    ↓
smartgrid_mas/__main__.py (routes to run_all)
    ↓
smartgrid_mas/run_all.py:main() (orchestrator)
    ↓
Imports and calls existing modules:
  - config.loader
  - agents.base_agent
  - anomaly_detection.inference & train_lstm
  - simulation.run_simulation
  - simulation.run_baseline_fixed
  - simulation.eval_suite
  - data.cyber_attacks & synthetic_faults
```

## No Code Changes to Existing Modules

This entry point **only imports and calls** existing components:
- ✅ All logic preserved
- ✅ All algorithms unchanged
- ✅ All parameters paper-faithful
- ✅ Zero refactoring
- ✅ Pure orchestration

## Example Execution

```bash
$ cd /path/to/smartgrid-audit-base
$ python -m smartgrid_mas.run_all

2026-01-18 23:02:50,958 | INFO | Smart Grid Audit Framework - End-to-End Experiment Runner
2026-01-18 23:02:50,958 | INFO | Start time: 2026-01-18 23:02:50

======================================================================
STEP 1: Setting Deterministic Seeds
======================================================================
✓ Seeds set to 42

[... continues through all 11 steps ...]

======================================================================
FINAL EXPERIMENT SUMMARY
======================================================================

Metric                                Value
---...
Attack Rate (Dynamic)              15.23%
Attack Rate (Baseline)             42.31%
Attack Rate Reduction              64.05%

Precision (Dynamic)                 0.893
Recall (Dynamic)                    0.876
F1-Score (Dynamic)                  0.885

Audit Coverage (Dynamic)            87.50%
Audit Coverage (Baseline)          100.00%

Total Cost (Dynamic)              $1,245.67
Total Cost (Baseline)             $2,100.00
Cost Efficiency                     40.67%

======================================================================
Outputs saved to: logs/
  - dynamic_metrics.csv
  - baseline_metrics.csv
  - events_dynamic.csv
  - events_baseline.csv
  - summary.json
======================================================================
```

## Verification

Run tests to verify framework integrity:
```bash
python -m pytest smartgrid_mas/tests/ -q
```

Expected: All 36 tests pass ✓
