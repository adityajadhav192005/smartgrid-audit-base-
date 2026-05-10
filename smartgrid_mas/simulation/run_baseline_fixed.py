"""
Fixed-audit baseline runner

Runs same pipeline as dynamic but with fixed audit frequency for all agents.
Used for fair comparison in evaluation.
"""

from __future__ import annotations
from typing import List, Dict, Any, Tuple

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.environment.grid_env import GridEnvironment, GridEnvConfig
from smartgrid_mas.environment.scenario_engine import ScenarioEngine, ScenarioConfig
from smartgrid_mas.data.cyber_attacks import AttackConfig
from smartgrid_mas.data.synthetic_faults import FaultConfig
from smartgrid_mas.behavior_analysis.scoring_pipeline import compute_score_and_flag
from smartgrid_mas.behavior_analysis.behavior_pipeline import behavior_update
from smartgrid_mas.behavior_analysis.trend_clustering import cluster_agents_trends, assign_cluster_labels
from smartgrid_mas.audit.audit_ledger import AuditLedger
from smartgrid_mas.audit.audit_executor import execute_audits, AuditExecConfig
from smartgrid_mas.response.response_controller import response_step
from smartgrid_mas.simulation.metrics import MetricsLogger
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.anomaly_detection.dual_branch import (
    build_grid_branch_window,
    build_network_branch_window,
    fuse_branch_probabilities,
)


