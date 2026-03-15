# Thesis Runtime Code Reference (Master File)

Date: March 7, 2026  
Project: smartgrid-audit-base-  
Purpose: Single-file code reference of the important runtime code paths used in this project

---

## A) References Used for This Compilation

These files were used as source-of-truth references while preparing this master runtime code file:

1. PROJECT_DETAILED_REPORT.md
2. TECHNICAL_SPECIFICATION.md
3. PAPER_COMPARISON_CHECKLIST.md
4. logs/fix_test.txt
5. smartgrid_mas/run_all.py
6. smartgrid_mas/simulation/run_simulation.py
7. smartgrid_mas/simulation/run_baseline_fixed.py
8. smartgrid_mas/audit/hybrid_scheduler.py
9. smartgrid_mas/audit/schedule_step.py
10. smartgrid_mas/audit/constraints.py
11. smartgrid_mas/environment/reward_function.py
12. smartgrid_mas/behavior_analysis/scoring_pipeline.py
13. smartgrid_mas/behavior_analysis/behavior_pipeline.py
14. smartgrid_mas/anomaly_detection/inference.py
15. smartgrid_mas/simulation/metrics.py
16. smartgrid_mas/simulation/eval_suite.py
17. smartgrid_mas/audit/gradient_step.py
18. smartgrid_mas/config/global_config.yaml
19. smartgrid_mas/__main__.py
20. run_experiment.py

---

## B) Main Run Commands (What Actually Executes)

```bash
python -m smartgrid_mas.run_all
```

```bash
python run_experiment.py
```

Optional environment controls used by runtime:

```bash
SMARTGRID_AUDIT_BUDGET_RATIO
SMARTGRID_DISABLE_CONSTRAINTS
SMARTGRID_SWEEP
SMARTGRID_ABLATION
SMARTGRID_RW_ATTACK
SMARTGRID_RW_AUDIT
SMARTGRID_RW_DEBUG
```

---

## C) Entry Point Code

### File: smartgrid_mas/__main__.py

```python
"""
Module entry point for smartgrid_mas package.

Supports: python -m smartgrid_mas.run_all
"""
import sys

if __name__ == "__main__":
    # Handle python -m smartgrid_mas.run_all
    from smartgrid_mas.run_all import main
    main()
```

---

## D) Orchestrator (Primary Runtime Controller)

### File: smartgrid_mas/run_all.py

#### D.1 Top-level configuration and imports

```python
from smartgrid_mas.simulation.run_simulation import run_simulation_24h
from smartgrid_mas.simulation.run_baseline_fixed import run_fixed_audit_24h
from smartgrid_mas.simulation.eval_suite import build_summary
from smartgrid_mas.simulation.export import export_records_csv

SEED = 42
CONFIG_PATH = os.environ.get('SMARTGRID_CONFIG', "smartgrid_mas/config/global_config.yaml")
LSTM_MODEL_PATH = "smartgrid_mas/data/anomaly_inputs/lstm.pt"

# Default 0.50 targets ~50% executed cost efficiency
AUDIT_BUDGET_RATIO = _env_float("SMARTGRID_AUDIT_BUDGET_RATIO", 0.50)
MAX_AUDITS_PER_CYCLE = _env_int("SMARTGRID_MAX_AUDITS_PER_CYCLE", 100)
RISK_THRESHOLD = _env_float("SMARTGRID_RISK_THRESHOLD", 0.5)
```

#### D.2 Dynamic + baseline execution

