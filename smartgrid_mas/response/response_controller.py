"""
Response controller - full severity-to-action pipeline.

Implements paper's response mechanism:
    1. Compute impact factor from agent type
    2. Compute likelihood from anomaly history
    3. Calculate severity score and level
    4. Apply appropriate mitigation action
    5. Feedback: Update agent risk score with severity scaling

This creates the closed-loop feedback between detection and audit scheduling.
"""

from __future__ import annotations
from typing import Dict, Any, List
import numpy as np

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.response.impact_factor import impact_factor
from smartgrid_mas.response.severity_scoring import (
    compute_severity_score,
    likelihood_from_history,
    severity_level,
    SeverityWeights,
    SeverityThresholds,
)
from smartgrid_mas.response.mitigation_actions import apply_mitigation


def response_step(
    agent: BaseAgent,
    anomaly_flag_history: List[int],
    T: int = 20,
    weights: SeverityWeights = SeverityWeights(),
    thresholds: SeverityThresholds = SeverityThresholds(),
    f_min: int = 1,
    f_max: int = 5,
    severity_risk_scale: bool = True,
) -> Dict[str, Any]:
    """
    Execute full response mechanism for one agent.
    
    Pipeline:
        1. Extract impact factor from agent type
        2. Compute likelihood from recent anomaly flags
        3. Calculate severity score: Se = w_impact*Impact + w_likelihood*Likelihood
        4. Classify severity level (LOW/MEDIUM/HIGH/CRITICAL)
        5. Apply mitigation action based on level
        6. Feedback: Scale risk score by severity (optional)
    
    Args:
        agent: Agent to process
        anomaly_flag_history: Recent anomaly flags (binary, 0/1)
        T: History window size (default 20 from paper)
        weights: Severity score weights
        thresholds: Severity level thresholds
        f_min: Minimum audit frequency
        f_max: Maximum audit frequency
        severity_risk_scale: If True, scale risk by severity for feedback
    
    Returns:
        Event dictionary with:
            - severity_score: Computed severity
            - severity_level: Classification
            - action: Mitigation action taken
            - impact_factor: Agent impact
            - likelihood: Computed likelihood
    
    Example:
        >>> history = [1, 1, 0, 1, 1, 0]  # Recent anomalies
        >>> event = response_step(agent, history, T=6)
        >>> event['severity_level']
        'MEDIUM'
        >>> event['action']
        'INCREASE_AUDIT'
    """
    # Skip if agent has no state
    if agent.last_state is None:
        return {"agent_id": agent.agent_id, "skipped": True}
    
    # 1. Extract recent history (last T timesteps)
    hist = np.asarray(anomaly_flag_history[-T:], dtype=float)
    
    # 2. Compute likelihood from history
    likelihood = likelihood_from_history(hist)
    
    # 3. Get impact factor from agent type
    impact = impact_factor(agent.agent_type)
    
    # 4. Compute severity score
    severity_score = compute_severity_score(
        impact_factor=impact,
        likelihood=likelihood,
        weights=weights
    )
    
    # 5. Classify severity level
    level = severity_level(severity_score, thresholds)
    
    # 6. Apply mitigation action
    event = apply_mitigation(agent, level, f_min=f_min, f_max=f_max)
    
    # Add severity metrics to event
    event["severity_score"] = float(severity_score)
    event["severity_level"] = level.value
    event["impact_factor"] = float(impact)
    event["likelihood"] = float(likelihood)
    
    # 7. Feedback loop: Update risk score with severity scaling
    # Base risk: w_i * a_i(t)
    base_risk = agent.update_risk_score_from_flag(agent.last_state.anomaly_flag)
    
    # Optional severity scaling: Higher severity → higher risk → more audits
    # This creates the paper's feedback loop
    if severity_risk_scale:
        # Scale risk by (1 + severity_score)
        # Example: severity=0.8 → risk multiplied by 1.8
        agent.risk_score = float(base_risk * (1.0 + severity_score))
    else:
        agent.risk_score = float(base_risk)
    
    # Sync state record
    agent.last_state.risk_score = agent.risk_score
    
    return event
