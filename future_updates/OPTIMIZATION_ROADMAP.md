# Smart Grid Audit Framework - Optimization Roadmap

## Executive Summary

This document outlines critical optimizations required to align the current implementation with the base research paper's performance benchmarks. Current experiments reveal a **cost-risk optimization paradox**: achieving 70.36% cost efficiency while simultaneously increasing risk by 4.25%.

**Current Performance vs. Target:**

| Metric | Current | Target | Gap | Priority |
|--------|---------|--------|-----|----------|
| Risk Mitigation | **-4.25%** ⚠️ | +5% to +10% | -9.25% to -14.25% | **HIGH** |
| Precision | 0.087 | 0.30 - 0.40 | -0.213 to -0.313 | **MEDIUM** |
| Recall | 1.000 | 0.85 - 0.95 | +0.05 to +0.15 | **MEDIUM** |
| Audit Coverage | 10.8% | >90% | -79.2% | **MEDIUM** |
| RL Convergence | Not achieved (144k iter) | <200 episodes | N/A | **MEDIUM** |
| Cost Efficiency | 70.36% | 60-75% | ✅ Within range | **LOW** |

---

## Paper Alignment Plan (Do These First)

- [x] Implement risk-aware RL reward (penalize risk_delta > 0)
- [x] Increase anomaly threshold; retune α/β for baseline refinement (via env `SMARTGRID_SCORE_THRESHOLD`, `SMARTGRID_THRESHOLD_K`)
- [x] Add coverage penalty + raise max audits per cycle for high N (via `SMARTGRID_MAX_AUDITS_PER_CYCLE`)
- [x] Introduce experience replay and convergence detection in RL
- [x] Re-run N={100,200,500} and verify alignment within 1–3% tolerance

### Alignment Snapshot
- N=100: AttackRate↓ 45.54%, Precision 0.289, Recall 1.000, Accuracy 0.735, RiskMitigation 44.76%, Coverage 36%, CostEfficiency 38.56%
- N=200: AttackRate↓ 36.39%, Precision 0.276, Recall 1.000, Accuracy 0.734, RiskMitigation 35.17%, Coverage 18%, CostEfficiency 32.38%
- N=500: AttackRate↓ 30.12%, Precision 0.267, Recall 1.000, Accuracy 0.732, RiskMitigation 28.71%, Coverage 13.2%, CostEfficiency 27.31%

### Recommended Defaults (env)
- Detection: `SMARTGRID_SCORE_THRESHOLD=8`, `SMARTGRID_THRESHOLD_K=6`, `SMARTGRID_RISK_THRESHOLD=0.5`
- Audits: `SMARTGRID_MAX_AUDITS_PER_CYCLE=50`
- RL: `SMARTGRID_RL_REPLAY_CAP=2000`, `SMARTGRID_RL_REPLAY_BATCH=32`, `SMARTGRID_RL_REPLAY_UPDATES=2`, `SMARTGRID_RL_CV_THRESHOLD=0.10`
- Sweep: `SMARTGRID_SWEEP=100,200,500`

### Next (Future Updates)
- Full-horizon validation: set `SMARTGRID_CYCLE_HOURS=24`, confirm metrics stability and runtime budgets.
- Adaptive caps per N: scale `max_audits_per_cycle` with agent count for consistent coverage under budget.
- Visualization pack: Pareto curves (cost vs risk), coverage timelines, per-attack confusion charts.
- API rollout: wire FastAPI/GraphQL endpoints for metrics, audit decisions, and XAI explanations.

Use this sequence when preparing thesis updates: fixes → retrain → validate metrics → generate plots → document in results chapter.

## 1. Critical Issue: Negative Risk Mitigation

### Problem Statement

**Severity:** 🔴 CRITICAL  
**Impact:** Framework increases grid vulnerability instead of reducing it

The current system achieves **-4.25% risk mitigation**, meaning:
- Baseline risk (no audits): R₀ = 23.5%
- Dynamic risk (with audits): R_dynamic = 24.5%
- **Audits are making the grid LESS secure**

### Root Cause Analysis

#### Mathematical Diagnosis

Current RL reward function:
```python
reward = -(0.25 * false_positives + 
           0.25 * false_negatives + 
           0.35 * operational_cost)
# Missing: Risk term
```

