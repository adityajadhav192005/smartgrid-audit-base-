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
    
    CRITICAL v8 FIX: penalty_fn increased 2.5→10.0 to ensure RL prioritizes security.
    The v7 issue was RL under-audited (only 5% budget) because missing attacks (FN)
    wasn't penalized enough relative to audit cost savings. 
    
    Attributes:
        reward_tp: Reward for confirmed anomaly (true positive)
        reward_tn: Small reward for clean audit (true negative)
        penalty_fp: Penalty for false alarm (false positive)
        penalty_fn: CRITICAL - Heavy penalty for missed anomaly (false negative)
    """
    reward_tp: float = 2.0
    reward_tn: float = 0.2
    penalty_fp: float = 0.5
    penalty_fn: float = 10.0


def outcome_reward(
    outcome: AuditOutcome,
    cfg: OutcomeRewardConfig | None = None,
    is_chain_attack: bool = False,
    attack_rate: float = 0.0
) -> float:
    """
    Compute reward value for an audit outcome.
    
    v9 IMPROVEMENTS:
    - FIX #3: Chain attack amplifier (3× penalty for cascade failures)
    - FIX #5: Dynamic α₂ scaling (scale FN penalty with attack rate)
    
    Args:
        outcome: AuditOutcome classification
        cfg: Reward configuration (uses defaults if None)
        is_chain_attack: True if agent is part of detected chain attack
        attack_rate: Current attack rate (0.0-1.0) to scale penalties
        
    Returns:
        Reward value (positive for good outcomes, negative for errors)
    """
    if cfg is None:
        cfg = OutcomeRewardConfig()
    
    # FIX #3: CHAIN ATTACK AMPLIFIER
    # Cascade failures are 3× worse than isolated attacks
    chain_multiplier = 3.0 if is_chain_attack else 1.0
    
    # FIX #5: DYNAMIC α₂ SCALING
    # Higher attack rates make missing attacks worse
    # scale = 1.0 + (attack_rate * 10)
    threat_multiplier = 1.0 + (max(0, attack_rate) * 10)
    
    if outcome == AuditOutcome.CONFIRMED_ANOMALY:
        return cfg.reward_tp * threat_multiplier
    if outcome == AuditOutcome.CLEAN:
        return cfg.reward_tn
    if outcome == AuditOutcome.FALSE_ALARM:
        return -cfg.penalty_fp
    if outcome == AuditOutcome.MISSED_ANOMALY:
        # CRITICAL: Chain + threat scaling
        base_penalty = cfg.penalty_fn
        return -(base_penalty * threat_multiplier * chain_multiplier)
    return 0.0
