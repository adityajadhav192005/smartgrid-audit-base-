# Smart Grid Audit Framework — Results and Configuration

This document summarizes key runtime configuration knobs, new metrics added, and how to reproduce paper-aligned runs.

## Runtime Configuration
- SMARTGRID_AUDIT_BUDGET_RATIO: Fraction of operational cost devoted to audits (default 0.10)
- SMARTGRID_MAX_AUDITS_PER_CYCLE: Max audits per timestep (default 5)
- SMARTGRID_CONSTRAINT_LOG_LEVEL: Constraint logger level (default WARNING)
- SMARTGRID_CYCLE_HOURS: Override cycle duration for sweeps
- SMARTGRID_F_MAX: Override max audit frequency bound
- SMARTGRID_RISK_THRESHOLD: Risk threshold for reaction bonus
- SMARTGRID_RL_*: RL tuning (ALPHA, GAMMA, EPSILON_START, EPSILON_MIN, EPSILON_DECAY)
- SMARTGRID_SCORE_THRESHOLD: Deviation score threshold for anomaly flag (default 1.0)
- SMARTGRID_ANOMALY_PROB_THRESHOLD: LSTM probability threshold for anomaly flag (default 0.7)
- SMARTGRID_RW_*: Reward weights for attack, audit, stability, reaction bonus
- SMARTGRID_FAIRNESS_BONUS: Small priority bonus for agents never audited to improve coverage

## New Metrics (Summary JSON)
- cross_layer_stability: Cyber-physical coupling stability index, correlation, and step counts
- deviation_trend: Cumulative deviation, slope, and optional per-timestep cluster regimes
- avg_severity_score: Average response severity score across events
- severity_level_distribution: Counts of LOW/MEDIUM/HIGH/CRITICAL response levels

## Paper-Aligned Run
Use N in {100, 200, 500}, budget_ratio=0.1, f_max=5.

```powershell
$env:SMARTGRID_AUDIT_BUDGET_RATIO="0.1"
$env:SMARTGRID_F_MAX="5"
$env:SMARTGRID_RISK_THRESHOLD="0.5"
$env:SMARTGRID_SWEEP="100,200,500"
python -m smartgrid_mas.run_all
```

## Robustness and Ablations
- SMARTGRID_SEEDS: Comma-separated seeds; results saved under logs/seed_<seed>/N<agents>/
- SMARTGRID_ABLATION: RL_ONLY, GRADIENT_ONLY, or HYBRID (default)

## Notes
- RL now warm-starts its Q-table to improve early stability.
- LSTM inference is batched per timestep to reduce latency.
- Hybrid anomaly flagging combines deviation-based score with LSTM probability.