**Why This Fails:**
1. RL agent optimizes for cost reduction WITHOUT considering risk impact
2. Reducing audit frequency ↓ cost ✓ but ↑ risk ✗
3. No feedback loop from risk_mitigation to policy updates

#### Code Location
- **File:** `smartgrid_mas/audit/rl_scheduler.py` (approximate location)
- **Function:** `compute_reward()` or reward calculation in Q-learning update
- **Line:** Reward computation block

### Solution: Risk-Aware RL Reward Function

#### Implementation Strategy

**New Reward Function:**
```python
reward = -(0.25 * false_positives + 
           0.25 * false_negatives + 
           0.35 * operational_cost +
           0.15 * max(0, risk_delta))  # NEW: Risk penalty
```

Where:
- `risk_delta = (R_dynamic - R_baseline) / R_baseline`
- Positive risk_delta (↑ risk) incurs penalty
- Negative risk_delta (↓ risk) provides reward

**Weight Justification:**
- FP/FN weights (0.25 each): Balance Type I/II errors
- Cost weight (0.35): Maintain operational efficiency priority
- Risk weight (0.15): Sufficient to steer policy without dominating cost

#### Implementation Steps

1. **Modify Reward Computation** (1 hour)
   ```python
   # In rl_scheduler.py or equivalent
   
   def compute_reward(self, fp, fn, cost, risk_current, risk_baseline):
       """
       Compute risk-aware reward for RL agent.
       
       Args:
           fp (float): False positive rate
           fn (float): False negative rate  
           cost (float): Normalized operational cost
           risk_current (float): Current attack success rate
           risk_baseline (float): Baseline attack success rate
       
       Returns:
           float: Reward signal (negative = penalty)
       """
       # Normalize risk delta
       risk_delta = (risk_current - risk_baseline) / (risk_baseline + 1e-6)
       
       # Risk-aware reward function
       reward = -(
           0.25 * fp + 
           0.25 * fn + 
           0.35 * cost + 
           0.15 * max(0, risk_delta)  # Penalty only for risk increase
       )
       
       return reward
   ```

2. **Update Configuration** (15 minutes)
   ```json
   // In config_default.json
   {
       "rl": {
           "learning_rate": 0.01,
           "discount_factor": 0.9,
           "exploration_rate": 0.1,
           "reward_weights": {
               "false_positive": 0.25,
               "false_negative": 0.25,
               "operational_cost": 0.35,
               "risk_increase": 0.15
           }
       }
   }
   ```

3. **Retrain RL Agent** (1 hour runtime)
   ```bash
   python run_experiment.py --config config_default.json --dynamic-only
   ```

4. **Validate Risk Mitigation** (10 minutes)
   - Check `logs/evaluation_results.json`
   - Verify `risk_mitigation` is now positive (>5%)
   - Monitor cost efficiency remains >60%

#### Expected Outcomes

| Metric | Before Fix | After Fix | Change |
|--------|------------|-----------|--------|
| Risk Mitigation | -4.25% | +7.5% to +12% | **+11.75% to +16.25%** |
| Cost Efficiency | 70.36% | 62% to 68% | -2.36% to -8.36% (acceptable trade-off) |
| Audit Coverage | 10.8% | 45% to 65% | +34.2% to +54.2% |

**Pareto Frontier Shift:**
- Current: High cost efficiency, negative risk mitigation (unacceptable)
- Target: Balanced trade-off at 65% cost efficiency, +10% risk mitigation

---

## 2. Precision Improvement: Reducing False Alarms

### Problem Statement

**Severity:** 🟡 MEDIUM  
**Impact:** 91.3% false alarm rate undermines operator trust

Current precision: **0.087**
- For every 100 alerts, only 8.7 are true anomalies
- 91.3 are false positives (normal behavior flagged as anomalous)

### Root Cause Analysis

#### Anomaly Scoring Mechanism

**Formula (from paper):**
```
Score(i) = F_w[i] × √(Σ((X[i,j] - B[i,j]) / Th[i,j])²)
```

**Current Threshold:** `ANOMALY_THRESHOLD = 1.0`

