# Technical Specification - Smart Grid Multi-Agent Audit Framework

**Document Type:** Technical Reference  
**For:** Gemini / AI Assistant Optimization  
**Purpose:** Complete specification to enable external optimization

---

## PART A: SYSTEM ARCHITECTURE

### A.1 Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR (run_all.py)               │
│  - Load config, set seeds, validate environment              │
│  - Train/load LSTM model                                     │
│  - Create agent pools (N=100, 200, 500)                      │
│  - Run dynamic & baseline simulations                        │
│  - Calculate metrics and export results                      │
└────────────┬──────────────────────────────────────────────────┘
             │
             ├─────────────────────────────────────────┐
             │                                         │
             ▼                                         ▼
        ┌──────────────────┐            ┌──────────────────────┐
        │ LSTM INFERENCE   │            │  ATTACK INJECTION    │
        ├──────────────────┤            ├──────────────────────┤
        │ Input: 24-step   │            │ FDI: 10% of agents   │
        │ history x_phys   │            │ DoS: 5% of agents    │
        │ Output:          │            │ Chain: 20% pair      │
        │ anomaly_prob     │            │ Faults: 20%          │
        │ (0.0 - 1.0)      │            │ Every timestep       │
        └────────┬─────────┘            └──────┬───────────────┘
                 │                              │
                 └──────────────────┬───────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │  BEHAVIOR ANALYSIS          │
                    ├─────────────────────────────┤
                    │ 1. Anomaly Detection        │
                    │    - LSTM output:           │
                    │      anomaly_prob           │
                    │    - Threshold: 0.999       │
                    │    - Result: anomaly_flag   │
                    │                             │
                    │ 2. Deviation Scoring        │
                    │    - baseline_delta         │
                    │    - Measure: voltage/freq  │
                    │    - from historical mean   │
                    │                             │
                    │ 3. Risk Scoring             │
                    │    - Combine multiple       │
                    │    - factors via weights    │
                    │    - Result: risk_score     │
                    │                             │
                    │ 4. Trend Clustering         │
                    │    - K-means (k=3)          │
                    │    - cluster_label          │
                    └────────────┬────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │  AUDIT SCHEDULING           │
                    ├─────────────────────────────┤
                    │ 3-Stage Hybrid:             │
                    │                             │
                    │ Stage 1: RL Decision        │
                    │  - Encode state (risk,      │
                    │    anomaly_prob, cluster)   │
                    │  - ε-greedy action select   │
                    │  - Physics-based reward     │
                    │  - Q-update                 │
                    │                             │
                    │ Stage 2: Gradient Opt       │
                    │  - Optimize frequencies     │
                    │  - Gradient descent         │
                    │  - 200 iterations max       │
                    │                             │
                    │ Stage 3: Constraints       │
                    │  - Dynamic capacity calc    │
                    │  - Budget enforcement       │
                    │  - Risk-based priority      │
                    └────────────┬────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │  METRICS CALCULATION        │
                    ├─────────────────────────────┤
                    │ Risk Mitigation:            │
                    │  (baseline_risk -           │
                    │   dynamic_risk) /           │
                    │   baseline_risk             │
                    │                             │
                    │ Attack Reduction:           │
                    │  (baseline_attacks -        │
                    │   dynamic_attacks) /        │
                    │   baseline_attacks          │
                    │                             │
                    │ Cost Efficiency:            │
                    │  executed_cost /            │
                    │  intended_cost              │
                    │                             │
                    │ Accuracy, TPR, FPR, etc.    │
                    └─────────────────────────────┘
