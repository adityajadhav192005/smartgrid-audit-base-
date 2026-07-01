from __future__ import annotations
import numpy as np
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.state import AgentState
from smartgrid_mas.behavior_analysis.baseline_update import update_agent_baselines
from smartgrid_mas.behavior_analysis.threshold_update import update_agent_thresholds

_DEVIATION_FREEZE_THRESHOLD = 6.0

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
    # (1) Refine baselines using adaptive alpha.
    # Freeze baselines when either:
    #   a) LSTM signals elevated anomaly probability, OR
    #   b) Raw deviation from baseline exceeds threshold (catches attacks
    #      that the LSTM misses due to poor calibration on some seeds)
    anomaly_prob = float(getattr(st, "anomaly_prob", 0.0) or 0.0)
    x_dev = np.abs(np.asarray(st.x_phys) - np.asarray(agent.bx))
    y_dev = np.abs(np.asarray(st.y_cyber) - np.asarray(agent.by))
    thx = np.maximum(np.asarray(agent.thx), 1e-6)
    thy = np.maximum(np.asarray(agent.thy), 1e-6)
    max_norm_dev = float(max(
        np.max(x_dev / thx) if x_dev.size else 0.0,
        np.max(y_dev / thy) if y_dev.size else 0.0,
    ))
    should_freeze = max_norm_dev >= _DEVIATION_FREEZE_THRESHOLD
    if should_freeze:
        st.anomaly_flag_for_baseline = 1
        saved_flag = st.anomaly_flag
        st.anomaly_flag = 1
        update_agent_baselines(agent, st, alpha_low=alpha_low, alpha_high=alpha_high)
        st.anomaly_flag = saved_flag
    else:
        update_agent_baselines(agent, st, alpha_low=alpha_low, alpha_high=alpha_high)

    # (2) Adjust thresholds — but freeze during suspected attacks to prevent
    # attack deviations from inflating thresholds (which would mask the attack).
    if not should_freeze:
        update_agent_thresholds(agent, st, beta=beta, th_min=th_min, th_max=th_max)