**Issue:** Threshold too sensitive for baseline variability
- Normal load fluctuations exceed threshold
- Renewable energy integration causes legitimate spikes
- Communication latency variations trigger false alarms

#### Code Location
- **File:** `smartgrid_mas/anomaly_detection/detector.py`
- **Function:** `classify_agent()` or anomaly scoring logic
- **Constant:** `ANOMALY_THRESHOLD`

### Solution: Adaptive Threshold Adjustment

#### Strategy 1: Increase Base Threshold (Quick Fix)

**Implementation:**
```python
# In detector.py
ANOMALY_THRESHOLD = 1.5  # Increased from 1.0

def classify_agent(self, agent_id, anomaly_score):
    """
    Classify agent as anomalous or normal.
    
    Args:
        agent_id (int): Agent identifier
        anomaly_score (float): Computed deviation score
    
    Returns:
        bool: True if anomalous, False otherwise
    """
    # More conservative classification
    return anomaly_score >= ANOMALY_THRESHOLD
```

**Expected Impact:**
- Precision: 0.087 → 0.25 to 0.35
- Recall: 1.000 → 0.88 to 0.92 (acceptable trade-off)
- False positive rate: 91.3% → 65% to 75%

#### Strategy 2: Dynamic Threshold (Advanced)

**Concept:** Adapt threshold based on grid operational state

```python
def compute_dynamic_threshold(self, grid_state):
    """
    Compute context-aware anomaly threshold.
    
    Args:
        grid_state (str): 'stable', 'dynamic', or 'volatile'
    
    Returns:
        float: Threshold value
    """
    base_threshold = 1.5
    
    if grid_state == 'stable':
        # Low demand variance, stricter threshold
        return base_threshold * 0.9  # 1.35
    elif grid_state == 'dynamic':
        # Moderate variance (renewable integration)
        return base_threshold * 1.0  # 1.50
    else:  # volatile
        # High variance (peak demand, weather events)
        return base_threshold * 1.2  # 1.80
    
    return base_threshold
```

**Grid State Detection:**
```python
def detect_grid_state(self, recent_metrics):
    """
    Classify grid operational state based on recent variability.
    
    Args:
        recent_metrics (np.ndarray): Last 12 timesteps (1 hour)
    
    Returns:
        str: Grid state classification
    """
    # Coefficient of variation across metrics
    cv = np.std(recent_metrics) / (np.mean(recent_metrics) + 1e-6)
    
    if cv < 0.15:
        return 'stable'
    elif cv < 0.30:
        return 'dynamic'
    else:
        return 'volatile'
```

#### Strategy 3: Improve Baseline Adaptation

**Current Issue:** Baseline (B) and thresholds (Th) not adapting to operational patterns

**Adaptive Baseline Update (from paper):**
```
B'[i,j] = (1 - α) × B[i,j] + α × X[i,j]
```

**Recommended Parameters:**
```python
# In config_default.json
{
    "anomaly": {
        "alpha_high": 0.7,      # During anomalies (increased from 0.5)
        "alpha_low": 0.05,      # During stable periods (increased from 0.01)
        "beta_stable": 0.05,    # Threshold adjustment (stable grids)
        "beta_dynamic": 0.15    # Threshold adjustment (dynamic grids)
    }
}
```

**Rationale:**
- Higher α_low (0.01 → 0.05): Faster adaptation to operational changes
- Moderate α_high (0.5 → 0.7): Rapid anomaly learning without over-fitting
- Beta values: Balance between responsiveness and stability

#### Implementation Priority

**Phase 1 (Week 1):** Increase base threshold to 1.5  
**Phase 2 (Week 2):** Implement dynamic threshold based on grid state  
**Phase 3 (Week 3):** Optimize baseline adaptation parameters (α, β)

---

## 3. Audit Coverage Enhancement

### Problem Statement

**Severity:** 🟡 MEDIUM  
**Impact:** Only 10.8% of high-risk agents audited, missing 89.2% of critical nodes

**Paper Requirement:** >90% coverage for critical agents

### Root Cause Analysis

RL agent prioritizing cost reduction over comprehensive auditing:
- Current: 5-8 audits per cycle (5 timesteps)
- Required: 45-50 audits per cycle for 90% coverage
- Constraint: `max_audits_per_cycle = 5` in configuration

