# Smart Grid Multi-Agent Audit Framework - Detailed Project Report

Date: March 7, 2026
Project: smartgrid-audit-base-
Domain: Cyber-Physical Security for Smart Grid Multi-Agent Systems (MAS)

---

## 1) Executive Summary

This project implements an AI-driven adaptive audit framework for distributed smart grid MAS under cyber-physical threats. The system combines anomaly detection, behavior analysis, reinforcement learning (RL), and gradient-based optimization to schedule audits dynamically instead of using fixed-frequency audits.

Current implementation is strong in detection and attack-rate reduction, but it is currently underperforming on the cost-risk tradeoff target when compared against paper benchmarks for risk mitigation and cost efficiency balance. The framework is operational, reproducible, and ready for algorithmic improvements.

---

## 2) Problem Statement and Objectives

Modern smart grids are vulnerable to attacks that propagate across physical, cyber, and communication layers. Static audits are either too costly or too slow.

Primary objectives:

1. Detect anomalies in real time with high accuracy.
2. Minimize attack rate and cascading risk.
3. Optimize audit cost while maintaining security performance.
4. Scale to larger MAS deployments (N=100, 200, 500+).

Research objective:

Beat baseline paper-level performance by improving both security and economics simultaneously:

- Cost efficiency target: around 50% (user-requested operating point for next phase)
- Risk mitigation target: positive and strong
- Precision target: improve above current low values

---

## 3) System Architecture

The project follows a layered smart-grid MAS model:

1. Physical layer
   - Generator agents
   - Breaker agents
   - PMU agents
   - Substation entities

2. Cyber layer
   - Monitoring and control signals
   - Audit decision logic
   - Learning and adaptation pipeline

3. Communication layer
   - Inter-agent data exchange
   - Attack simulation channels (FDI, DoS, coordinated chain)

End-to-end control loop:

Observe -> Detect -> Analyze -> Schedule -> Constrain/Allocate -> Execute audits -> Feedback update

---

## 4) Methodology

### 4.1 Data and State Formation

At each timestep, each agent contributes operational features (physical and cyber indicators) and history windows for anomaly inference.

### 4.2 Anomaly Detection

- LSTM-based detector with sliding historical window.
- Outputs anomaly probability and anomaly flags.
- Combined with deviation checks and risk scoring.

### 4.3 Behavior Analysis

- Baseline tracking and update
- Deviation score computation
- Trend clustering (k-means)
- Composite risk score per agent

### 4.4 Audit Scheduling

Hybrid scheduler:

1. RL stage (Q-learning)
   - State encoding from risk and behavior signals
   - Action space: decrease, hold, increase audit frequency
   - Bellman updates with replay and epsilon-decay policy

2. Gradient stage
   - Frequency refinement over cost-risk objective
   - Iterative updates per cycle

3. Constraint/allocation stage
   - Frequency bounds
   - Capacity and/or budget controls
   - Risk-priority allocation

### 4.5 Response and Feedback

- Audits can reduce active malicious states.
- Risk and behavior states are fed back into next decision cycle.

---

## 5) Core Algorithms and Equations

### 5.1 Attack Rate

R_attack = (sum_i a_i) / N

where a_i in {0,1} is the anomaly/attack indicator.

### 5.2 Cost Objective (conceptual)

C_total = C_audit + C_failure

Typical form used in scheduler/reward design:

C_audit proportional to audit_frequency

C_failure proportional to risk/frequency and missed-threat effects

### 5.3 RL Update