```python
def run_all_simulations(...):
    attack_cfg, fault_cfg = create_attack_and_fault_configs()
    effective_budget_ratio = n_specific_budget_ratio if n_specific_budget_ratio is not None else AUDIT_BUDGET_RATIO

    scheduler = QLearningAuditScheduler(gamma=RL_GAMMA, alpha=RL_ALPHA)
    scheduler.epsilon = RL_EPSILON_START
    scheduler.epsilon_min = RL_EPSILON_MIN
    scheduler.epsilon_decay = RL_EPSILON_DECAY

    checkpoint_path = "logs/rl_scheduler_checkpoint.json"
    scheduler.load_checkpoint(checkpoint_path)

    total_agents = n_agents if n_agents is not None else len(agents_dyn)
    scaled_operational_cost = 5.75 * float(total_agents)
    dynamic_cap = int(total_agents * int(config["audit"]["f_max"]))

    dyn_metrics, dyn_events, y_true_dyn, y_pred_dyn, y_pred_types_dyn, y_true_types_dyn, initial_risk_dyn, final_risk_dyn, conv_info_dyn = run_simulation_24h(
        agents=agents_dyn,
        lstm_infer=lstm_infer,
        audit_budget_ratio=effective_budget_ratio,
        risk_threshold=RISK_THRESHOLD,
        max_audits_per_cycle=dynamic_cap,
        f_min=int(config["audit"]["f_min"]),
        f_max=int(config["audit"]["f_max"]),
        audit_cost_per_audit=1.0,
        operational_cost=scaled_operational_cost,
        C_a=1.0,
        C_f=100.0,
        grad_lr=GRADIENT_LR,
        scheduler=scheduler,
        ablation_mode=ablation_mode,
        scenario_fdi_rate=FDI_RATE,
        scenario_dos_rate=DOS_RATE,
        scenario_chain_rate=CHAIN_RATE,
        scenario_fault_rate=FAULT_RATE,
        attack_cfg=attack_cfg,
        fault_cfg=fault_cfg,
    )

    base_metrics, base_events, _, _, _, _, _ = run_fixed_audit_24h(
        agents=agents_base,
        lstm_infer=lstm_infer,
        fixed_f=BASELINE_FIXED_F,
        audit_cost_per_audit=1.0,
        operational_cost=scaled_operational_cost,
        attack_cfg=attack_cfg,
        fault_cfg=fault_cfg,
    )

    return (...)
```

#### D.3 Main runtime loop

```python
def main() -> None:
    set_seeds(SEED)
    validate_and_setup_environment(logger)
    config = load_config(CONFIG_PATH)
    train_lstm_if_needed(logger, config)
    lstm_infer = load_lstm_model(logger, config)

    sweep = [100, 200, 500]
    for n_agents in sweep:
        agents_dyn = build_agent_pool(n_agents, seed=current_seed)
        agents_base = build_agent_pool(n_agents, seed=current_seed)

        dyn_metrics, dyn_events, base_metrics, base_events, ... = run_all_simulations(...)

        summary = compute_evaluation_metrics(...)
        export_all_results(...)
        print_summary_report(summary, logger)

    print_compact_sweep_table(all_summaries, logger)
```

---

## E) Core Simulation Loop

### File: smartgrid_mas/simulation/run_simulation.py

```python
def run_simulation_24h(...):
    steps = int((cycle_hours * 60) / timestep_minutes)

    scenario = ScenarioEngine(
        agents,
        ScenarioConfig(seed=42, fdi_rate=scenario_fdi_rate, dos_rate=scenario_dos_rate, chain_rate=scenario_chain_rate, fault_rate=scenario_fault_rate),
    )

    metrics = MetricsLogger()
    ledger = AuditLedger()
    scheduler = scheduler or QLearningAuditScheduler(gamma=0.9, alpha=0.1)
    env = GridEnvironment(agents, env_cfg, scenario=scenario, attack_cfg=attack_cfg, fault_cfg=fault_cfg)

    for t in range(steps):
        # 1) Observe
        obs, truth = env.step(t)

        # 2) LSTM batch inference
        probs = lstm_infer.predict_proba_batch(windows)

        # 3) Score and anomaly flags
        compute_score_and_flag(...)

        # 4) Behavior update
        behavior_update(...)

        # 5) Trend clustering
        labels = cluster_agents_trends(...)
        assign_cluster_labels(...)

        # 6) Hybrid scheduling
        actions, rewards, freqs, state_before, constraint_stats = hybrid_audit_schedule(...)

        # 7) Execute audits + post-outcome RL update
        audited_ids = execute_audits(...)
        rl_post_audit_update(...)

        # 8) Response mechanism and logging
        response_step(...)
        metrics.log_step(...)

    return metrics.records, event_log, y_true, y_pred, y_pred_types, y_true_types, initial_system_risk, final_system_risk, convergence_info
```

---

## F) Baseline Simulation (Fixed Frequency)

### File: smartgrid_mas/simulation/run_baseline_fixed.py

