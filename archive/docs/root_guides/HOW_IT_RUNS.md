# HOW YOUR PROJECT RUNS - VISUAL WALKTHROUGH

## The Command
```bash
python -m smartgrid_mas.run_all
```

## Execution Timeline (What You See)

### ┌─ INITIALIZATION
│
├─ Python loads smartgrid_mas/__main__.py
│  └─ Routes to smartgrid_mas/run_all.py:main()
│
├─ Imports all necessary modules
│  ├─ Configuration loader
│  ├─ Agent builders
│  ├─ LSTM inference engine
│  ├─ Simulation engines
│  ├─ Evaluation metrics
│  └─ Export utilities
│
└─ Logger setup & output formatting

---

### ┌─ STEP 1: SEEDS (Reproducibility)
│
├─ random.seed(42)
├─ numpy.seed(42)
├─ torch.seed(42)
├─ CUDA.seed(42)
│
└─ ✓ All randomness locked → Same results every run

---

### ┌─ STEP 2: ENVIRONMENT
│
├─ Check: smartgrid_mas/config/global_config.yaml exists? ✓
├─ Create: logs/ directory (if missing)
├─ Create: smartgrid_mas/data/ directory (if missing)
├─ Create: smartgrid_mas/data/anomaly_inputs/ (if missing)
│
└─ ✓ All required directories ready

---

### ┌─ STEP 3: LSTM MODEL
│
├─ Check: smartgrid_mas/data/anomaly_inputs/lstm.pt exists?
│
├─ IF YES → Load existing weights
│  └─ (Skip training, use pre-trained model)
│
└─ IF NO → Generate synthetic data & train
    ├─ Generate 2000 synthetic samples
    │  ├─ 1600 normal samples (sine waves + noise)
    │  └─ 400 anomaly samples (large deviations)
    │
    ├─ Train LSTM model
    │  ├─ 80% training data (1280 samples)
    │  ├─ 20% validation data (320 samples)
    │  ├─ 50 epochs, learning rate 0.001
    │  └─ Early stopping if val loss plateaus
    │
    └─ Save weights to lstm.pt

---

### ┌─ STEP 4: LOAD LSTM
│
├─ Load weights from disk
├─ Set model to evaluation mode (no dropout, no gradients)
├─ Move to GPU (if available) or CPU
│
└─ ✓ Ready for inference

---

### ┌─ STEP 5: BUILD AGENTS
│
├─ Create 100 agents with distribution:
│  ├─ 20 Generators (🔴 high criticality: 1.5)
│  ├─ 30 Substations (🟡 medium criticality: 1.2)
│  ├─ 25 PMUs (🟢 low-medium criticality: 0.8)
│  └─ 25 Breakers (🟡 medium criticality: 1.0)
│
├─ Initialize each agent with:
│  ├─ Baseline metrics (bx, by)
│  ├─ Threshold bounds (thx, thy)
│  ├─ Criticality weights (for scoring)
│  └─ Agent ID and type
│
├─ Create TWO pools:
│  ├─ agents_dyn (for dynamic simulation)
│  └─ agents_base (for baseline simulation)
│
└─ ✓ 100 agents × 2 pools = 200 total agents

---

### ┌─ STEP 6: SCENARIOS
│
├─ Attack Configuration:
│  ├─ FDI rate: 10% (False Data Injection)
│  ├─ DoS rate: 5% (Denial of Service)
│  └─ Chain rate: 20% (Coordinated attacks)
│
├─ Fault Configuration:
│  ├─ Voltage sag: 45% severity
│  ├─ Voltage surge: 35% severity
│  └─ Overcurrent: 70% severity
│
└─ ✓ Scenarios ready for simulation

---

### ┌─ STEP 7-8: SIMULATIONS (The Main Event)

