from __future__ import annotations
from dataclasses import dataclass
import os

from smartgrid_mas.audit.actions import AuditAction
from smartgrid_mas.agents.state import AgentState


def _profile_default(key: str, robust: float, balanced: float, cost: float) -> float:
    profile = os.environ.get("SMARTGRID_OPTIMIZATION_PROFILE", "ROBUST").strip().upper()
    defaults = {
        "ROBUST": robust,
        "BALANCED": balanced,
        "COST": cost,
    }
    return float(os.environ.get(key, defaults.get(profile, balanced)))


@dataclass
class RewardWeights:
    """Paper-aligned reward weights (pinned reference)."""

    # Eq.-style objective weights
    # CRITICAL FIX #7 (March 7, 2026): COMPLETE REDESIGN to beat paper (87.9% risk mitigation target)
    # Architecture changes:
    # 1. QUADRATIC penalty for high-risk agents with low frequency (exponential badness)
    # 2. Amplified security penalties: lambda_attack 5.0 → 10.0 (2x stronger)
    # 3. Reduced audit cost weight: 0.2 → 0.05 (4x cheaper relative to security)
    # 4. High-risk threshold raised to 0.75 (tighter definition)
    lambda_attack: float = _profile_default("SMARTGRID_RW_ATTACK", 14.0, 12.0, 11.0)
    lambda_audit: float = _profile_default("SMARTGRID_RW_AUDIT", 0.04, 0.035, 0.03)
    lambda_stability: float = float(os.environ.get("SMARTGRID_RW_STABILITY", 0.1))
    bonus_react: float = _profile_default("SMARTGRID_RW_BONUS", 3.0, 2.75, 2.5)
    lambda_risk_excess: float = float(os.environ.get("SMARTGRID_RW_RISK_EXCESS", 0.30))
    min_freq_high_risk: int = int(os.environ.get("SMARTGRID_RW_MIN_FREQ_HR", 3 if os.environ.get("SMARTGRID_OPTIMIZATION_PROFILE", "ROBUST").strip().upper() == "ROBUST" else 2))
    lambda_low_coverage: float = float(os.environ.get("SMARTGRID_RW_LOW_COVERAGE", 0.50))
    lambda_budget_barrier: float = _profile_default("SMARTGRID_RW_BUDGET_BARRIER", 3.5, 4.2, 5.0)
    lambda_quadratic_risk: float = _profile_default("SMARTGRID_RW_QUADRATIC", 8.0, 6.0, 5.0)
    high_risk_threshold: float = _profile_default("SMARTGRID_RW_HIGH_RISK_TH", 0.70, 0.72, 0.75)
    high_risk_inaction_scale: float = float(os.environ.get("SMARTGRID_RW_INACTION_SCALE", 1.0))
    lambda_false_positive_audit: float = _profile_default("SMARTGRID_RW_FP_AUDIT", 0.45, 0.30, 0.22)

    # Multi-objective scalarization weights (sweep these in experiments)
    w_security: float = _profile_default("SMARTGRID_RW_W_SECURITY", 1.35, 1.15, 1.0)
    w_cost: float = _profile_default("SMARTGRID_RW_W_COST", 0.60, 0.80, 1.0)
    w_precision: float = _profile_default("SMARTGRID_RW_W_PRECISION", 1.30, 1.10, 1.0)


