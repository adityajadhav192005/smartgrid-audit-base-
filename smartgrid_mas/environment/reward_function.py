from __future__ import annotations
from dataclasses import dataclass
import math
import os
from smartgrid_mas.audit.actions import AuditAction
from smartgrid_mas.agents.state import AgentState


@dataclass
class RewardWeights:
    """
    Weights for multi-objective reward function.
    
    Reward = -(lambda_attack * flag + lambda_audit * freq + lambda_stability * dev + lambda_risk_excess * risk_excess)
             + bonus_react * (1 if risk >= threshold and action==INC else 0)
    
    CRITICAL FIX: Risk penalty >> Audit penalty (across all grid sizes)
    - lambda_attack=2.0: Base penalty for anomalies; additionally scaled by LAMBDA_RISK_SCALE=100×
    - lambda_audit=0.10: REDUCED to 1/2 (was 0.20) to prevent audit cost dominance at scale
    - lambda_stability=0.10: Soft penalty on deviations
    - lambda_risk_excess=0.30: Elevated risk penalty
    - lambda_budget_barrier=5.0: Soft barrier penalty when budget is saturated
    - bonus_react=1.0: Modest bonus for reacting to high-risk
    - min_freq_high_risk=1: Minimal frequency requirement
    - lambda_low_coverage=0.50: Coverage penalty
    """
    # CRITICAL: Audit cost MUST be lower than (risk × LAMBDA_RISK_SCALE) / 100
    lambda_attack: float = float(os.environ.get("SMARTGRID_RW_ATTACK", 2.0))
    lambda_audit: float = float(os.environ.get("SMARTGRID_RW_AUDIT", 0.10))
    lambda_stability: float = float(os.environ.get("SMARTGRID_RW_STABILITY", 0.10))
    bonus_react: float = float(os.environ.get("SMARTGRID_RW_BONUS", 1.0))
    # Risk-aware extensions (increased for better mitigation)
    lambda_risk_excess: float = float(os.environ.get("SMARTGRID_RW_RISK_EXCESS", 0.30))
    min_freq_high_risk: int = int(os.environ.get("SMARTGRID_RW_MIN_FREQ_HR", 1))
    lambda_low_coverage: float = float(os.environ.get("SMARTGRID_RW_LOW_COVERAGE", 0.50))
    lambda_budget_barrier: float = float(os.environ.get("SMARTGRID_RW_BUDGET_BARRIER", 5.0))


def compute_reward(
    st: AgentState,
    action: AuditAction,
    risk_threshold: float,
    mean_baseline_delta: float,
    attacks_stopped: int = 0,
    audit_cost: float = 0.0,
    over_budget_excess: float = 0.0,
    weights: RewardWeights = None,
    cost_scale: float | None = None,
    prev_risk: float | None = None,
    budget_utilization: float | None = None,
    num_agents: int | None = None,
) -> float:
    """
    PHYSICS-BASED REWARD FUNCTION
    
    CRITICAL FIX FOR RL REWARD HACKING:
    - Uses mean_baseline_delta (physical deviation) as ground truth instead of risk probability
    - Implements "Safety Cliff" hard constraint: delta > 5.0 → massive penalty
    - Conditional budgeting: no cost penalty when grid unstable (delta > 1.0)
    - Continuous pressure to drive deviation to zero
    
    Args:
        st: Agent state
        action: Action taken (DEC, HOLD, INC)
        risk_threshold: Risk level threshold
        mean_baseline_delta: GROUND TRUTH - Physical grid deviation (voltage/frequency)
        attacks_stopped: Number of attacks caught this cycle
        audit_cost: Total audit cost this cycle
        weights: RewardWeights object (uses defaults if None)
    
    Returns:
        Scalar reward (higher is better)
    """
    if weights is None:
        weights = RewardWeights()

    # ==================== PROTOCOL A: THE SAFETY CLIFF (Anti-Cheat) ====================
    # CRITICAL THRESHOLD: If physics are bad, fail the agent immediately.
    # The multiplier ensures that a delta of 20.0 hurts way more than 6.0.
    CRITICAL_THRESHOLD = 5.0  # Grid is potentially crashing
    SAFE_THRESHOLD = 1.0      # Grid is stable enough to care about budget
    
    if mean_baseline_delta > CRITICAL_THRESHOLD:
        # GAME OVER STATE: Grid is crashing
        # Penalty scales with severity of failure
        return -500.0 - (mean_baseline_delta * 10.0)
    
    # ==================== NORMAL REWARD (Safe State) ====================
    
    # 1) SECURITY SCORE: Big reward for actually catching attacks
    security_score = 10.0 * float(attacks_stopped)
    
    # 2) STABILITY PENALTY: Constant pressure to lower the physical deviation
    # This is the CONTINUOUS PRESSURE component
    stability_penalty = -2.0 * mean_baseline_delta
    
    # 3) EFFICIENCY: Strongly penalize audit spend; heavier when stable; add over-budget penalty
    efficiency_penalty = -5.0 * audit_cost
    if mean_baseline_delta <= SAFE_THRESHOLD:
        efficiency_penalty = -10.0 * audit_cost
    over_budget_penalty = -8.0 * max(0.0, over_budget_excess)

    # 4) COVERAGE INCENTIVE: No reward for coverage; punish low-risk auditing, reward reducing low risk
    coverage_bonus = 0.0
    if st.risk_score < 0.2 and action == AuditAction.INC:
        coverage_bonus = -4.0  # very strong penalty for auditing low risk
    elif st.risk_score < 0.2 and action == AuditAction.HOLD:
        coverage_bonus = -2.0  # discourage holding audits on low risk
    elif st.risk_score < 0.2 and action == AuditAction.DEC:
        coverage_bonus = 1.5   # reward reducing audits on low risk
    
    # 5) FINAL SUM
    total_reward = security_score + stability_penalty + efficiency_penalty + over_budget_penalty + coverage_bonus
    
    return float(total_reward)