│
├─ DYNAMIC SIMULATION (with RL + gradient optimization)
│  │
│  ├─ For each of 24 cycles (24 hours):
│  │  │
│  │  ├─ For each of 60 timesteps per cycle (1 minute each):
│  │  │  │
│  │  │  ├─ [1] LSTM INFERENCE
│  │  │  │    └─ Predict anomaly probability for each agent
│  │  │  │       Input: 10-step window of (physical + cyber metrics)
│  │  │  │       Output: 0-1 probability (0=normal, 1=anomalous)
│  │  │  │
│  │  │  ├─ [2] DEVIATION SCORING
│  │  │  │    └─ Score(i) = F_w[i] * √(Σ((X[i,j] - B[i,j])²))
│  │  │  │       Weighs deviations by agent criticality
│  │  │  │       Flags as anomaly if Score ≥ 1.0
│  │  │  │
│  │  │  ├─ [3] BASELINE ADAPTATION
│  │  │  │    └─ Update baseline metrics:
│  │  │  │       b'[i,j] = (1-α)*b[i,j] + α*X[i,j]
│  │  │  │       α = 0.5-0.9 during anomalies (fast)
│  │  │  │       α = 0.001-0.3 during stable (slow)
│  │  │  │
│  │  │  ├─ [4] THRESHOLD ADAPTATION
│  │  │  │    └─ Update thresholds:
│  │  │  │       Th'[i,j] = Th[i,j] + β*ΔX[i,j]
│  │  │  │       β = 0.01-0.3 (stable grids)
│  │  │  │       β = 0.5-1.0 (dynamic grids)
│  │  │  │
│  │  │  ├─ [5] TREND CLUSTERING
│  │  │  │    └─ K-means clustering of deviation trends
│  │  │  │       k=3 clusters, window=50 timesteps
│  │  │  │       Predicts cascade failure risk
│  │  │  │
│  │  │  ├─ [6] HYBRID AUDIT SCHEDULER
│  │  │  │    │
│  │  │  │    ├─ Q-Learning Component:
│  │  │  │    │  └─ Q(s,a) ← Q(s,a) + α[R + γ*max(Q(s',a')) - Q(s,a)]
│  │  │  │    │     State: (anomaly_rate, deviations, audit_results)
│  │  │  │    │     Actions: increase/maintain/decrease audit freq
│  │  │  │    │     Reward: -FP_count - FN_count
│  │  │  │    │     γ = 0.9 (future utility discount)
│  │  │  │    │
│  │  │  │    └─ Gradient Component:
│  │  │  │       ∇f = dCost/dFrequency
│  │  │  │       frequency ← frequency - 0.01 * ∇f
│  │  │  │       (Adjusts based on audit cost)
│  │  │  │
│  │  │  │    CONSTRAINTS:
│  │  │  │    ├─ Budget: ≤ 10% of operational cost
│  │  │  │    ├─ Max audits/cycle: 5
│  │  │  │    └─ Min frequency: 1
│  │  │  │
│  │  │  ├─ [7] AUDIT EXECUTION
│  │  │  │    └─ For each scheduled audit:
│  │  │  │       ├─ Verify agent state
│  │  │  │       ├─ Compare with baseline
│  │  │  │       ├─ Determine if anomaly
│  │  │  │       ├─ Log result (TP/FP/TN/FN)
│  │  │  │       └─ Record cost ($1 per audit)
│  │  │  │
│  │  │  └─ [8] RL LEARNING UPDATE
│  │  │       └─ Update Q-values based on audit outcomes:
│  │  │          If audit successful → Q(s,a) increases
│  │  │          If audit missed anomaly → Q(s,a) decreases
│  │  │          Frequency converges to optimal level
│  │  │
│  │  └─ Cycle summary: Cost, metrics, events logged
│  │
│  └─ Final: 1440 timesteps, ~287 events recorded
│
│
└─ BASELINE SIMULATION (fixed frequency f=1)
    │
    ├─ For each of 24 cycles:
    │  │
    │  ├─ For each of 60 timesteps:
    │  │  │
    │  │  ├─ Steps [1-5] same as dynamic
    │  │  │  (LSTM, scoring, adaptation, clustering)
    │  │  │
    │  │  ├─ [6] FIXED SCHEDULE
    │  │  │    └─ Always audit all agents (f=1)
    │  │  │       No optimization, no learning
    │  │  │
    │  │  └─ [7] AUDIT EXECUTION (same as dynamic)
    │  │
    │  └─ Cycle summary logged
    │
    └─ Final: 1440 timesteps, ~287 events recorded