```

### A.2 Data Flow (Per Timestep)

```
Timestep t:
  1. OBSERVE
     ├─ x_phys[i] = [voltage, current, frequency, power, comm_freq]
     ├─ y_cyber[i] = [attack_type, malicious_flag, ...]
     └─ historical_window[i] = x_phys[i-24:i]
     
  2. DETECT (Anomaly Detection)
     ├─ LSTM(historical_window) → anomaly_prob ∈ [0,1]
     ├─ if anomaly_prob > 0.999: anomaly_flag = 1
     └─ Integrity check: confirm via physics deviation
     
  3. ANALYZE (Behavior Analysis)
     ├─ baseline_delta = mean(|x_phys - baseline|)
     ├─ deviation_score = sqrt(sum_of_squared_deviations)
     ├─ risk_score = weighted_combination(anomaly_prob, deviation_score, cluster_trend)
     └─ mean_baseline_delta = avg(baseline_delta[i] for all i)
     
  4. SCHEDULE (RL Decision)
     ├─ For each agent i:
     │  ├─ state = encoder(risk_score[i], anomaly_prob[i], cluster_label[i])
     │  ├─ action = select_action(state)  # ε-greedy from Q-table
     │  ├─ new_frequency = apply_action(current_frequency, action)
     │  ├─ reward = compute_reward(...)  # PROTOCOL A (physics-based)
     │  └─ Q[state, action] ← Q[state, action] + α*(reward + γ*max(Q[state']))
     │
     ├─ Decay epsilon for exploration
     │
     └─ For each agent i:
        ├─ Gradient optimization of frequency
        ├─ Objective: min(C_f*attacks + C_a*frequency + C_stability*deviation)
        └─ 200 iterations max
     
  5. ENFORCE (Constraints)
     ├─ Compute dynamic_max_audits = max(10, N*0.05) * (3 if crisis else 1)
     ├─ Rank agents by (risk_score + cluster_bonus)
     ├─ Allocate audits from high-risk to low-risk
     ├─ Respect f_min and f_max bounds
     └─ Enforce budget constraint
     
  6. EXECUTE (Audits)
     ├─ For each scheduled audit:
     │  ├─ Deep inspection of agent i
     │  ├─ If attack detected: remove malicious flag
     │  └─ Update risk_score[i] downward
     │
     └─ Record execution cost, denied requests, etc.
     
  7. RECORD (Logging)
     ├─ metrics_dyn[t] = {
     │    'anomaly_rate': sum(anomaly_flag) / N,
     │    'mean_risk': mean(risk_score),
     │    'mean_baseline_delta': mean(baseline_delta),
     │    'requested_audits': sum(proposed_frequencies),
     │    'executed_audits': sum(actual_frequencies),
     │    'attack_rate': sum(malicious_flags) / N,
     │    ...
     │  }
     └─ Save to CSV

After all 288 timesteps:
  1. Calculate aggregate metrics
  2. Compare dynamic vs baseline
  3. Export summary.json, metrics CSVs, events CSV
```

---

## PART B: ALGORITHMS

### B.1 Physics-Based Reward Function (PROTOCOL A)

**File:** `smartgrid_mas/environment/reward_function.py`

**Input Parameters:**
- `st`: AgentState (contains anomaly_prob, risk_score, audit_frequency, baseline_delta, deviation_score)
- `action`: AuditAction (DEC, HOLD, INC)
- `mean_baseline_delta`: Physical grid deviation (avg of all agents)
- `attacks_stopped`: Count of detected attacks removed this cycle
- `audit_cost`: Cost of audits executed this cycle

**Threshold Values:**
- `CRITICAL_THRESHOLD = 5.0` (grid crashing)
- `SAFE_THRESHOLD = 1.0` (stable operation)

**Logic:**

```python
# Stage 1: Safety Cliff (Hard Constraint)
if mean_baseline_delta > CRITICAL_THRESHOLD:
    # Grid is crashing → GAME OVER, agent failed
    return -500.0 - (mean_baseline_delta * 10.0)

# Stage 2: Normal Reward (Safe Zone)
# Only reached if mean_baseline_delta <= CRITICAL_THRESHOLD

# Component A: Security Score
security_score = 10.0 * attacks_stopped
# Reward proportional to attacks caught
# Range: [0, 10*N] depending on attack intensity

# Component B: Stability Penalty
stability_penalty = -2.0 * mean_baseline_delta
# Constant pressure to reduce physical deviation
# Strong incentive: even small delta = -2.0 per point

# Component C: Conditional Efficiency Penalty
if mean_baseline_delta <= SAFE_THRESHOLD:
    # Grid is stable → now we care about cost
    efficiency_penalty = -0.5 * audit_cost
    # Penalize high audit spending
else:
    # Grid is shaking → audits are CRITICAL
    efficiency_penalty = 0.0
    # Zero penalty, agent is free to spend

# Final Reward
total_reward = security_score + stability_penalty + efficiency_penalty
return total_reward
```

**Key Properties:**
- ✓ Cannot be gamed (based on physical measurements)
- ✓ Clear failure signal (delta > 5.0)
- ✓ Incentivizes crisis spending (efficiency_penalty = 0)
- ✓ Continuous risk pressure (-2.0 * delta always)

**Typical Output Range:**
- Crisis state: [-600, -400] (failing)
- High risk: [-50, -20] (concerning)
- Medium risk: [-10, 0] (acceptable)
- Low risk + good auditing: [0, +50] (good)

---

### B.2 Dynamic Audit Capacity (PROTOCOL C)

**File:** `smartgrid_mas/audit/constraints.py`

**Input:**
- `num_agents`: Grid size (100, 200, 500, etc.)
- `mean_baseline_delta`: Physical deviation (triggers overdraft)
- `budget_ratio`: Fraction of operational cost for audits
- `audit_cost_per_audit`: Base cost per single audit

**Logic:**

```python
# Step 1: Calculate Base Capacity (scales with grid)
base_cap = max(10, int(num_agents * 0.05))

# Examples:
# N=100 → max(10, 5) = 10 audits
# N=200 → max(10, 10) = 10 audits
# N=500 → max(10, 25) = 25 audits
# N=1000 → max(10, 50) = 50 audits

# Step 2: Check for Emergency (Crisis Mode)
CRITICAL_THRESHOLD = 5.0
is_crisis = mean_baseline_delta > CRITICAL_THRESHOLD

# Step 3: Apply Overdraft Multiplier
if is_crisis:
    overdraft_multiplier = 3.0  # 3× capacity during crisis
else:
    overdraft_multiplier = 1.0
dynamic_max_audits = base_cap * overdraft_multiplier

# Examples:
# Normal: N=500 → 25 audits
# Crisis: N=500 → 75 audits (15% coverage)

# Step 4: Apply Cost Multiplier
cost_multiplier = 3.0 if is_crisis else 1.0
effective_audit_cost = audit_cost_per_audit * cost_multiplier

# Step 5: Calculate Budget Allowance
budget_allowed = budget_ratio * operational_cost
max_by_budget = int(budget_allowed // effective_audit_cost)

# Step 6: Determine Final Capacity
allowed_total = min(dynamic_max_audits, max_by_budget)

# Step 7: Allocate by Risk Priority
agents_by_risk = sorted(agents, key=lambda a: a.last_state.risk_score, reverse=True)
for agent in agents_by_risk:
    if allowed_total <= 0:
        agent.set_audit_frequency(0)
    else:
        grant = min(agent.audit_frequency, allowed_total)
        agent.set_audit_frequency(grant)
        allowed_total -= grant
```

**Allocation Example (N=500, base_cap=25, not crisis):**
```
Request distribution: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1, ...]
Priority ranking: [Agent5(risk=3.5), Agent11(risk=3.4), Agent2(risk=3.3), ...]

Allocation:
  Agent5   requested=5 → grant=5  (allowed=20)
  Agent11  requested=4 → grant=4  (allowed=16)
  Agent2   requested=3 → grant=3  (allowed=13)
  Agent18  requested=3 → grant=3  (allowed=10)
  Agent13  requested=2 → grant=2  (allowed=8)
  ...remaining agents denied due to cap
  
Result: 25 audits allocated, 475 denied
Coverage: 25/500 = 5%
```

---

### B.3 RL State Encoding

**File:** `smartgrid_mas/audit/audit_scheduler_rl.py`

**Input State Components:**
```python
state_components = {
    'risk_score': float,          # [0, 10] (normalized)
    'anomaly_prob': float,        # [0, 1]
    'cluster_label': int,         # {0, 1, 2, ...}
    'baseline_delta': float,      # [0, 50] (optional)
}

# Discrete encoding for Q-learning:
risk_bins = 11  # 0-10 mapped to 11 buckets
anomaly_bins = 11  # 0-1 mapped to 11 buckets
cluster_bins = 5  # 0-4 (K=3 + buffer)

# Encoded state = (risk_bin, anomaly_bin, cluster_bin)
state_space_size = 11 * 11 * 5 = 605
```

**Action Space:**
```python
class AuditAction(Enum):
    DEC = 0   # Decrease frequency by 1
    HOLD = 1  # Keep frequency same
    INC = 2   # Increase frequency by 1

action_space_size = 3
```

**Q-Table:**
```python
Q_table = {}  # state → {action: q_value}

# Example Q-table entry:
Q[(5, 7, 2)] = {
    0: -2.5,   # DEC is penalized (not good for high-risk)
    1: 0.2,    # HOLD is neutral
    2: 3.1,    # INC is rewarded (good for high-risk)
}
```

---

### B.4 RL Update Rule (Bellman)

**File:** `smartgrid_mas/audit/schedule_step.py`

```python
# Q-Learning Update (after each timestep)
alpha = 0.1  # Learning rate

s = encoder(risk, anomaly_prob, cluster)  # Current state
a = select_action(s, epsilon)  # Action taken
r = compute_reward(...)  # Reward received
s_next = encoder(...)  # Next state (same observation, updated agent state)

# Bellman Update
max_q_next = max(Q[s_next].values()) if s_next in Q else 0.0
Q[s, a] = Q[s, a] + alpha * (r + gamma * max_q_next - Q[s, a])

# Epsilon Decay
epsilon = max(epsilon_min, epsilon * epsilon_decay)
# epsilon_start = 1.0, epsilon_min = 0.05, epsilon_decay = 0.995
```

**Convergence Criteria:**
- RL Converged when: mean(Q-value changes) < 1e-4 over 100 iterations
- Typical convergence: 30K iterations (N=100), 146K iterations (N=500)

---

## PART C: HYPERPARAMETERS & TUNING RANGES

### C.1 Reward Function Parameters

```python
# Current Values → Tuning Ranges

lambda_attack = 2.0               # Can try: 1.0, 2.0, 3.0, 4.0, 5.0
lambda_audit = 0.10               # Can try: 0.05, 0.10, 0.20, 0.30
lambda_stability = 0.10            # Can try: 0.05, 0.10, 0.20
bonus_react = 1.0                 # Can try: 0.5, 1.0, 2.0, 5.0

# Conditional Thresholds
CRITICAL_THRESHOLD = 5.0           # Can try: 3.0, 4.0, 5.0, 6.0, 7.0
SAFE_THRESHOLD = 1.0              # Can try: 0.5, 1.0, 1.5, 2.0

# Penalty Magnitudes
safety_cliff_penalty = -500.0      # Can try: -100, -300, -500, -1000
stability_penalty_coeff = -2.0     # Can try: -1.0, -2.0, -5.0, -10.0
efficiency_penalty_coeff = -0.5    # Can try: -0.1, -0.5, -1.0
```

### C.2 Audit Capacity Parameters

```python
# Current Values → Tuning Ranges

base_cap_ratio = 0.05              # Can try: 0.05, 0.10, 0.15, 0.20, 0.30
# base_cap = max(10, N * base_cap_ratio)

overdraft_multiplier = 3.0         # Can try: 1.5, 2.0, 2.5, 3.0, 4.0
cost_multiplier = 3.0              # Can try: 1.5, 2.0, 3.0, 5.0

overdraft_trigger_delta = 5.0      # Can try: 3.0, 4.0, 5.0, 6.0, 7.0

budget_ratio = 0.50                # Can try: 0.30, 0.50, 0.60, 0.70, 0.80
audit_cost_per_audit = 10.0        # Can try: 5.0, 10.0, 15.0, 20.0
```

### C.3 RL Parameters

```python
# Current Values → Tuning Ranges

gamma = 0.9                        # Can try: 0.7, 0.8, 0.9, 0.95, 0.99
alpha = 0.1                        # Can try: 0.01, 0.05, 0.1, 0.3, 0.5
epsilon_start = 1.0                # Fixed (exploration phase)
epsilon_min = 0.05                 # Can try: 0.01, 0.05, 0.10, 0.20
epsilon_decay = 0.995              # Can try: 0.990, 0.995, 0.999
```

### C.4 Gradient Optimization Parameters

```python
# Current Values → Tuning Ranges

grad_lr = 0.01                     # Can try: 0.001, 0.01, 0.05, 0.1
grad_max_iters = 200               # Can try: 50, 100, 200, 500
grad_eps = 1e-4                    # Fixed (convergence tolerance)
```

### C.5 LSTM Parameters

```python
# Current Values → Tuning Ranges

lstm_window = 24                   # Can try: 12, 18, 24, 36, 48
lstm_hidden_size = 64              # Can try: 32, 64, 128, 256
lstm_num_layers = 2                # Can try: 1, 2, 3
lstm_dropout = 0.2                 # Can try: 0.0, 0.1, 0.2, 0.3
lstm_batch_size = 64               # Can try: 32, 64, 128, 256
lstm_epochs = 20                   # Can try: 10, 20, 30, 50
anomaly_prob_threshold = 0.999     # Can try: 0.90, 0.95, 0.99, 0.999
```

---

## PART D: METRICS DEFINITIONS

### D.1 Risk Mitigation (PRIMARY)

```
Definition:
  risk_mitigation = (mean_risk_baseline - mean_risk_dynamic) / mean_risk_baseline

Where:
  mean_risk_baseline = average risk across all 288 timesteps (baseline run)
  mean_risk_dynamic = average risk across all 288 timesteps (RL-optimized run)

Interpretation:
  +15% = grid risk reduced by 15% (target)
  +0% = no change
  -5% = grid risk increased by 5% (failure)

Calculation Location: smartgrid_mas/simulation/eval_suite.py line 420
```

### D.2 Attack Rate Reduction

```
Definition:
  attack_reduction = (attack_rate_baseline - attack_rate_dynamic) / attack_rate_baseline

Where:
  attack_rate = (count_of_timesteps_with_attacks / total_timesteps)

Interpretation:
  +20% = 20% fewer attack occurrences
  +0% = same number of attacks
  -10% = 10% more attacks (failure)
```

### D.3 Detection Accuracy

```
Definition (Binary Classification):
  accuracy = (TP + TN) / (TP + TN + FP + FN)

Where:
  TP = attack detected when present
  TN = no alarm when no attack
  FP = alarm when no attack
  FN = missed attack

Target: >98%
```

### D.4 False Positive Rate (FPR)

```
Definition:
  FPR = FP / (FP + TN)

Where:
  FP = false alarms
  TN = correct negatives (no attack, no alarm)

Interpretation:
  1.5% = 1.5 false alarms per 100 normal readings
  Target: <2%
```

### D.5 Cost Efficiency

```
Definition:
  cost_efficiency = executed_cost / intended_cost

Where:
  intended_cost = sum(f_i * cost_per_audit) for all agents (what we planned to spend)
  executed_cost = actual cost after constraints are enforced

Interpretation:
  58% = only executed 58% of planned audits (many denied)
  70% = executed 70% (efficient)
  100% = executed everything planned (no constraints)
  Target: >70%
```

### D.6 Audit Coverage

```
Definition:
  audit_coverage = (agents_audited_at_least_once / total_agents) * 100%

Where:
  agents_audited = count where f_i > 0 during 288 timesteps

Interpretation:
  49% = 49% of agents received at least one audit in 24 hours
  Target: >50%
```

### D.7 Convergence Metrics

```
RL Converged: Yes/No (when Q-table stabilizes)
RL Iterations: number of RL updates until convergence
Gradient Converged: Yes/No (when gradient updates stabilize)
Gradient Iterations: number of gradient steps until convergence
```

---

## PART E: TEST PROTOCOL FOR OPTIMIZATION

### E.1 Single Parameter Sweep Template

```bash
# Test single parameter variation (e.g., base_cap_ratio)

for PARAM_VALUE in 0.05 0.10 0.15 0.20; do
  export SMARTGRID_PARAM_VALUE=$PARAM_VALUE
  export SMARTGRID_SWEEP="100,200,500"
  python -m smartgrid_mas.run_all > sweep_param_${PARAM_VALUE}.log 2>&1
  
  # Extract metrics from logs
  grep "Risk Mitigation" sweep_param_${PARAM_VALUE}.log > results.txt
done

# Compare results.txt across different PARAM_VALUEs
```

### E.2 Combined Parameter Optimization

```bash
# Test combinations (e.g., budget_ratio × base_cap_ratio)

for BUDGET in 0.50 0.70; do
  for CAP in 0.05 0.15; do
    export SMARTGRID_AUDIT_BUDGET_RATIO=$BUDGET
    export SMARTGRID_CAP_RATIO=$CAP
    python -m smartgrid_mas.run_all > sweep_b${BUDGET}_c${CAP}.log 2>&1
  done
done
```

### E.3 Result Extraction

```bash
# Extract all results into CSV

cat sweep_*.log | grep "Risk Mitigation" | \
  sed 's/.*N=//' | \
  awk -F'[|:]' '{print $1, $NF}' > results.csv

# View all results
cat results.csv
```

---

## PART F: CRITICAL FILE LOCATIONS

### Core Algorithm Files
```
smartgrid_mas/environment/reward_function.py    [Lines 43-103] - PROTOCOL A
smartgrid_mas/audit/constraints.py              [Lines 46-62]  - PROTOCOL C base_cap calc
smartgrid_mas/audit/schedule_step.py            [Lines 90-145] - RL scheduling loop
smartgrid_mas/audit/audit_scheduler_rl.py       [Lines 1-100]  - Q-learning implementation
smartgrid_mas/behavior_analysis/scoring_pipeline.py [Line 112]  - baseline_delta calculation
```

### Hyperparameter Configuration
```
smartgrid_mas/config/global_config.yaml         - All tunable parameters
smartgrid_mas/environment/reward_function.py    - reward_weights defaults
smartgrid_mas/run_all.py                        - environment variable overrides
```

### Metrics Calculation
```
smartgrid_mas/simulation/eval_suite.py          [Lines 418-420] - risk_mitigation formula
smartgrid_mas/simulation/run_simulation.py      [Lines 200+]    - metric collection
smartgrid_mas/simulation/run_baseline_fixed.py  - baseline metrics
```

### Testing & Validation
```
smartgrid_mas/tests/test_sanity_constraints.py  - constraint enforcement tests
smartgrid_mas/tests/test_gradient_hybrid.py     - RL + gradient tests
```

---

## PART G: OPTIMIZATION CHECKLIST FOR GEMINI

**When optimizing, verify:**

- [ ] All code changes compile (`python -m py_compile <file>`)
- [ ] Changes don't break existing constraints (f_min, f_max, budget)
- [ ] Reward function still returns float values (no NaN/Inf)
- [ ] Q-learning converges (RL Converged: Yes)
- [ ] Risk mitigation is positive (> 0%)
- [ ] Accuracy remains >98%
- [ ] Audit coverage increases (or stays same)
- [ ] Cost doesn't explode (efficiency reasonable)
- [ ] All three grid sizes tested (N=100, 200, 500)
- [ ] Metrics exported to logs/N*/summary.json

**Success Criteria:**
- ✅ N=100: Risk Mitigation ≥ 15%
- ✅ N=200: Risk Mitigation ≥ 12%
- ✅ N=500: Risk Mitigation ≥ 10-12%
- ✅ All: Accuracy ≥ 98%
- ✅ Cost Efficiency ≥ 65%

---

**Document Version:** 1.0  
**Generated:** January 25, 2026  
**For Optimization By:** Gemini / Claude / External AI Assistant
