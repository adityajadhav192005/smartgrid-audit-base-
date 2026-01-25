# Entry Point: python -m smartgrid_mas.run_all

## Quick Start

```bash
python -m smartgrid_mas.run_all
```

That's it. One command runs the entire Smart Grid Audit Framework end-to-end.

## What Happens

1. **STEP 1**: Sets deterministic seeds (SEED=42)
2. **STEP 2**: Validates environment & creates required directories
3. **STEP 3**: Trains LSTM model if needed (2000 synthetic samples, 80/20 split)
4. **STEP 4**: Loads trained LSTM for anomaly detection
5. **STEP 5**: Builds agent pools (paper-faithful: 20% gen, 30% sub, 25% PMU, 25% brk)
6. **STEP 6**: Initializes attack/fault scenarios (FDI 10%, DoS 5%, etc.)
7. **STEP 7-8**: Runs 24-hour simulations:
   - **Dynamic**: RL + gradient-based audit scheduling (LR=0.01, budget=10%)
   - **Baseline**: Fixed audit frequency (f=1)
8. **STEP 9**: Computes evaluation metrics (Precision/Recall/F1, cost reduction, coverage)
9. **STEP 10**: Exports results to CSV and JSON
10. **STEP 11**: Prints clean summary to console

## Outputs

All results saved to `logs/`:
- `dynamic_metrics.csv` - Dynamic simulation metrics
- `baseline_metrics.csv` - Baseline simulation metrics
- `events_dynamic.csv` - Attack/audit events (dynamic)
- `events_baseline.csv` - Attack/audit events (baseline)
- `summary.json` - Aggregated statistics

## No Manual Steps

✅ Auto-creates directories
✅ Auto-trains LSTM if needed
✅ Auto-loads config
✅ Auto-runs both simulations
✅ Auto-exports results
✅ No flags, no environment setup

## Framework Integrity

All 36 tests pass ✓
Zero code changes ✓
Pure orchestration ✓

## Architecture

```
python -m smartgrid_mas.run_all
    ↓
__main__.py → run_all.py:main()
    ↓
Imports & calls existing modules:
  • config, agents, LSTM, simulation
  • eval_suite, export utilities
```

## Parameters (Paper-Faithful)

| Name | Value |
|------|-------|
| SEED | 42 |
| GAMMA | 0.9 |
| RISK_THRESHOLD | 0.5 |
| AUDIT_BUDGET_RATIO | 0.10 (10%) |
| GRADIENT_LR | 0.01 |
| MAX_AUDITS/CYCLE | 5 |
| FDI_RATE | 0.10 (10%) |
| DOS_RATE | 0.05 (5%) |

See [ENTRY_POINT.md](ENTRY_POINT.md) for detailed documentation.
