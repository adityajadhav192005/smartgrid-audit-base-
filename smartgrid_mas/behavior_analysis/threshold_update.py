from __future__ import annotations
import numpy as np
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.state import AgentState

def update_threshold_vector(
    th_old: np.ndarray,
    obs: np.ndarray,
    baseline: np.ndarray,
    beta: float = 0.1,
    th_min: float = 1e-3,
    th_max: float = 1e6,
) -> np.ndarray:
    """
    Dynamic threshold adjustment based on observed deviation.
    
    Formula: Th_new = Th_old + beta * |obs - baseline|
    
    Beta adjustment factor depends on grid dynamics:
    - Stable grids: beta in [0.01, 0.3]
    - Dynamic grids: beta in [0.5, 1.0]
    
    Strict positivity guaranteed via clipping to [th_min, th_max].
    
    Args:
        th_old: previous threshold vector
        obs: current observation vector
        baseline: current baseline vector
        beta: adjustment factor (default 0.1)
        th_min: minimum threshold (must be > 0, default 1e-3)
        th_max: maximum threshold (default 1e6)
    
    Returns:
        Updated threshold vector with guaranteed positivity
    """
    th_old = np.asarray(th_old, dtype=float).reshape(-1)
    obs = np.asarray(obs, dtype=float).reshape(-1)
    baseline = np.asarray(baseline, dtype=float).reshape(-1)

    if th_old.shape != obs.shape or th_old.shape != baseline.shape:
        raise ValueError(f"Shape mismatch: th{th_old.shape}, obs{obs.shape}, base{baseline.shape}")

    if beta < 0:
        raise ValueError("beta must be >= 0")
    if th_min <= 0:
        raise ValueError("th_min must be > 0")

    # Compute absolute deviation
    dev = np.abs(obs - baseline)
    
    # Apply adjustment
    th_new = th_old + beta * dev

    # Enforce strict positivity and bounds
    th_new = np.clip(th_new, th_min, th_max)
    return th_new

def update_agent_thresholds(
    agent: BaseAgent,
    st: AgentState,
    beta: float = 0.1,
    th_min: float = 1e-3,
    th_max: float = 1e6,
) -> None:
    """
    Update both physical and cyber thresholds for an agent.
    
    Args:
        agent: BaseAgent with thx and thy to update
        st: AgentState with current observations
        beta: adjustment factor (0.01-0.3 for stable, 0.5-1.0 for dynamic)
        th_min: minimum threshold (default 1e-3)
        th_max: maximum threshold (default 1e6)
    """
    thx_new = update_threshold_vector(
        agent.thx, st.x_phys, agent.bx, beta, th_min, th_max
    )
    thy_new = update_threshold_vector(
        agent.thy, st.y_cyber, agent.by, beta, th_min, th_max
    )

    # Respect sigma-based floors from the detection step to avoid stale/too-tight thresholds
    sigma_floor_x = getattr(st, "sigma_floor_x", None)
    sigma_floor_y = getattr(st, "sigma_floor_y", None)
    if sigma_floor_x is not None:
        thx_new = np.maximum(thx_new, np.asarray(sigma_floor_x, dtype=float))
    if sigma_floor_y is not None:
        thy_new = np.maximum(thy_new, np.asarray(sigma_floor_y, dtype=float))

    agent.thx = thx_new
    agent.thy = thy_new