```python
def run_fixed_audit_24h(...):
    for t in range(steps):
        for a in agents:
            a.set_audit_frequency(fixed_f, f_min=1, f_max=5)

        obs, truth = env.step(t)
        st.anomaly_prob = lstm_infer.predict_proba(feat)
        compute_score_and_flag(...)
        behavior_update(...)

        audited_ids = execute_audits(...)
        response_step(...)
        metrics.log_step(...)

    return metrics.records, event_log, y_true, y_pred, initial_system_risk, final_system_risk, convergence_info
```

---

## G) Hybrid Scheduler (RL + Gradient + Constraints)

### File: smartgrid_mas/audit/hybrid_scheduler.py

```python
def hybrid_audit_schedule(...):
    # Stage 1: RL directional decisions
    if ablation_mode in ['HYBRID', 'RL_ONLY']:
        actions, rewards, _, state_before = rl_schedule_step(...)

    # Stage 2: Gradient refinement
    if ablation_mode in ['HYBRID', 'GRADIENT_ONLY']:
        _ = gradient_opt_step(...)

    # Stage 3: Global constraints
    freqs, constraint_stats = enforce_audit_constraints(..., return_stats=True)

    return actions, rewards, freqs, state_before, constraint_stats
```

---

## H) RL Scheduling Step

### File: smartgrid_mas/audit/schedule_step.py

```python
def rl_schedule_step(...):
    for agent in agents:
        s = scheduler.encoder.encode(risk=st.risk_score, anomaly_prob=st.anomaly_prob, cluster_label=st.cluster_label)
        act = scheduler.select_action(s)
        new_f = apply_action_to_frequency(agent.audit_frequency, act, f_min, f_max)
        agent.set_audit_frequency(new_f, f_min, f_max)

        r = compute_reward(
            st,
            act,
            risk_threshold=risk_threshold,
            mean_baseline_delta=mean_baseline_delta,
            attacks_stopped=attacks_stopped,
            audit_cost=agent_audit_cost,
            over_budget_excess=over_budget_excess,
            prev_risk=prev_risk,
            budget_utilization=budget_utilization,
            num_agents=len(agents),
            system_c_failure=system_c_failure,
        )

        s_next = scheduler.encoder.encode(...)
        scheduler.update(s, act, r, s_next)

    scheduler.decay_epsilon()
    freqs = enforce_audit_constraints(...)
    return actions, rewards, freqs, state_before
```

---

## I) Constraints Engine

### File: smartgrid_mas/audit/constraints.py

```python
def enforce_audit_constraints(...):
    for agent in agents:
        agent.set_audit_frequency(agent.audit_frequency, f_min=f_min, f_max=f_max)

    disable_constraints = (
        os.environ.get("SMARTGRID_DISABLE_CONSTRAINTS", "1").strip().lower() in {"1", "true", "yes", "on"}
        or str(ablation_mode).upper() == "NO_CONSTRAINTS"
    )
    if disable_constraints:
        freqs = {agent.agent_id: agent.audit_frequency for agent in agents}
        return freqs  # or (freqs, stats)

    requested_raw = sum(agent.audit_frequency for agent in agents)
    budget_allowed = float(budget_ratio * operational_cost)
    max_by_budget = int(budget_allowed // effective_audit_cost)
    allowed_total = max(0, min(requested_raw, dynamic_max_audits, max_by_budget))

    for agent in agents_by_priority:
        is_high_risk = agent.last_state and agent.last_state.risk_score > 0.75
        forced_minimum = 2 if is_high_risk else f_min
        ...
        agent.set_audit_frequency(grant, f_min=0, f_max=f_max)

    return freqs
```

---

## J) Reward Function

### File: smartgrid_mas/environment/reward_function.py

```python
@dataclass
class RewardWeights:
    lambda_attack: float = float(os.environ.get("SMARTGRID_RW_ATTACK", 10.0))
    lambda_audit: float = float(os.environ.get("SMARTGRID_RW_AUDIT", 0.05))
    lambda_stability: float = float(os.environ.get("SMARTGRID_RW_STABILITY", 0.1))
    bonus_react: float = float(os.environ.get("SMARTGRID_RW_BONUS", 2.0))
    lambda_quadratic_risk: float = float(os.environ.get("SMARTGRID_RW_QUADRATIC", 5.0))
    high_risk_threshold: float = float(os.environ.get("SMARTGRID_RW_HIGH_RISK_TH", 0.75))
```

