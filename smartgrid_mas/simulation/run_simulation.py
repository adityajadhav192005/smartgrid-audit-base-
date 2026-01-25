"""
Full 24-hour simulation loop - End-to-End pipeline

Connects all 9 framework components:
1. Data Collection (environment observations)
2. LSTM anomaly probability inference
3. Deviation scoring + anomaly flagging
4. Baseline refinement + threshold adjustment
5. Trend clustering (K-Means)
6. Hybrid audit scheduling (RL + Gradient + Constraints)
7. Response mechanism + risk feedback
8. Metrics logging

Paper alignment: Complete closed-loop adaptive audit system.
"""

from __future__ import annotations
from typing import List, Dict, Any, Tuple
import logging
import numpy as np
import time

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.environment.grid_env import GridEnvironment, GridEnvConfig
from smartgrid_mas.environment.scenario_engine import ScenarioEngine, ScenarioConfig
from smartgrid_mas.data.cyber_attacks import AttackConfig
from smartgrid_mas.data.synthetic_faults import FaultConfig, FaultType
from smartgrid_mas.behavior_analysis.scoring_pipeline import compute_score_and_flag
from smartgrid_mas.behavior_analysis.behavior_pipeline import behavior_update
from smartgrid_mas.behavior_analysis.trend_clustering import cluster_agents_trends, assign_cluster_labels
from smartgrid_mas.audit.audit_scheduler_rl import QLearningAuditScheduler
from smartgrid_mas.audit.hybrid_scheduler import hybrid_audit_schedule
from smartgrid_mas.audit.gradient_step import GradientTracker
from smartgrid_mas.audit.audit_ledger import AuditLedger
from smartgrid_mas.audit.audit_executor import execute_audits, AuditExecConfig
from smartgrid_mas.audit.audit_validator import evaluate_audit_outcome
from smartgrid_mas.audit.schedule_step import rl_post_audit_update
from smartgrid_mas.response.response_controller import response_step
from smartgrid_mas.simulation.metrics import MetricsLogger
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer, concat_xy_window

logger = logging.getLogger(__name__)