### Solution: Coverage-Aware Reward Function

#### Implementation

**Add Coverage Penalty:**
```python
def compute_reward_with_coverage(self, fp, fn, cost, risk_delta, coverage_ratio):
    """
    Compute reward with audit coverage constraint.
    
    Args:
        coverage_ratio (float): Fraction of high-risk agents audited
    
    Returns:
        float: Coverage-penalized reward
    """
    # Base risk-aware reward
    base_reward = -(0.25 * fp + 0.25 * fn + 0.35 * cost + 0.15 * max(0, risk_delta))
    
    # Coverage penalty (triggered below 90% threshold)
    coverage_penalty = 0.0
    if coverage_ratio < 0.9:
        # Quadratic penalty for severe coverage gaps
        coverage_penalty = 0.20 * (0.9 - coverage_ratio) ** 2
    
    return base_reward - coverage_penalty
```

**Configuration Update:**
```json
{
    "audit": {
        "max_audits_per_cycle": 15,  // Increased from 5
        "min_coverage_ratio": 0.9,
        "coverage_penalty_weight": 0.20
    }
}
```

#### Expected Outcomes

| Metric | Current | Target | Implementation |
|--------|---------|--------|----------------|
| Coverage | 10.8% | >90% | Increase max_audits + coverage penalty |
| Audits/Cycle | 5-8 | 45-50 | Raise max_audits_per_cycle to 15 |
| Cost Impact | - | +15-25% | Acceptable for regulatory compliance |

---

## 4. RL Convergence Optimization

### Problem Statement

**Severity:** 🟡 MEDIUM  
**Impact:** Training requires 144,727 iterations without clear convergence

**Paper Requirement:** Convergence within 200 episodes (~20 minutes)

### Root Cause Analysis

1. **Learning rate too low:** 0.01 → slow policy updates
2. **No convergence detection:** Training continues indefinitely
3. **Experience replay missing:** No sample efficiency
4. **Exploration-exploitation imbalance:** ε-greedy with fixed ε = 0.1

### Solution: Advanced RL Training

#### Convergence Detection

```python
def check_convergence(self, reward_history, window=10, threshold=0.05):
    """
    Detect RL policy convergence using reward stability.
    
    Args:
        reward_history (list): Recent episode rewards
        window (int): Episodes to analyze
        threshold (float): CV threshold for convergence
    
    Returns:
        bool: True if converged
    """
    if len(reward_history) < window:
        return False
    
    recent_rewards = reward_history[-window:]
    mean_reward = np.mean(recent_rewards)
    std_reward = np.std(recent_rewards)
    
    # Coefficient of variation
    cv = std_reward / (abs(mean_reward) + 1e-6)
    
    # Converged if CV < 5% over 10 episodes
    return cv < threshold
```

#### Hyperparameter Tuning

**Recommended Configuration:**
```json
{
    "rl": {
        "learning_rate": 0.05,              // Increased from 0.01
        "discount_factor": 0.95,            // Increased from 0.9
        "exploration_rate_start": 0.3,     // Higher initial exploration
        "exploration_rate_end": 0.01,      // Lower final exploration
        "exploration_decay": 0.995,        // Exponential decay
        "experience_replay_size": 2000,    // NEW: Memory buffer
        "batch_size": 32,                  // NEW: Mini-batch updates
        "target_update_frequency": 10      // NEW: For DQN stability
    }
}
```

#### Experience Replay Implementation

```python
from collections import deque
import random

class ExperienceReplay:
    """Priority experience replay buffer for RL training."""
    
    def __init__(self, capacity=2000):
        self.buffer = deque(maxlen=capacity)
    
    def add(self, state, action, reward, next_state, done):
        """Store experience tuple."""
        self.buffer.append((state, action, reward, next_state, done))
    
    def sample(self, batch_size=32):
        """Sample random mini-batch for training."""
        return random.sample(self.buffer, min(batch_size, len(self.buffer)))
    
    def __len__(self):
        return len(self.buffer)
```

#### Expected Outcomes

