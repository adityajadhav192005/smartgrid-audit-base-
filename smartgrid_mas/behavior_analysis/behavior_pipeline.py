from __future__ import annotations
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.state import AgentState
from smartgrid_mas.behavior_analysis.baseline_update import update_agent_baselines
from smartgrid_mas.behavior_analysis.threshold_update import update_agent_thresholds

def behavior_update(
    agent: BaseAgent,
    st: AgentState,
    alpha_low: float = 0.1,
    alpha_high: float = 0.7,
    beta: float = 0.1,
    th_min: float = 1e-3,
    th_max: float = 1e6,
) -> None:
    """
    Full behavior analysis pipeline: baseline refinement → threshold adjustment.
    
    Order of operations (critical):
    1. Update baselines using current observation and anomaly_flag (adaptive EMA)
    2. Update thresholds based on updated baselines (responsive to deviations)
    
    Args:
        agent: BaseAgent to update
        st: AgentState with x_phys, y_cyber, anomaly_flag
        alpha_low: EMA for stable conditions (default 0.1)
        alpha_high: EMA for anomalies (default 0.7)
        beta: threshold adjustment factor (default 0.1)
        th_min: minimum threshold (default 1e-3)
        th_max: maximum threshold (default 1e6)
    """
    # (1) Refine baselines using adaptive alpha
    update_agent_baselines(agent, st, alpha_low=alpha_low, alpha_high=alpha_high)

    # (2) Adjust thresholds based on updated baselines and deviations
    update_agent_thresholds(agent, st, beta=beta, th_min=th_min, th_max=th_max)
