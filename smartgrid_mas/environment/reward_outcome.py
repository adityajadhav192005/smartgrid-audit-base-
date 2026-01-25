"""
Outcome-based Reward Shaping for RL

Paper-faithful implementation:
- Rewards true positives (confirmed anomalies)
- Small reward for true negatives (clean audits)
- Penalties for false positives (false alarms)
- Higher penalties for false negatives (missed anomalies)

This creates learning signal for RL agent to:
1. Prioritize high-risk agents (maximize TP)
2. Avoid wasting audits on clean agents (minimize FP)
3. Strongly avoid missing real attacks (minimize FN)
"""
from __future__ import annotations
from dataclasses import dataclass
from smartgrid_mas.audit.audit_outcomes import AuditOutcome


@dataclass
class OutcomeRewardConfig:
    """
    Reward configuration for audit outcomes.
    
    Paper alignment: Penalize FP/FN to optimize audit precision and recall.
    
    Attributes:
        reward_tp: Reward for confirmed anomaly (true positive)
        reward_tn: Small reward for clean audit (true negative)
        penalty_fp: Penalty for false alarm (false positive)
        penalty_fn: Higher penalty for missed anomaly (false negative)
    """
    reward_tp: float = 2.0
    reward_tn: float = 0.2
    penalty_fp: float = 1.0
    penalty_fn: float = 2.5


def outcome_reward(
    outcome: AuditOutcome,
    cfg: OutcomeRewardConfig | None = None
) -> float:
    """
    Compute reward value for an audit outcome.
    
    Args:
        outcome: AuditOutcome classification
        cfg: Reward configuration (uses defaults if None)
        
    Returns:
        Reward value (positive for good outcomes, negative for errors)
        
    Example:
        CONFIRMED_ANOMALY → +2.0 (reward finding attack)
        FALSE_ALARM → -1.0 (penalty for wasted audit)
        MISSED_ANOMALY → -2.5 (strong penalty for missing attack)
        CLEAN → +0.2 (small reward for confirming clean)
    """
    if cfg is None:
        cfg = OutcomeRewardConfig()
    
    if outcome == AuditOutcome.CONFIRMED_ANOMALY:
        return cfg.reward_tp
    if outcome == AuditOutcome.CLEAN:
        return cfg.reward_tn
    if outcome == AuditOutcome.FALSE_ALARM:
        return -cfg.penalty_fp
    if outcome == AuditOutcome.MISSED_ANOMALY:
        return -cfg.penalty_fn
    return 0.0