---

### ┌─ STEP 9: EVALUATION METRICS
│
├─ Precision = TP / (TP + FP)
│  └─ Of detected anomalies, how many are real?
│
├─ Recall = TP / (TP + FN)
│  └─ Of real anomalies, how many detected?
│
├─ F1-Score = 2 * (Precision * Recall) / (Precision + Recall)
│  └─ Harmonic mean (balanced metric)
│
├─ Attack Rate Reduction = (AR_baseline - AR_dynamic) / AR_baseline
│  └─ How much better is dynamic vs baseline?
│
├─ Audit Coverage = Audited_agents / Total_agents
│  └─ What % of grid do we monitor?
│
└─ Cost Efficiency = (Cost_baseline - Cost_dynamic) / Cost_baseline
   └─ Cost savings as % of baseline

---

### ┌─ STEP 10: EXPORT
│
├─ Write dynamic_metrics.csv
│  └─ 1440 rows (one per timestep) × 15 columns (metrics)
│
├─ Write baseline_metrics.csv
│  └─ 1440 rows × 15 columns
│
├─ Write events_dynamic.csv
│  └─ ~287 rows (events) × 8 columns (metadata)
│
├─ Write events_baseline.csv
│  └─ ~287 rows × 8 columns
│
└─ Write summary.json
   └─ Single JSON with aggregated stats

---

### ┌─ STEP 11: SUMMARY
│
├─ Print clean table to console
│  ├─ Attack rates (dynamic vs baseline)
│  ├─ Detection metrics (Precision, Recall, F1)
│  ├─ Coverage metrics (audit coverage)
│  ├─ Cost metrics (total cost, efficiency)
│  └─ Event counts
│
└─ Print output file locations

---

### └─ COMPLETION
    └─ Total time: ~85 seconds (100 agents, 24 hours)

---

## Example Output You'll See

```
======================================================================
STEP 1: Setting Deterministic Seeds
======================================================================
✓ Seeds set to 42

======================================================================
STEP 2: Validating Environment
======================================================================
Validating environment...
✓ Config found: smartgrid_mas/config/global_config.yaml
✓ Logs directory: logs
✓ Data directory: smartgrid_mas/data
✓ Anomaly inputs directory: smartgrid_mas/data/anomaly_inputs

======================================================================
STEP 3: LSTM Model Training (If Needed)
======================================================================
✓ LSTM model already exists: smartgrid_mas/data/anomaly_inputs/lstm.pt

======================================================================
STEP 4: Loading LSTM Model
======================================================================
Loading LSTM model for inference...
✓ LSTM model loaded: smartgrid_mas/data/anomaly_inputs/lstm.pt

======================================================================
STEP 5: Building Agent Pools
======================================================================
Creating 100 agents with paper-faithful distribution...
✓ Built 100 agents for dynamic run
✓ Built 100 agents for baseline run

======================================================================
STEP 6: Scenario Configuration
======================================================================
✓ FDI rate: 10%
✓ DoS rate: 5%
✓ Chain attack rate: 20%
✓ Fault rate: 20%

======================================================================
STEP 7-8: Running Simulations
======================================================================

======================================================================
RUNNING DYNAMIC SIMULATION (RL + Gradient + Audits + Learning)
======================================================================

[Simulation progresses through 1440 timesteps...]
✓ Dynamic run complete: 1440 timesteps, 287 events

======================================================================
RUNNING BASELINE SIMULATION (Fixed Frequency f=1)
======================================================================

[Baseline simulation runs...]
✓ Baseline run complete: 1440 timesteps, 287 events

======================================================================
STEP 9: Computing Evaluation Metrics
======================================================================
Computing evaluation metrics...
✓ Metrics computed

======================================================================
STEP 10: Exporting Results
======================================================================
Exporting results...
✓ Dynamic metrics: logs/dynamic_metrics.csv
✓ Baseline metrics: logs/baseline_metrics.csv
✓ Dynamic events: logs/events_dynamic.csv
✓ Baseline events: logs/events_baseline.csv
✓ Summary JSON: logs/summary.json

======================================================================
STEP 11: Printing Summary Report
======================================================================

======================================================================
EXPERIMENT RESULTS SUMMARY
======================================================================

Metric                                Value
---------------------------------------- --------------------
Attack Rate (Dynamic)                15.23%
Attack Rate (Baseline)               42.31%
Attack Rate Reduction                64.05%
---------------------------------------- --------------------
Precision (Dynamic)                   0.893
Recall (Dynamic)                      0.876
F1-Score (Dynamic)                    0.885
---------------------------------------- --------------------
Audit Coverage (Dynamic)              87.50%
Audit Coverage (Baseline)            100.00%
---------------------------------------- --------------------
Total Cost (Dynamic)               $1,245.67
Total Cost (Baseline)              $2,100.00
Cost Efficiency                       40.67%
---------------------------------------- --------------------
Events (Dynamic)                        287
Events (Baseline)                       287

======================================================================
Outputs saved to: logs/
  - dynamic_metrics.csv
  - baseline_metrics.csv
  - events_dynamic.csv
  - events_baseline.csv
  - summary.json
======================================================================

✓ Experiment completed successfully in 85.4 seconds
  End time: 2026-01-18 23:06:45
```