def run_fixed_audit_24h(
    agents: List[BaseAgent],
    lstm_infer: LSTMInferencer,
    network_lstm_infer: LSTMInferencer | None = None,
    fixed_f: int = 1,
    timestep_minutes: int = 5,
    cycle_hours: int = 24,
    cluster_k: int = 3,
    cluster_window: int = 50,
    alpha_low: float = 0.1,
    alpha_high: float = 0.7,
    beta: float = 0.1,
    audit_cost_per_audit: float = 1.0,
    audit_budget_ratio: float = 0.10,
    operational_cost: float = 100.0,
    f_max: int = 5,
    max_audits_per_cycle: int = 5,
    # Scenario rates (match dynamic for fair comparison)
    scenario_fdi_rate: float = 0.40,
    scenario_dos_rate: float = 0.20,
    scenario_chain_rate: float = 0.20,
    scenario_fault_rate: float = 0.20,
    attack_cfg: AttackConfig | None = None,
    fault_cfg: FaultConfig | None = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[int], List[int], float, float, Dict[str, Any]]:
    """
    Run baseline simulation with fixed audit frequency.
    
    Same pipeline as dynamic run but skips RL + gradient scheduling.
    All agents get fixed_f audit frequency throughout.
    
    Args:
        agents: List of agents
        lstm_infer: LSTM model
        fixed_f: Fixed audit frequency for all agents
        Other params: Match run_simulation_24h defaults
    
    Returns:
        (metrics_records, event_log, y_true, y_pred, initial_risk, final_risk, convergence_info): Per-timestep metrics, events, ground truth/predictions for PRF1, initial/final system risk, and convergence data (empty for baseline)
    """
    steps = int((cycle_hours * 60) / timestep_minutes)
    cluster_window_eff = min(cluster_window, max(5, steps // 2 if steps > 1 else 1))
    cluster_period = 10 if steps >= 30 else max(1, steps // 3)
    cluster_window_eff = min(cluster_window, max(5, steps // 2 if steps > 1 else 1))
    cluster_period = 10 if steps >= 30 else max(1, steps // 3)
    
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
    env = GridEnvironment(agents, GridEnvConfig(seed=42), scenario=scenario, attack_cfg=attack_cfg, fault_cfg=fault_cfg)
    
    metrics = MetricsLogger()
    event_log: List[Dict[str, Any]] = []
    anomaly_hist: Dict[str, List[int]] = {a.agent_id: [] for a in agents}
    
    # Ground truth tracking for precision/recall/F1 computation
    y_true = []  # Ground truth: 1 if attack occurred, 0 otherwise
    y_pred = []  # Predictions: 1 if anomaly flagged, 0 otherwise
    
    # Track initial risk for risk mitigation metric
    initial_system_risk = sum(a.risk_score for a in agents)
    
    # Initialize audit ledger and executor (Step 13)
    # Baseline is intentionally naive and may exceed the dynamic budget
    budget = float("inf")
    ledger = AuditLedger()
    
    # Baseline should be uncapped - allow all agents to be audited per fixed frequency
    # Set a very large cap to effectively remove the limit
    max_per_step = 10000  # Effectively unlimited for realistic grid sizes
    exec_cfg = AuditExecConfig(
        f_max=f_max,
        max_audits_per_timestep=max_per_step,
        audit_cost_per_audit=audit_cost_per_audit,
    )

    # Use LSTM window if provided by checkpoint metadata
    window_for_lstm = getattr(lstm_infer, "window", None) or 24
    
    for t in range(steps):
        # Set fixed frequency for all agents
        for a in agents:
            a.set_audit_frequency(fixed_f, f_min=1, f_max=5)
        
        obs, truth = env.step(t)
        
        # Dual-branch inference
        for a in agents:
            x, y = obs[a.agent_id]
            st = a.observe(x, y)
            w = a.get_history_window(window=window_for_lstm)
            grid_feat = build_grid_branch_window(w)
            net_feat = build_network_branch_window(w) if network_lstm_infer is not None else None
            grid_prob = lstm_infer.predict_proba(grid_feat)
            network_prob = network_lstm_infer.predict_proba(net_feat) if network_lstm_infer is not None and net_feat is not None else 0.0
            fused = fuse_branch_probabilities(grid_prob, network_prob)
            st.grid_anomaly_prob = fused.grid_prob
            st.network_intrusion_prob = fused.network_prob
            st.fusion_agreement = fused.agreement
            st.anomaly_prob = fused.fused_prob
        
        # Deviation scoring
        for a in agents:
            if a.last_state is None:
                continue
            compute_score_and_flag(a, a.last_state)
            anomaly_hist[a.agent_id].append(int(a.last_state.anomaly_flag))
        
        # Collect ground truth for PRF1 metrics
        for a in agents:
            if a.last_state is None:
                continue
            ground_truth = 1 if truth.get(a.agent_id, 0) else 0
            prediction = 1 if a.last_state.anomaly_flag else 0
            y_true.append(ground_truth)
            y_pred.append(prediction)
        
        # Behavior updates
        for a in agents:
            if a.last_state is None:
                continue
            behavior_update(a, a.last_state, alpha_low=alpha_low, alpha_high=alpha_high, beta=beta)
        
        # Clustering
        if t >= cluster_window_eff and ((t % cluster_period == 0) or t == steps - 1):
            labels = cluster_agents_trends(agents, window=min(cluster_window_eff, t + 1), k=cluster_k, seed=42)
            assign_cluster_labels(agents, labels)
        
        # Execute audits (Step 13)
        remaining = ledger.remaining_budget(budget)
        audited_ids = execute_audits(
            agents=agents,
            t=t,
            ledger=ledger,
            remaining_budget=remaining,
            cfg=exec_cfg,
        )
        
        # Response mechanism
        for a in agents:
            if a.last_state is None:
                continue
            ev = response_step(a, anomaly_hist[a.agent_id], T=20)
            ev["t"] = t
            event_log.append(ev)
        
        # Metrics logging
        metrics.log_step(
            t,
            agents,
            audit_cost_per_audit=audit_cost_per_audit,
            ledger=ledger,
            budget=budget,
            truth=truth,
        )
    
    # Compute final risk for risk mitigation metric
    final_system_risk = sum(a.risk_score for a in agents)
    
    # Baseline has no optimization, so convergence info is empty
    convergence_info = {
        "rl_iterations": 0,
        "rl_converged": False,
        "gradient_iterations": 0,
        "gradient_converged": False,
    }
    
    return metrics.records, event_log, y_true, y_pred, initial_system_risk, final_system_risk, convergence_info
    
    return metrics.records, event_log, y_true, y_pred, initial_system_risk, final_system_risk