Q(s,a) <- Q(s,a) + alpha [ r + gamma max_a' Q(s',a') - Q(s,a) ]

### 5.4 Gradient-Based Frequency Refinement

f_i^(k+1) = f_i^k - eta * dC/df_i

### 5.5 Risk Mitigation Metric

RiskMitigation = (Risk_baseline - Risk_dynamic) / Risk_baseline

Positive values indicate dynamic policy is reducing risk relative to baseline.

---

## 6) Implementation Details

Project implementation is modular:

- Orchestration and experiment runner
- Agent models
- Anomaly detection module
- Behavior analysis module
- Audit module (RL + gradient + constraints)
- Environment and reward function
- Simulation and metrics export
- Validation and reporting scripts

Representative key files:

- smartgrid_mas/run_all.py
- smartgrid_mas/simulation/run_simulation.py
- smartgrid_mas/audit/audit_scheduler_rl.py
- smartgrid_mas/audit/hybrid_scheduler.py
- smartgrid_mas/audit/constraints.py
- smartgrid_mas/environment/reward_function.py

---

## 7) Datasets and Data Sources

The project uses a mix of synthetic and benchmark-inspired smart-grid data pipelines as documented in project references.

Planned/used categories:

1. Operational smart-grid signals
   - Voltage, current, frequency, power-related traces

2. Cyber event streams
   - Malicious flags, communication anomalies

3. Attack injection scenarios
   - FDI
   - DoS
   - Coordinated chain tampering

4. Public benchmark alignment references
   - IEEE-style test-case conventions
   - Smart-grid stability datasets (as referenced in project docs)

---

## 8) Experimental Setup

Current standard experiment profile:

- N-sweep: N = 100, 200, 500
- 24-hour equivalent cycle with 288 steps
- Attack scenarios enabled each cycle
- Dynamic run vs baseline run
- Reproducibility via fixed seed

---

## 9) Metrics Used

### 9.1 Detection Metrics

- Precision
- Recall
- F1-score
- TPR, TNR, FPR
- Accuracy

### 9.2 Security and Risk Metrics

- Attack Rate (dynamic and baseline)
- Attack Rate Reduction
- Mean Risk (dynamic and baseline)
- Risk Mitigation
- Risk Reduced per dollar

### 9.3 Audit and Cost Metrics

- Audit coverage (dynamic and baseline)
- Executed cost (dynamic and baseline)
- Intended cost (dynamic and baseline)
- Cost efficiency

### 9.4 Optimization/Convergence Metrics

- RL iterations
- Gradient iterations

---

## 10) Current Results Snapshot (Latest N-Sweep)

From latest run summary provided in terminal logs:

### N=100
- Attack Rate Reduction: 33.52%
- Precision: 0.2402
- Recall: 1.000
- Accuracy: 0.995
- Risk Mitigation: -1.08%
- Cost Efficiency: 90.00%

### N=200
- Attack Rate Reduction: 32.11%
- Precision: 0.2269
- Recall: 1.000
- Accuracy: 0.995
- Risk Mitigation: -5.98%
- Cost Efficiency: 90.00%

### N=500
- Attack Rate Reduction: 33.00%
- Precision: 0.2145
- Recall: 1.000
- Accuracy: 0.995
- Risk Mitigation: -4.63%
- Cost Efficiency: 90.00%

### Interpretation

Strengths:
- Excellent recall and high accuracy
- Strong attack-rate reduction
- Stable seed robustness on several metrics

Gaps:
- Risk mitigation remains negative
- Precision is low relative to target
- Cost efficiency fixed at 90% indicates policy over-optimization toward spending suppression (not desired operating point)

---

## 11) What We Want Implemented Next (Implementation Roadmap)

This section defines the concrete improvements to implement in this project to beat paper-level outcomes.

### 11.1 Immediate (Phase A - control operating point)

1. No-hard-constraint mode for experiments
   - Allow unconstrained policy behavior for ablation
   - Disable hard budget truncation for dedicated runs

2. Budget operating-point control
   - Set default target spend profile to reach around 50% cost efficiency (user requirement)
   - Keep reproducible override through config/env

3. Reward-function cleanup and consistency
   - Ensure audit and failure terms are consistently weighted
   - Remove debug-output side effects that break Windows terminals

### 11.2 Performance (Phase B - improve risk and precision)

4. Risk-sensitive action penalties
   - Penalize frequency drops on high-risk states more sharply
   - Increase reward for proactive response to rising risk clusters

5. Precision improvement path
   - Calibrate anomaly thresholding and post-filtering
   - Add confidence-aware triage so high recall is preserved while reducing false positives

6. Multi-objective training schedule
   - Curriculum from security-first to cost-balanced regime
   - Tune exploration decay and replay weighting by risk strata

### 11.3 Architecture Upgrades (Phase C - beat paper robustly)

7. Hierarchical audit policy
   - Global controller allocates regional budget
   - Local agent policies perform fine-grained scheduling

8. Distributionally robust objective
   - Optimize for worst-case attack windows, not only average outcome

9. Safety-constrained RL or CMDP-style optimization
   - Hard safety targets plus soft cost objective to prevent collapse into under-auditing behavior

### 11.4 Validation and Reporting (Phase D)

10. Full N-sweep with ablation matrix
    - Constraint on/off
    - Reward variants
    - Threshold variants

11. Seed robustness with confidence intervals

12. Final thesis-grade report pack
    - Methods, equations, reproducibility commands
    - Comparative tables and plots

---

## 12) Reproducibility and Quality Controls

- Deterministic seed path exists in runner
- Logs and summaries generated per N
- Validation scripts available in repository
- Versioned docs and audit reports exist

Known operational issue fixed in current cycle:
- Windows cp1252 crash due to emoji debug print in reward function output has been removed/gated.

---

## 13) Risk Register

1. Over-constrained scheduler can force artificial cost efficiency but degrade risk outcomes.
2. Precision-recall imbalance can hide practical false-positive burden.
3. Metric definitions must remain consistent across runs for fair comparisons.
4. Reward-function changes require full retraining and clean-run validation.

---

## 14) Conclusion

The project is already strong in detection robustness and attack-rate suppression, but current optimization is not yet aligned with the desired security-economics operating point.

Immediate target for next validated run:
- Cost efficiency near 50% (as requested)
- Positive and meaningful risk mitigation
- Improved precision while keeping high recall

With the planned roadmap above, the framework can move from paper replication toward paper-beating performance with defensible methodology and reproducible evidence.