def run_simulation_24h(
    agents: List[BaseAgent],
    lstm_infer: LSTMInferencer,
    timestep_minutes: int = 5,
    cycle_hours: int = 24,
    # audit params
    risk_threshold: float = 0.5,
    audit_budget_ratio: float = 0.10,
    max_audits_per_cycle: int = 5,
    f_min: int = 0,
    f_max: int = 5,
    audit_cost_per_audit: float = 1.0,
    operational_cost: float = 100.0,
    # behavior params
    alpha_low: float = 0.1,
    alpha_high: float = 0.7,
    beta: float = 0.1,
    # clustering
    cluster_k: int = 3,
    cluster_window: int = 50,
    # gradient params
    C_a: float = 1.0,
    C_f: float = 10.0,
    grad_lr: float = 0.01,
    # RL
    scheduler: QLearningAuditScheduler | None = None,
    # Ablation mode: 'HYBRID' (default), 'RL_ONLY', or 'GRADIENT_ONLY'
    ablation_mode: str = 'HYBRID',
    # Scenario rates
    scenario_fdi_rate: float = 0.10,
    scenario_dos_rate: float = 0.05,
    scenario_chain_rate: float = 0.05,
    scenario_fault_rate: float = 0.05,
    # Attack/fault magnitude configs
    attack_cfg: AttackConfig | None = None,
    fault_cfg: FaultConfig | None = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[int], List[int], List[str], float, float, Dict[str, Any], Dict[str, Any]]:
    """
    Run full 24-hour simulation cycle with all framework components.
    
    Pipeline per timestep:
    1. Environment generates observations
    2. Agents observe + LSTM predicts anomaly probability
    3. Deviation scoring + anomaly flagging
    4. Baseline/threshold updates (behavior analysis)
    5. Trend clustering (K-Means) after warmup period
    6. Hybrid audit scheduling (RL + Gradient + Constraints)
    7. Response mechanism executes + feedback to risk
    8. Metrics logged
    
    Args:
        agents: List of BaseAgent instances
        lstm_infer: Trained LSTM model for anomaly detection
        timestep_minutes: Timestep size (paper: 5 minutes)
        cycle_hours: Simulation duration (paper: 24 hours)
        risk_threshold: Risk threshold for audit selection
        audit_budget_ratio: Max audit budget as fraction of agents
        max_audits_per_cycle: Maximum audits per timestep
        f_min, f_max: Audit frequency bounds
        audit_cost_per_audit: Cost per audit (C_a)
        operational_cost: Base operational cost
        alpha_low, alpha_high: Baseline smoothing factors
        beta: Threshold adjustment rate
        cluster_k: Number of clusters for K-Means
        cluster_window: Timesteps needed before clustering
        C_a, C_f: Cost coefficients for gradient optimization
        grad_lr: Gradient descent learning rate (paper: 0.01)
        scheduler: Q-learning scheduler (created if None)
    
    Returns:
        (metrics_records, event_log, y_true, y_pred, initial_risk, final_risk, convergence_info): Per-timestep metrics, events, ground truth/predictions for PRF1, initial/final system risk, and convergence tracking data
    """
    steps = int((cycle_hours * 60) / timestep_minutes)
    # Adaptive clustering cadence to match horizon
    cluster_window_eff = min(cluster_window, max(5, steps // 2 if steps > 1 else 1))
    cluster_period = 10 if steps >= 30 else max(1, steps // 3)
    # Paper scenarios: configurable rates (defaults: FDI 10%, DoS 5%, chain 5%, faults 5%)
    scenario = ScenarioEngine(
        agents,
        ScenarioConfig(
            seed=42,
            fdi_rate=scenario_fdi_rate,
            dos_rate=scenario_dos_rate,
            chain_rate=scenario_chain_rate,
            fault_rate=scenario_fault_rate,
        ),
    )
    
    # === SETUP ===
    metrics = MetricsLogger()
    event_log = []
    y_true = []
    y_pred = []  # Binary predictions for overall metrics (0/1)
    y_pred_types = []  # Attack type predictions for per-attack metrics
    y_true_types: List[str] = []
    
    # Track initial risk for risk mitigation metric (Eq. 26)
    initial_system_risk = sum(a.risk_score for a in agents)
    
    # Timing instrumentation
    t_start = time.time()
    total_lstm_time = 0.0
    total_schedule_time = 0.0
    
    anomaly_hist = {a.agent_id: [] for a in agents}
    audit_hist = {a.agent_id: [] for a in agents}
    
    # Total budget across the full cycle (10% of agents per timestep, capped by max audits)
    budget = int(len(agents) * audit_budget_ratio * steps)
    ledger = AuditLedger()
    
    if scheduler is None:
        scheduler = QLearningAuditScheduler(gamma=0.9, alpha=0.1)
    
    # Initialize convergence trackers
    gradient_tracker = GradientTracker()
    
    exec_cfg = AuditExecConfig(
        f_max=f_max,
        max_audits_per_timestep=max_audits_per_cycle,
        audit_cost_per_audit=audit_cost_per_audit,
    )
    
    # Environment
    env_cfg = GridEnvConfig(seed=42)
    env = GridEnvironment(agents, env_cfg, scenario=scenario, attack_cfg=attack_cfg, fault_cfg=fault_cfg)

    # Respect LSTM training window if available
    window_for_lstm = getattr(lstm_infer, "window", None) or 24
    window_for_lstm = max(1, min(window_for_lstm, steps))

    # === VALIDITY TRACKING (THREATS-TO-VALIDITY LOGGING) ===
    validity_notes: List[str] = []
    budget_exhaustion_count = 0
    max_attack_rate = 0.0
    
    # === MAIN SIMULATION LOOP (24 hours x 60 min / 5 min = 288 timesteps) ===
    for t in range(steps):
        # === STEP 1: Data Collection ===
        obs, truth = env.step(t)
        
        # === STEP 2: LSTM Anomaly Probability ===
        # Batch LSTM anomaly probability across agents for latency optimization
        windows = []
        states = []
        for a in agents:
            x, y = obs[a.agent_id]
            st = a.observe(x, y)
            w = a.get_history_window(window=window_for_lstm)
            feat = concat_xy_window(w["X"], w["Y"])  # (W, F)
            windows.append(feat)
            states.append(st)
        t_lstm_start = time.time()
        probs = lstm_infer.predict_proba_batch(windows)
        total_lstm_time += time.time() - t_lstm_start
        for st, p in zip(states, probs):
            st.anomaly_prob = p
        
        # === STEP 3: Deviation Score + Anomaly Flag ===
        for a in agents:
            if a.last_state is None:
                continue
            compute_score_and_flag(a, a.last_state)
            anomaly_hist[a.agent_id].append(int(a.last_state.anomaly_flag))
        
        # === STEP 3a: Collect Ground Truth for PRF1 Metrics ===
        for a in agents:
            if a.last_state is None:
                continue
            # truth[agent_id] = 1 if attack occurred, 0 otherwise
            ground_truth = 1 if truth.get(a.agent_id, 0) else 0
            prediction = 1 if a.last_state.anomaly_flag else 0
            y_true.append(ground_truth)
            y_pred.append(prediction)  # Binary for overall metrics
            
            # Collect predicted attack type (from new attack_type field added by scoring_pipeline)
            predicted_attack_type = getattr(a.last_state, 'attack_type', 'NONE')
            y_pred_types.append(predicted_attack_type)  # Attack type for per-attack metrics
            
            # Derive ground truth attack type taxonomy for per-attack metrics
            atk_type = "NONE"
            if env.last_attacks:
                at = env.last_attacks.get(a.agent_id)
                if at is not None:
                    # AttackType is a str Enum; use its value
                    try:
                        atk_type = getattr(at, "value", str(at))
                    except Exception:
                        atk_type = str(at)
            # Chain override: classify involved agents as CHAIN
            if env.scenario is not None and env.scenario.is_chain_attack(a.agent_id):
                atk_type = "CHAIN"
            # Fault override
            if env.last_faults and env.last_faults.get(a.agent_id) and env.last_faults.get(a.agent_id) != FaultType.NONE:
                atk_type = "FAULT"
            y_true_types.append(atk_type)
        
        # === STEP 4: Baseline + Threshold Updates (Behavior Analysis) ===
        for a in agents:
            if a.last_state is None:
                continue
            behavior_update(
                a, a.last_state,
                alpha_low=alpha_low, alpha_high=alpha_high,
                beta=beta,
                th_min=1e-3, th_max=1e6
            )
        
        # === STEP 5: Trend Clustering (K-Means) ===
        if t >= cluster_window_eff and ((t % cluster_period == 0) or t == steps - 1):
            labels = cluster_agents_trends(agents, window=min(cluster_window_eff, t + 1), k=cluster_k, seed=42)
            assign_cluster_labels(agents, labels)
        
        # === STEP 6: Hybrid Audit Scheduling (RL + Gradient + Constraints) ===
        t_sched_start = time.time()
        actions, rewards, freqs, state_before, constraint_stats = hybrid_audit_schedule(
            agents=agents,
            scheduler=scheduler,
            risk_threshold=risk_threshold,
            f_min=f_min,
            f_max=f_max,
            max_audits_per_cycle=max_audits_per_cycle,
            audit_cost_per_audit=audit_cost_per_audit,
            operational_cost=operational_cost,
            budget_ratio=audit_budget_ratio,
            C_a=C_a,
            C_f=C_f,
            grad_lr=grad_lr,
            gradient_tracker=gradient_tracker,
            ablation_mode=ablation_mode,
        )
        total_schedule_time += time.time() - t_sched_start
        
        # === STEP 6b: Execute Audits (Step 13 - Real Audit Events) ===
        remaining = ledger.remaining_budget(budget)
        audited_ids = execute_audits(
            agents=agents,
            t=t,
            ledger=ledger,
            remaining_budget=remaining,
            cfg=exec_cfg,
        )
        
        # Mark audited agents to prevent re-attack (attack prevention)
        if scenario:
            for aid in audited_ids:
                scenario.mark_audited(aid, t)
        
        # === STEP 6c: Audit Outcome Validation (Step 14 - RL Learning from Audits) ===
        outcomes = {}
        for aid in audited_ids:
            agent = next(a for a in agents if a.agent_id == aid)
            outcomes[aid] = evaluate_audit_outcome(agent, truth_label=truth.get(aid, 0))
        
        # === STEP 6d: Post-Audit RL Update (Step 14 - Perception-Action Loop) ===
        if outcomes:
            rl_post_audit_update(scheduler, state_before, actions, outcomes)
        
        # === STEP 7: Response Mechanism + Feedback Loop ===
        step_events = []
        for a in agents:
            if a.last_state is None:
                continue
            ev = response_step(a, anomaly_hist[a.agent_id], T=20, f_min=f_min, f_max=f_max)
            ev["t"] = t
            step_events.append(ev)
        event_log.extend(step_events)
        
        # === STEP 8: Log Metrics ===
        metrics.log_step(
            t,
            agents,
            audit_cost_per_audit=audit_cost_per_audit,
            ledger=ledger,
            budget=budget,
            truth=truth,
            outcomes=outcomes,
            constraint_stats=constraint_stats,
        )

        # === STRUCTURED STEP LOGGING ===
        if metrics.records:
            current_metric = metrics.records[-1]
            attack_rate_t = current_metric.get("attack_rate", 0.0)
            max_attack_rate = max(max_attack_rate, attack_rate_t)

            remaining_budget = budget - ledger.total_spend
            if budget > 0 and remaining_budget < 0.1 * budget and t < 0.8 * steps:
                budget_exhaustion_count += 1

            top_risk = sorted(
                [(a.last_state.risk_score if a.last_state else 0.0, a.agent_id) for a in agents],
                key=lambda x: x[0],
                reverse=True,
            )[:5]
            severity_counts: Dict[str, int] = {}
            for ev in step_events:
                lvl = ev.get("severity_level")
                if lvl:
                    severity_counts[lvl] = severity_counts.get(lvl, 0) + 1

            mean_k = float(np.mean([getattr(a.last_state, "th_k", 0.0) for a in agents if a.last_state])) if agents else 0.0
            mean_sigma = float(np.mean([getattr(a.last_state, "th_sigma_mean", 0.0) for a in agents if a.last_state])) if agents else 0.0
            mean_base_delta = float(np.mean([getattr(a.last_state, "baseline_delta", 0.0) for a in agents if a.last_state])) if agents else 0.0

            requested_raw = current_metric.get("requested_audits_raw", constraint_stats.get("requested_audits_raw", 0.0))
            requested = current_metric.get("requested_audits", constraint_stats.get("requested_audits", requested_raw))
            allowed_final = current_metric.get("allowed_audits_final", constraint_stats.get("allowed_final", 0.0))
            allowed_cap = current_metric.get("allowed_audits_cap", constraint_stats.get("allowed_by_cap", 0.0))
            denied_budget = max(0.0, allowed_cap - allowed_final)
            denied_cap = max(0.0, requested_raw - allowed_cap)

            logger.info(
                "t=%d | anomaly_rate=%.4f | mean_risk=%.4f | top5=%s | requested_audits=%.1f | allowed=%.1f | executed=%s | denied_budget=%.1f | denied_cap=%.1f | mean_k=%.2f | mean_sigma=%.4f | mean_baseline_delta=%.4f | mitigation=%s",
                t,
                attack_rate_t,
                current_metric.get("global_risk", 0.0),
                top_risk,
                requested,
                allowed_final,
                current_metric.get("audits_executed", 0),
                denied_budget,
                denied_cap,
                mean_k,
                mean_sigma,
                mean_base_delta,
                severity_counts,
            )
    
    # === COMPUTE FINAL RISK ===
    final_system_risk = sum(a.risk_score for a in agents)

    # === VALIDITY THREATS CHECK ===
    if max_attack_rate > 0.50:
        if "extreme_attack_density (>50%)" not in validity_notes:
            validity_notes.append("extreme_attack_density (>50%)")

    if budget_exhaustion_count > 10:
        validity_notes.append(f"early_budget_exhaustion ({budget_exhaustion_count} critical timesteps)")

    if not scheduler.converged:
        validity_notes.append("rl_non_convergence (online learning regime)")

    # === COMPILE CONVERGENCE INFO ===
    # Budget model compliance
    allowed_budget = int(len(agents) * audit_budget_ratio * steps)
    actual_audit_spend = float(ledger.total_spend)
    budget_compliance = actual_audit_spend <= allowed_budget + 1e-9

    convergence_info = {
        "rl_iterations": scheduler.iteration_count,
        "rl_converged": scheduler.converged,
        "rl_epsilon_final": getattr(scheduler, "epsilon", None),
        "rl_rolling_mean_abs_q_delta": getattr(scheduler, "last_rolling_mean", 0.0),
        "rl_stable_windows": getattr(scheduler, "stable_window_hits", 0),
        "gradient_iterations": gradient_tracker.iteration_count,
        "gradient_converged": gradient_tracker.converged,
        # Budget model reporting
        "operational_cost": operational_cost,
        "budget_ratio": audit_budget_ratio,
        "allowed_budget": allowed_budget,
        "actual_audit_spend": actual_audit_spend,
        "budget_compliance": budget_compliance,
        # Threats-to-validity reporting
        "validity_notes": validity_notes,
        # Timing metrics
        "total_runtime_sec": time.time() - t_start,
        "avg_lstm_inference_time_ms": (total_lstm_time / steps * 1000) if steps > 0 else 0.0,
        "avg_schedule_time_ms": (total_schedule_time / steps * 1000) if steps > 0 else 0.0,
        # Reproducibility snapshot
        "config": {
            "timestep_minutes": timestep_minutes,
            "cycle_hours": cycle_hours,
            "risk_threshold": risk_threshold,
            "audit_budget_ratio": audit_budget_ratio,
            "max_audits_per_cycle": max_audits_per_cycle,
            "f_min": f_min,
            "f_max": f_max,
            "audit_cost_per_audit": audit_cost_per_audit,
            "operational_cost": operational_cost,
            "alpha_low": alpha_low,
            "alpha_high": alpha_high,
            "beta": beta,
            "cluster_k": cluster_k,
            "cluster_window": cluster_window,
            "cluster_window_effective": cluster_window_eff,
            "cluster_period": cluster_period,
            "C_a": C_a,
            "C_f": C_f,
            "grad_lr": grad_lr,
            "scenario_fdi_rate": scenario_fdi_rate,
            "scenario_dos_rate": scenario_dos_rate,
            "scenario_chain_rate": scenario_chain_rate,
            "scenario_fault_rate": scenario_fault_rate,
        },
    }
    
    # === CHAIN ATTACK TRACKING ===
    if scenario:
        chain_pairs = scenario.get_chain_attacks()
        convergence_info["chain_attack_pairs"] = len(chain_pairs)
        convergence_info["chain_attack_agents"] = sum(1 for a in agents if scenario.is_chain_attack(a.agent_id))
    else:
        convergence_info["chain_attack_pairs"] = 0
        convergence_info["chain_attack_agents"] = 0
    
    return metrics.records, event_log, y_true, y_pred, y_pred_types, y_true_types, initial_system_risk, final_system_risk, convergence_info