def compute_reward(
    st: AgentState,
    action: AuditAction,
    risk_threshold: float,
    mean_baseline_delta: float,
    attacks_stopped: int = 0,
    audit_cost: float = 0.0,
    over_budget_excess: float = 0.0,
    weights: RewardWeights | None = None,
    cost_scale: float | None = None,
    prev_risk: float | None = None,
    budget_utilization: float | None = None,
    num_agents: int | None = None,
    system_c_failure: float = 0.0,
) -> float:
    """
    Pinned-paper aligned reward:

    1) Cost objective (Eq. 2 inspired):
       C = C_a * f + C_f * (R / f)
       where here `audit_cost` carries C_a*f and we model R/f per-agent.

    2) Detection penalty (paper text):
       R_det = -(alpha_1 * FP + alpha_2 * FN), with alpha_2 > alpha_1.

    3) Physical safety guardrail:
       hard penalty beyond critical baseline deviation.
    """
    if weights is None:
        weights = RewardWeights()
    
    # Optional debug logging (ASCII-only to avoid Windows cp1252 encoding errors)
    debug_enabled = os.environ.get("SMARTGRID_RW_DEBUG", "0") == "1"
    if debug_enabled:
        if not hasattr(compute_reward, '_debug_printed'):
            print(f"\n{'='*70}")
            print("REWARD FUNCTION DEBUG - FIRST CALL")
            print(f"{'='*70}")
            print(f"lambda_attack (FN & R/f penalty): {weights.lambda_attack}")
            print(f"lambda_audit (audit cost weight): {weights.lambda_audit}")
            print("Formula: reward = -(lambda_audit*c_audit + lambda_attack*R/f) - det_penalty + bonuses")
            print(f"{'='*70}\n")
            compute_reward._debug_printed = True
            compute_reward._call_count = 0

        compute_reward._call_count = getattr(compute_reward, '_call_count', 0) + 1

        if compute_reward._call_count <= 3:
            print(f"\nREWARD CALL #{compute_reward._call_count}")
            print(f"   risk_score={st.risk_score:.3f}, freq={st.audit_frequency}, action={action.name}")
            print(f"   audit_cost_input={audit_cost:.4f}, c_audit={weights.lambda_audit * max(0.0, float(audit_cost)):.4f}")

    critical_threshold = 5.0
    if mean_baseline_delta > critical_threshold:
        return -500.0 - (mean_baseline_delta * 10.0)

    # ---- Detection terms (FP/FN) ----
    estimated_fp = 0.0
    estimated_fn = 0.0
    if st.risk_score < 0.3 and action == AuditAction.INC:
        estimated_fp = 1.0
    elif st.risk_score > 0.7 and action == AuditAction.DEC:
        estimated_fn = 1.0

    # Paper-aligned (Fix #5 - March 2026): FN penalty much heavier than FP penalty
    # FP weight = audit cost penalty (0.2) → low cost for false positives
    # FN weight = missed attacks penalty (5.0) → HEAVY cost for missing real attacks
    alpha_1 = weights.lambda_audit   # FP weight (0.2)
    alpha_2 = weights.lambda_attack  # FN weight (5.0) - CHANGED from hardcoded 2.0
    det_penalty = (alpha_1 * estimated_fp) + (alpha_2 * estimated_fn)

    # ---- Cost objective terms ----
    # FIX #7: Weighted audit cost + QUADRATIC risk penalty
    c_audit = weights.lambda_audit * max(0.0, float(audit_cost))

    # R/f term: protect high-risk agents from low frequency.
    f_eff = max(1.0, float(st.audit_frequency))
    r_over_f = float(st.risk_score) / f_eff
    c_failure = weights.lambda_attack * r_over_f
    
    # NEW: QUADRATIC penalty for high-risk agents with insufficient audits
    # This makes ignoring risky agents EXPONENTIALLY bad (not just linearly)
    quadratic_penalty = 0.0
    min_freq_required = max(1, int(weights.min_freq_high_risk))
    if st.risk_score > weights.high_risk_threshold and st.audit_frequency < min_freq_required:
        # Penalty grows with square of risk shortfall
        risk_excess = st.risk_score - weights.high_risk_threshold
        freq_deficit = min_freq_required - st.audit_frequency
        quadratic_penalty = weights.lambda_quadratic_risk * (risk_excess ** 2) * freq_deficit
    
    c_failure = c_failure + quadratic_penalty

    # High-risk inaction penalty: if risky and not increasing audits, penalize strongly
    high_risk_inaction_penalty = 0.0
    if st.risk_score > risk_threshold and action != AuditAction.INC:
        high_risk_inaction_penalty = (
            weights.lambda_attack
            * weights.high_risk_inaction_scale
            * max(0.0, float(st.risk_score - risk_threshold))
        )

    # New detector regime is recall-first; discourage audit increases on weak/no-anomaly states.
    low_risk_overaudit_penalty = 0.0
    anomaly_flag = int(getattr(st, "anomaly_flag", 0))
    model_confirmed = int(getattr(st, "model_confirmed", 0))
    if action == AuditAction.INC and anomaly_flag == 0:
        weak_risk_gap = max(0.0, float(risk_threshold - st.risk_score))
        weak_signal = 1.0 if model_confirmed == 0 else 0.5
        low_risk_overaudit_penalty = weights.lambda_false_positive_audit * weak_signal * (0.5 + weak_risk_gap)

    # Optional system-level shared failure term (from scheduler)
    if num_agents and num_agents > 0 and system_c_failure > 0.0:
        c_failure += 0.5 * (float(system_c_failure) / float(num_agents))

    # Stability pressure (cross-layer objective)
    stability_penalty = weights.lambda_stability * max(0.0, float(mean_baseline_delta))

    # Reactive bonus when high-risk and we increase audits
    react_bonus = 0.0
    if st.risk_score >= risk_threshold and action == AuditAction.INC:
        react_bonus = weights.bonus_react

    # Small bonus for verified blocked attacks
    detect_bonus = 0.25 * float(attacks_stopped) if attacks_stopped > 0 else 0.0

    # Mitigation bonus when risk decreases relative to previous state
    mitigation_bonus = 0.0
    if prev_risk is not None:
        mitigation_bonus = weights.lambda_risk_excess * max(0.0, float(prev_risk - st.risk_score))

    # Multi-objective scalarization
    # r = w1 * r_security - w2 * r_cost + w3 * r_precision
    r_security = detect_bonus + react_bonus + mitigation_bonus - c_failure - high_risk_inaction_penalty
    r_cost = c_audit + stability_penalty + low_risk_overaudit_penalty + (weights.lambda_budget_barrier * max(0.0, float(over_budget_excess)))
    r_precision = -det_penalty

    reward = (
        weights.w_security * r_security
        - weights.w_cost * r_cost
        + weights.w_precision * r_precision
    )
    return float(reward)
