from __future__ import annotations
from typing import List, Dict, Tuple
import logging
from smartgrid_mas.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


def enforce_audit_constraints(
    agents: List[BaseAgent],
    f_min: int,
    f_max: int,
    max_audits_per_cycle: int,
    audit_cost_per_audit: float,
    operational_cost: float,
    budget_ratio: float,
    mean_baseline_delta: float = 0.0,
    ablation_mode: str = 'HYBRID',
    return_stats: bool = False,
) -> Dict[str, int] | tuple[Dict[str, int], Dict[str, float]]:
    """
    Enforce paper constraints on audit frequencies with DYNAMIC CAPACITY SCALING.
    
    PROTOCOL C: THE "EMERGENCY OVERDRAFT" (Scalability Fix)
    - Base capacity: uses config max_audits_per_cycle (honors user setting, min 10)
    - Emergency overdraft: If mean_baseline_delta > 1.0, allow 3× capacity
    - Cost scaling: Overdraft audits cost 3× more (models emergency overtime spending)
    
    Constraints (in order):
    1. f_i ∈ [f_min, f_max] for all agents
    2. Σ f_i ≤ dynamic_max_audits (scales with grid size + crisis severity)
    3. Σ f_i * cost_per_audit ≤ budget_ratio * operational_cost (adjusted for overdraft)
    
    If constraints violated, reduce frequencies starting from lowest-risk agents
    (preserve auditing for high-risk agents).
    
    Args:
        agents: List of agents
        f_min: Minimum audit frequency per agent
        f_max: Maximum audit frequency per agent
        max_audits_per_cycle: DEPRECATED - now computed dynamically
        audit_cost_per_audit: Cost per single audit (base rate)
        operational_cost: Total operational cost (for budget percentage)
        budget_ratio: Fraction of operational cost allocated to audits
        mean_baseline_delta: CRITICAL - Physical grid deviation (triggers overdraft)
    
    Returns:
        Dict mapping agent_id → final audit frequency
    """
    # Step 1: Clamp all frequencies to [f_min, f_max]
    for agent in agents:
        agent.set_audit_frequency(agent.audit_frequency, f_min=f_min, f_max=f_max)

    # ==================== DYNAMIC CAPACITY CALCULATION ====================
    # PROTOCOL C: Scale audit capacity based on grid size AND crisis severity
    
    num_agents = len(agents)
    
    # Base capacity: Use config max_audits_per_cycle (honors user configuration)
    # Fallback to 10% of agents if config value is unreasonably low
    base_cap = max(10, max_audits_per_cycle)
    
    # Emergency overdraft: If physics are critical, triple the capacity to stop cascade
    # Lowered threshold to 1.0 (from 5.0) to trigger during realistic deviations
    CRITICAL_THRESHOLD = 1.0
    is_crisis = mean_baseline_delta > CRITICAL_THRESHOLD
    dynamic_max_audits = base_cap * 3 if is_crisis else base_cap
    
    # Cost multiplier: Overdraft audits cost 3× more (emergency overtime spending)
    # This models: hiring emergency contractors, expedited processing, priority handling
    cost_multiplier = 3.0 if is_crisis else 1.0
    effective_audit_cost = audit_cost_per_audit * cost_multiplier
    
    logger.info(
        "Dynamic Audit Capacity | num_agents=%d | base_cap=%d | delta=%.2f | crisis=%s | dynamic_max=%d | cost_multiplier=%.1f",
        num_agents, base_cap, mean_baseline_delta, is_crisis, dynamic_max_audits, cost_multiplier,
    )

    # Compute allowed audits from both count and budget
    requested_raw = sum(agent.audit_frequency for agent in agents)
    budget_allowed = float(budget_ratio * operational_cost)
    max_by_budget = int(budget_allowed // effective_audit_cost) if effective_audit_cost > 0 else dynamic_max_audits

    # Risk-weighted clamp: only provision audits in proportion to higher-risk agents
    high = [ag for ag in agents if ag.last_state and ag.last_state.risk_score >= 0.6]
    mid = [ag for ag in agents if ag.last_state and 0.3 <= ag.last_state.risk_score < 0.6]
    risk_cap = int(len(high) * f_max + len(mid) * 0.5 * f_max)
    # Baseline reference: do not exceed 110% of configured cap (keeps spend near baseline)
    baseline_cap_110 = int(1.1 * max_audits_per_cycle)

    allowed_total = max(0, min(requested_raw, max(dynamic_max_audits, max_by_budget)))
    allowed_total = min(allowed_total, risk_cap if risk_cap > 0 else f_max)  # disallow mass audits when risk≈0
    allowed_total = min(allowed_total, baseline_cap_110)

    # Cluster-aware priority: rank by risk with cluster mean risk as a small bonus
    cluster_risk_sum: Dict[int, float] = {}
    cluster_counts: Dict[int, int] = {}
    for ag in agents:
        if ag.last_state is None:
            continue
        c_lbl = getattr(ag.last_state, "cluster_label", None)
        if c_lbl is None:
            continue
        cluster_risk_sum[c_lbl] = cluster_risk_sum.get(c_lbl, 0.0) + float(ag.last_state.risk_score)
        cluster_counts[c_lbl] = cluster_counts.get(c_lbl, 0) + 1
    cluster_risk_mean = {k: (cluster_risk_sum[k] / cluster_counts[k]) for k in cluster_risk_sum}

    def priority(agent: BaseAgent) -> float:
        r = agent.last_state.risk_score if agent.last_state else 0.0
        c_lbl = getattr(agent.last_state, "cluster_label", None) if agent.last_state else None
        cluster_bonus = cluster_risk_mean.get(c_lbl, 0.0) if c_lbl is not None else 0.0
        return float(r + 0.1 * cluster_bonus)

    agents_by_priority = sorted(
        agents,
        key=lambda x: (priority(x), getattr(x.last_state, "cluster_label", -1)),
        reverse=True,
    )

    remaining = allowed_total
    denied_budget = 0
    high_risk_denied = 0
    risk_cutoff = 0.7

    for agent in agents_by_priority:
        desired = max(f_min, min(f_max, agent.audit_frequency))

        if remaining <= 0:
            # No budget/cap left → zero this agent
            agent.set_audit_frequency(0, f_min=0, f_max=f_max)
            if desired > 0:
                denied_budget += 1
            if agent.last_state and agent.last_state.risk_score > risk_cutoff:
                high_risk_denied += 1
            continue

        grant = min(desired, remaining)
        agent.set_audit_frequency(grant, f_min=0, f_max=f_max)
        remaining -= grant

        if grant == 0 and agent.last_state and agent.last_state.risk_score > risk_cutoff:
            high_risk_denied += 1

    # Warn only when denial is disproportionate to available budget/cap
    if high_risk_denied > 0 and requested_raw > allowed_total:
        ratio = high_risk_denied / max(1, allowed_total)
        if ratio > 2.0:  # suppress spam when everyone is high-risk but cap is tight
            logger.warning(
                "FAILURE_MODE: audit_selection_truncated | "
                f"high_risk_agents_denied={high_risk_denied} | "
                f"requested_audits={requested_raw} | "
                f"allowed_max={allowed_total}"
            )

    freqs = {agent.agent_id: agent.audit_frequency for agent in agents}

    if not return_stats:
        return freqs

    stats = {
        "requested_audits": float(min(requested_raw, allowed_total)),
        "requested_audits_raw": float(requested_raw),
        "allowed_by_cap": float(max_audits_per_cycle),
        "allowed_by_budget": float(max_by_budget),
        "allowed_final": float(allowed_total),
        "assigned_audits": float(sum(freqs.values())),
        "high_risk_denied": float(high_risk_denied),
        "denied_budget": float(denied_budget),
    }
    return freqs, stats