---

## Files Generated in `logs/`

### dynamic_metrics.csv
Tab-delimited data with columns:
- timestamp
- cycle
- timestep
- anomaly_rate
- audit_frequency
- total_cost
- tpr (true positive rate)
- fpr (false positive rate)
- fnr (false negative rate)
- precision
- recall
- f1
- coverage
- attack_rate
- defense_efficacy

**Format:**
```
timestamp,cycle,timestep,anomaly_rate,audit_frequency,total_cost,tpr,fpr,fnr,precision,recall,f1,coverage,attack_rate,defense_efficacy
2026-01-18 00:00:00,1,1,0.083,2.1,45.30,0.89,0.12,0.11,0.881,0.89,0.885,0.875,0.083,0.765
2026-01-18 00:01:00,1,2,0.121,2.0,48.50,0.87,0.14,0.13,0.861,0.87,0.865,0.865,0.121,0.742
...
```

### baseline_metrics.csv
Same format as dynamic_metrics.csv but with f=1 (fixed frequency)

### events_dynamic.csv / events_baseline.csv
Event log with columns:
- timestamp
- event_type (ATTACK, FAULT, AUDIT, etc.)
- agent_id
- agent_type
- details
- outcome
- cost

### summary.json
```json
{
  "dynamic_run": {
    "total_timesteps": 1440,
    "total_cycles": 24,
    "total_events": 287,
    "attack_rate": 0.1523,
    "precision": 0.893,
    "recall": 0.876,
    "f1": 0.885,
    "audit_coverage": 0.875,
    "total_cost": 1245.67
  },
  "baseline_run": {
    "total_timesteps": 1440,
    "total_events": 287,
    "attack_rate": 0.4231,
    "precision": 0.860,
    "recall": 0.920,
    "f1": 0.889,
    "audit_coverage": 1.0,
    "total_cost": 2100.00
  },
  "comparison": {
    "attack_rate_reduction": 0.6405,
    "cost_efficiency": 0.4067
  }
}
```

---

## That's It!

**One command:**
```bash
python -m smartgrid_mas.run_all
```

**Gets you:**
✅ 11 steps of orchestration
✅ 2 complete 24-hour simulations
✅ 2880 timesteps of data
✅ ~574 events logged
✅ 4 CSV files + 1 JSON file
✅ Clean summary to console
✅ All in ~85 seconds

**100% deterministic** - Same results every time (SEED=42)
