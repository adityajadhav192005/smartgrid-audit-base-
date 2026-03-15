from __future__ import annotations
import os
import numpy as np
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.state import AgentState
from smartgrid_mas.behavior_analysis.deviation_score import deviation_score, anomaly_flag_from_score

def compute_score_and_flag(agent: BaseAgent, st: AgentState) -> AgentState:
    """
    Main pipeline: compute deviation score and anomaly flag for an agent.
    
    Takes latest agent state and fills:
    - deviation_score (S_i(t))
    - anomaly_flag (a_i(t))
    - updates risk_score component (w_i * a_i(t))
    
    Args:
        agent: BaseAgent with baselines, thresholds, criticality
        st: AgentState snapshot with x_phys, y_cyber
    
    Returns:
        Updated AgentState with computed scores
    """
    # === Dynamic threshold calibration: Th = k * sigma ===
    k_sigma = 4.0
    sigma_window = 24
    try:
        k_sigma = float(os.environ.get("SMARTGRID_THRESHOLD_K", k_sigma))
    except Exception:
        pass
    try:
        sigma_window = int(os.environ.get("SMARTGRID_THRESHOLD_WINDOW", sigma_window))
    except Exception:
        pass

    # Compute rolling sigma over recent window (pad via history helper)
    try:
        hx = np.stack(list(agent.x_history)[-sigma_window:], axis=0)
        hy = np.stack(list(agent.y_history)[-sigma_window:], axis=0)
    except Exception:
        hx = np.asarray(st.x_phys, dtype=float).reshape(1, -1)
        hy = np.asarray(st.y_cyber, dtype=float).reshape(1, -1)

    sigma_x = np.std(hx, axis=0) if hx.size else np.zeros_like(agent.thx)
    sigma_y = np.std(hy, axis=0) if hy.size else np.zeros_like(agent.thy)
    floor_x = np.maximum(k_sigma * sigma_x, 1e-6)
    floor_y = np.maximum(k_sigma * sigma_y, 1e-6)

    # Apply sigma-based floors immediately so anomaly decision sees updated thresholds
    agent.thx = np.maximum(agent.thx, floor_x)
    agent.thy = np.maximum(agent.thy, floor_y)
    st.sigma_floor_x = floor_x
    st.sigma_floor_y = floor_y

    s = deviation_score(
        x_phys=st.x_phys,
        bx=agent.bx,
        thx=agent.thx,
        y_cyber=st.y_cyber,
        by=agent.by,
        thy=agent.thy,
        w_i=agent.criticality.weight,
    )
    # Thresholds with optional env-driven overrides
    score_threshold = 4.0
    try:
        score_threshold = float(os.environ.get("SMARTGRID_SCORE_THRESHOLD", score_threshold))
    except Exception:
        pass
    prob_threshold = 0.999
    try:
        prob_threshold = float(os.environ.get("SMARTGRID_ANOMALY_PROB_THRESHOLD", prob_threshold))
    except Exception:
        pass

    # Risk-aware thresholding (precision control)
    # - Low-risk agents: more conservative threshold (reduce false positives)
    # - High-risk agents: more sensitive threshold (reduce false negatives)
    risk_context = float(getattr(st, "risk_score", agent.risk_score))
    score_scale = 1.0
    prob_scale = 1.0
    if risk_context <= 0.3:
        score_scale = 1.6
        prob_scale = 1.08
    elif risk_context >= 0.7:
        score_scale = 1.0
        prob_scale = 0.98
    else:
        score_scale = 1.25
        prob_scale = 1.02

    adaptive_score_threshold = max(1e-6, score_threshold * score_scale)
    adaptive_prob_threshold = min(1.0, max(1e-6, prob_threshold * prob_scale))

    # Confidence fusion (hybrid detector): combine deviation confidence + model confidence
    w_dev = float(os.environ.get("SMARTGRID_HYBRID_W_DEV", 0.6))
    w_prob = float(os.environ.get("SMARTGRID_HYBRID_W_PROB", 0.4))
    dev_conf = min(3.0, float(s) / adaptive_score_threshold)
    prob_conf = float(getattr(st, "anomaly_prob", 0.0) or 0.0)
    hybrid_conf = (w_dev * dev_conf) + (w_prob * prob_conf)

    prev_flag = int(getattr(agent.last_state, "anomaly_flag", 0) if agent.last_state is not None else 0)

    if risk_context <= 0.3:
        a = 1 if (
            (s >= 1.35 * adaptive_score_threshold and prob_conf >= 0.75)
            or (hybrid_conf >= 1.55 and prob_conf >= 0.70)
            or (prev_flag == 1 and s >= 1.15 * adaptive_score_threshold and prob_conf >= 0.68)
        ) else 0
    elif risk_context >= 0.7:
        a = 1 if (
            (s >= 1.02 * adaptive_score_threshold and prob_conf >= 0.60)
            or (hybrid_conf >= 1.20 and prob_conf >= 0.58)
            or (prob_conf >= adaptive_prob_threshold and s >= 0.90 * adaptive_score_threshold)
        ) else 0
    else:
        a = 1 if (
            (s >= 1.18 * adaptive_score_threshold and prob_conf >= 0.67)
            or (hybrid_conf >= 1.35 and prob_conf >= 0.64)
            or (prev_flag == 1 and s >= 1.00 * adaptive_score_threshold and prob_conf >= 0.62)
        ) else 0

    st.deviation_score = s
    st.anomaly_flag = a
    st.hybrid_confidence = float(hybrid_conf)
    st.adaptive_score_threshold = float(adaptive_score_threshold)
    st.adaptive_prob_threshold = float(adaptive_prob_threshold)
    
    # === Attack Type Classification (Simple Physical vs Cyber Dominance) ===
    # When anomaly detected, classify attack type by which metrics are most deviated
    st.attack_type = "NONE"
    if a == 1:  # Only classify when anomaly is detected
        # Use relative magnitudes of physical vs cyber deviations to guess attack type
        phys_dev = np.mean(np.abs(st.x_phys - agent.bx))
        cyber_dev = np.mean(np.abs(st.y_cyber - agent.by))
        
        # Heuristic: FDI more likely on physical metrics, DoS on cyber metrics
        if phys_dev > 0.5 and cyber_dev > 0.5:
            st.attack_type = "CHAIN"  # Both elevated → cascading attack
        elif phys_dev > cyber_dev * 2:
            st.attack_type = "FDI"    # Physical-dominant → False Data Injection
        elif cyber_dev > phys_dev * 2:
            st.attack_type = "DOS"    # Cyber-dominant → Denial of Service
        elif phys_dev > 0.3:
            st.attack_type = "FDI"    # Default to FDI if physical is deviated
        elif cyber_dev > 0.3:
            st.attack_type = "DOS"    # Default to DoS if cyber is deviated
        else:
            st.attack_type = "FAULT"  # Otherwise assume fault-like

    # per-agent component; global sum happens in scheduler/env
    st.risk_score = agent.update_risk_score_from_flag(a)
    # Diagnostics for structured logging
    st.th_k = k_sigma
    st.th_sigma_mean = float(np.mean(np.concatenate([sigma_x, sigma_y]))) if sigma_x.size and sigma_y.size else 0.0
    st.baseline_delta = float(np.mean(np.abs(st.x_phys - agent.bx)) + np.mean(np.abs(st.y_cyber - agent.by)))
    return st