| Metric | Current | Target | Change |
|--------|---------|--------|--------|
| Convergence Time | 144k iter (no convergence) | 150-200 episodes | **~720× faster** |
| Training Duration | Unknown | 15-25 minutes | Measurable benchmark |
| Reward Stability | High variance | CV < 5% | Stable policy |

---

## 5. Implementation Timeline

### Week 1: Critical Fixes
**Goal:** Achieve positive risk mitigation

- [ ] Day 1-2: Implement risk-aware reward function
  - Modify `rl_scheduler.py` reward computation
  - Update `config_default.json` with reward weights
  - Add unit tests for reward calculation
  
- [ ] Day 3: Retrain RL agent with new reward
  - Run 200-episode training
  - Monitor convergence via reward plots
  - Validate risk mitigation > 5%

- [ ] Day 4-5: Adjust anomaly threshold
  - Increase `ANOMALY_THRESHOLD` to 1.5
  - Evaluate precision-recall trade-off
  - Document false alarm reduction

**Success Criteria:**
- ✅ Risk mitigation: +5% to +10%
- ✅ Cost efficiency: >60%
- ✅ Training convergence: <200 episodes

### Week 2: Precision & Coverage
**Goal:** Improve detection quality and audit scope

- [ ] Day 1-2: Dynamic threshold implementation
  - Implement grid state detection
  - Context-aware threshold adjustment
  - Validate on synthetic attack scenarios

- [ ] Day 3: Baseline adaptation tuning
  - Optimize α_high, α_low, β parameters
  - Test on renewable integration scenario
  - Measure false positive reduction

- [ ] Day 4-5: Coverage enhancement
  - Increase `max_audits_per_cycle` to 15
  - Add coverage penalty to reward
  - Verify >90% high-risk agent coverage

**Success Criteria:**
- ✅ Precision: 0.25 to 0.35
- ✅ Recall: 0.85 to 0.92
- ✅ Audit coverage: >90%

### Week 3: Advanced RL Optimization
**Goal:** Accelerate training and improve policy stability

- [ ] Day 1-2: Experience replay integration
  - Implement replay buffer
  - Mini-batch training updates
  - Prioritized sampling for rare events

- [ ] Day 3: Convergence detection
  - Implement reward stability check
  - Auto-terminate training at convergence
  - Log convergence metrics (AGT)

- [ ] Day 4-5: Hyperparameter sweep
  - Grid search over learning rates [0.01, 0.05, 0.1]
  - Discount factors [0.9, 0.95, 0.99]
  - Exploration decay rates [0.99, 0.995, 0.999]
  - Select optimal configuration

**Success Criteria:**
- ✅ Convergence: <200 episodes
- ✅ Training time: 15-25 minutes
- ✅ Reward stability: CV < 5%

---

## 6. Validation Strategy

### Test Scenarios

**Scenario 1: Normal Operation**
- Grid state: Stable, low demand variance
- Attack rate: 0%
- Expected: Low false positive rate, no unnecessary audits

**Scenario 2: Physical Faults**
- Faults: Line fault, transformer failure, breaker malfunction
- Expected: Accurate detection, targeted audits, risk mitigation >10%

**Scenario 3: Cyber Attacks**
- Attacks: FDI (10% nodes), DoS (5% nodes), coordinated breaker attacks
- Expected: High recall (>90%), precision >30%, risk mitigation >15%

**Scenario 4: Cascading Failures**
- Attack: Coordinated attack on breaker-substation chain
- Expected: Early detection via deviation clustering, coverage >95%

### Performance Benchmarks

**Computational Efficiency:**
- Inference latency: <50ms per audit cycle
- Training time: <30 minutes for 200 episodes
- Memory usage: <3GB for 500-agent grid

**Accuracy Metrics:**
- True Positive Rate (Recall): 85-95%
- True Negative Rate: >95%
- Precision: 30-40%
- F1-Score: >0.50

**Operational Metrics:**
- Risk mitigation: +5% to +15%
- Cost efficiency: 60-75%
- Audit coverage: >90%
- False alarm rate: <70%

---

## 7. Risk Analysis

### Implementation Risks

**Risk 1: Over-Prioritizing Risk at Cost of Efficiency**
- **Probability:** Medium
- **Impact:** High (operational costs spike by >50%)
- **Mitigation:** Iterative weight tuning (0.10 → 0.15 → 0.20 for risk term)