```python
def compute_reward(...):
    if mean_baseline_delta > 5.0:
        return -500.0 - (mean_baseline_delta * 10.0)

    estimated_fp, estimated_fn = 0.0, 0.0
    if st.risk_score < 0.3 and action == AuditAction.INC:
        estimated_fp = 1.0
    elif st.risk_score > 0.7 and action == AuditAction.DEC:
        estimated_fn = 1.0

    alpha_1 = weights.lambda_audit
    alpha_2 = weights.lambda_attack
    det_penalty = (alpha_1 * estimated_fp) + (alpha_2 * estimated_fn)

    c_audit = weights.lambda_audit * max(0.0, float(audit_cost))
    f_eff = max(1.0, float(st.audit_frequency))
    r_over_f = float(st.risk_score) / f_eff
    c_failure = weights.lambda_attack * r_over_f

    quadratic_penalty = 0.0
    if st.risk_score > weights.high_risk_threshold and st.audit_frequency < 2:
        risk_excess = st.risk_score - weights.high_risk_threshold
        freq_deficit = 2 - st.audit_frequency
        quadratic_penalty = weights.lambda_quadratic_risk * (risk_excess ** 2) * freq_deficit

    c_failure = c_failure + quadratic_penalty
    stability_penalty = weights.lambda_stability * max(0.0, float(mean_baseline_delta))

    react_bonus = weights.bonus_react if st.risk_score >= risk_threshold and action == AuditAction.INC else 0.0
    detect_bonus = 0.25 * float(attacks_stopped) if attacks_stopped > 0 else 0.0

    total_cost = c_audit + c_failure + stability_penalty
    reward = -total_cost - det_penalty + react_bonus + detect_bonus
    return float(reward)
```

---

## K) Anomaly Inference (LSTM)

### File: smartgrid_mas/anomaly_detection/inference.py

```python
class LSTMInferencer:
    def __init__(...):
        ckpt = torch.load(model_path, map_location=self.device)
        ...
        self.model = LSTMAnomalyDetector(...).to(self.device)
        self.model.load_state_dict(state_dict)
        self.model.eval()

    @torch.no_grad()
    def predict_proba(self, window_feat: np.ndarray) -> float:
        x = torch.from_numpy(arr).unsqueeze(0).to(self.device)
        logits, probs = self.model(x)
        return float(probs[0].item())

    @torch.no_grad()
    def predict_proba_batch(self, window_feats: List[np.ndarray]) -> List[float]:
        x = torch.from_numpy(np.stack(arrs, axis=0)).to(self.device)
        logits, probs = self.model(x)
        return [float(p.item()) for p in probs]
```

---

## L) Score + Flag Pipeline

### File: smartgrid_mas/behavior_analysis/scoring_pipeline.py

```python
def compute_score_and_flag(agent: BaseAgent, st: AgentState) -> AgentState:
    k_sigma = float(os.environ.get("SMARTGRID_THRESHOLD_K", 4.0))
    sigma_window = int(os.environ.get("SMARTGRID_THRESHOLD_WINDOW", 24))

    sigma_x = np.std(hx, axis=0)
    sigma_y = np.std(hy, axis=0)
    floor_x = np.maximum(k_sigma * sigma_x, 1e-6)
    floor_y = np.maximum(k_sigma * sigma_y, 1e-6)

    agent.thx = np.maximum(agent.thx, floor_x)
    agent.thy = np.maximum(agent.thy, floor_y)

    s = deviation_score(...)

    score_threshold = float(os.environ.get("SMARTGRID_SCORE_THRESHOLD", 4.0))
    prob_threshold = float(os.environ.get("SMARTGRID_ANOMALY_PROB_THRESHOLD", 0.999))

    a = anomaly_flag_from_score(s, threshold=score_threshold)
    if not a and st.anomaly_prob is not None and float(st.anomaly_prob) >= prob_threshold:
        a = 1

    st.deviation_score = s
    st.anomaly_flag = a
    st.risk_score = agent.update_risk_score_from_flag(a)
    return st
```

---

## M) Behavior Update Pipeline

### File: smartgrid_mas/behavior_analysis/behavior_pipeline.py

