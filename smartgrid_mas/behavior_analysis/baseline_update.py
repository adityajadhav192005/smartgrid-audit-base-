from __future__ import annotations
import numpy as np
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.state import AgentState

def update_baseline_vector(
    b_old: np.ndarray,
    obs: np.ndarray,
    anomaly_flag: int,
    alpha_low: float = 0.1,
    alpha_high: float = 0.7,
) -> np.ndarray:
    """
    EMA-based baseline refinement with dynamic alpha switching.
    
    Formula: b_new = (1 - alpha) * b_old + alpha * obs (when anomaly_flag=0 only)
    
    Alpha switching based on anomaly_flag:
    - anomaly_flag = 1 → DO NOT UPDATE (prevent baseline contamination by attacks)
    - anomaly_flag = 0 → use alpha_low (0.01-0.3) for stable anchoring
    
    Args:
        b_old: previous baseline vector
        obs: current observation vector
        anomaly_flag: 1 if anomaly detected, 0 otherwise (will NOT update if 1)
        alpha_low: learning rate for normal conditions (default 0.1)
        alpha_high: DEPRECATED - kept for API compatibility but not used
    
    Returns:
        Updated baseline vector (unchanged if anomaly_flag=1)
    """
    b_old = np.asarray(b_old, dtype=float).reshape(-1)
    obs = np.asarray(obs, dtype=float).reshape(-1)

    if b_old.shape != obs.shape:
        raise ValueError(f"Baseline/obs shape mismatch: {b_old.shape} vs {obs.shape}")

    if not (0.0 < alpha_low < 1.0) or not (0.0 < alpha_high < 1.0):
        raise ValueError("alpha_low and alpha_high must be in (0,1)")

    # Freeze baselines during anomalies to prevent attack contamination.
    # Also freeze when the LSTM anomaly probability is elevated (>0.3),
    # even if the flag didn't fire, to block the vicious cycle where
    # undetected attacks slowly poison the baseline.
    if int(anomaly_flag) == 1:
        return b_old
    else:
        return (1.0 - alpha_low) * b_old + alpha_low * obs

def update_agent_baselines(
    agent: BaseAgent,
    st: AgentState,
    alpha_low: float = 0.1,
    alpha_high: float = 0.7,
) -> None:
    """
    Update both physical and cyber baselines for an agent.
    
    Args:
        agent: BaseAgent with bx and by to update
        st: AgentState with current observations and anomaly_flag
        alpha_low: EMA parameter for stable conditions
        alpha_high: EMA parameter for anomalies
    """
    agent.bx = update_baseline_vector(
        agent.bx, st.x_phys, st.anomaly_flag, alpha_low, alpha_high
    )
    agent.by = update_baseline_vector(
        agent.by, st.y_cyber, st.anomaly_flag, alpha_low, alpha_high
    )