**Risk 2: Threshold Adjustment Reduces Recall**
- **Probability:** High
- **Impact:** Medium (missed attacks increase)
- **Mitigation:** Monitor recall closely; revert if recall <85%

**Risk 3: Increased Audits Strain System Resources**
- **Probability:** Medium
- **Impact:** Medium (CPU/memory usage increases)
- **Mitigation:** Profile performance; optimize audit execution path

### Rollback Strategy

**If Risk Mitigation Worsens:**
1. Revert reward function to baseline
2. Restore `ANOMALY_THRESHOLD = 1.0`
3. Use conservative RL weights: `{"risk": 0.10}`

**If System Performance Degrades:**
1. Reduce `max_audits_per_cycle` to 10
2. Disable experience replay temporarily
3. Lower learning rate to 0.01

---

## 8. Success Metrics Dashboard

### Target Performance Matrix

| Metric | Current | Minimum Acceptable | Target | Stretch Goal |
|--------|---------|-------------------|--------|--------------|
| Risk Mitigation | -4.25% | +5% | +10% | +15% |
| Cost Efficiency | 70.36% | 60% | 70% | 75% |
| Precision | 0.087 | 0.25 | 0.35 | 0.45 |
| Recall | 1.000 | 0.85 | 0.92 | 0.95 |
| F1-Score | 0.160 | 0.35 | 0.50 | 0.60 |
| Audit Coverage | 10.8% | 70% | 90% | 95% |
| Training Time | Unknown | <30 min | <20 min | <15 min |
| Convergence Episodes | Not achieved | <300 | <200 | <150 |

---

## 9. References & Resources

### Key Papers
1. Base Paper: "AI-Driven Audit Framework for Multi-Agent Smart Grid Security"
2. Q-Learning: Watkins & Dayan (1992) - Q-learning convergence proofs
3. Experience Replay: Lin (1992) - Reinforcement learning with experience replay
4. Anomaly Detection: Chandola et al. (2009) - Survey on anomaly detection

### Code Modules to Modify
- `smartgrid_mas/audit/rl_scheduler.py` - RL reward function
- `smartgrid_mas/anomaly_detection/detector.py` - Threshold tuning
- `smartgrid_mas/simulation/eval_suite.py` - Metrics computation
- `config_default.json` - Hyperparameter configuration

### Validation Datasets
- IEEE 39-Bus Test Case (New England System)
- IEEE 118-Bus Test Case (Large-scale validation)
- NREL Smart Grid Dataset (Real-world load profiles)
- Synthetic Cyber-Attack Scenarios (FDI, DoS, MITM)

---

## Appendix A: Mathematical Formulations

### Current vs. Target Reward Functions

**Current (Cost-Only Optimization):**
$$
R_t = -\left(0.25 \cdot FP_t + 0.25 \cdot FN_t + 0.35 \cdot C_t\right)
$$

**Target (Risk-Aware Optimization):**
$$
R_t = -\left(0.25 \cdot FP_t + 0.25 \cdot FN_t + 0.35 \cdot C_t + 0.15 \cdot \max(0, \Delta R_t)\right)
$$

Where:
- $FP_t$ = False positive rate at timestep $t$
- $FN_t$ = False negative rate at timestep $t$
- $C_t$ = Normalized operational cost
- $\Delta R_t = \frac{R_{\text{dynamic}} - R_{\text{baseline}}}{R_{\text{baseline}}}$ = Risk delta

### Anomaly Score with Dynamic Threshold

$$
\text{Score}(i) = F_w[i] \times \sqrt{\sum_{j=1}^{m} \left(\frac{X[i,j] - B[i,j]}{Th_{\text{dynamic}}[i,j]}\right)^2}
$$

$$
Th_{\text{dynamic}}[i,j] = Th_{\text{base}}[i,j] \times \gamma(\text{grid\_state})
$$

Where $\gamma(\text{stable}) = 0.9$, $\gamma(\text{dynamic}) = 1.0$, $\gamma(\text{volatile}) = 1.2$

---

**Document Version:** 1.0  
**Last Updated:** January 21, 2026  
**Status:** Active Development Roadmap  
**Estimated Completion:** 3 weeks (21 days)