```python
def behavior_update(agent: BaseAgent, st: AgentState, alpha_low=0.1, alpha_high=0.7, beta=0.1, th_min=1e-3, th_max=1e6):
    update_agent_baselines(agent, st, alpha_low=alpha_low, alpha_high=alpha_high)
    update_agent_thresholds(agent, st, beta=beta, th_min=th_min, th_max=th_max)
```

---

## N) Gradient Optimization

### File: smartgrid_mas/audit/gradient_step.py

```python
def gradient_opt_step(agents, C_a, C_f, lr=0.01, f_min=1, f_max=5, tracker=None):
    for agent in agents:
        if agent.last_state is None:
            continue
        R_i = float(agent.last_state.risk_score)
        f_old = agent.audit_frequency
        f_new = gradient_update_frequency(f_i=f_old, R_i=R_i, C_a=C_a, C_f=C_f, lr=lr, f_min=f_min, f_max=f_max)
        agent.set_audit_frequency(f_new, f_min=f_min, f_max=f_max)
```

---

## O) Metrics Logger (Per-Timestep Runtime Signals)

### File: smartgrid_mas/simulation/metrics.py

```python
class MetricsLogger:
    def log_step(self, t, agents, audit_cost_per_audit, ledger=None, budget=None, truth=None, outcomes=None, constraint_stats=None):
        attack_rate = anomalous_flags / n
        mean_dev = dev_sum / n
        global_risk, components = compute_global_risk(agents)
        intended_spend = freq_sum * audit_cost_per_audit

        if ledger is not None:
            audits_executed = len([e for e in ledger.events if e.t == t])
            total_spend = float(ledger.total_spend)
            coverage = float(ledger.coverage(n))

        self.records.append({...})
```

---

## P) Evaluation + Summary Builder

### File: smartgrid_mas/simulation/eval_suite.py

```python
def attack_rate_reduction(dynamic_records, baseline_records):
    baseline = mean_attack_rate(baseline_records)
    dynamic = mean_attack_rate(dynamic_records)
    return (baseline - dynamic) / baseline if baseline else 0.0


def cost_efficiency(dynamic_cost, baseline_cost):
    return (baseline_cost - dynamic_cost) / baseline_cost if baseline_cost else 0.0


def prf1(y_true, y_pred):
    tp = ...
    fp = ...
    fn = ...
    precision = tp / (tp + fp)
    recall = tp / (tp + fn)
    f1 = 2 * (precision * recall) / (precision + recall)
    return {"precision": precision, "recall": recall, "f1": f1}
```

---

## Q) Runtime Configuration

### File: smartgrid_mas/config/global_config.yaml

```yaml
simulation:
  timestep_minutes: 5
  cycle_hours: 24
  seed: 42

audit:
  risk_threshold: 0.5
  audit_budget_ratio: 0.10
  max_audits_per_cycle: 100
  f_min: 1
  f_max: 5

thresholds:
  k_sigma: 4.0
  score_threshold: 4.0
  prob_threshold: 0.999

rl:
  gamma: 0.9
  epsilon_start: 1.0
  epsilon_min: 0.05
  epsilon_decay: 0.995
  learning_rate: 0.4

gradient:
  lr: 0.01
  max_iters: 200
```

---

## R) Alternate Runner Script

### File: run_experiment.py

```python
from smartgrid_mas.pipeline import Pipeline

pipeline = Pipeline(config_path=args.config)
results = pipeline.run(modes=modes)
```

This script is an alternate interface. The primary thesis runs currently use:

```bash
python -m smartgrid_mas.run_all
```

---

## S) Notes for Thesis Use

1. This file captures the important runtime path code used by the project.
2. For full source (complete implementations), use the file paths above directly in the repo.
3. Current active control points for optimization experiments:
   - smartgrid_mas/environment/reward_function.py
   - smartgrid_mas/audit/constraints.py
   - smartgrid_mas/run_all.py

---

## T) Current Important Fixes Included

- Budget ratio default in orchestrator tuned toward 50% target operating point.
- No-constraints mode support added in constraint engine via SMARTGRID_DISABLE_CONSTRAINTS.
- Reward debug output gated and ASCII-safe (Windows terminal safe).

---

End of master runtime code reference.
