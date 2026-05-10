from __future__ import annotations
from typing import List, Dict, Tuple
import logging
import os
import math
from smartgrid_mas.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# Dual variable for soft budget constraint (Lagrangian relaxation)
_DUAL_LAMBDA: float = 0.0


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
    cluster_budget_caps: Dict[int, int] | None = None,
    return_stats: bool = False,
) -> Dict[str, int] | tuple[Dict[str, int], Dict[str, float]]:
    """
    Enforce paper constraints on audit frequencies with DYNAMIC CAPACITY SCALING.
    
    PROTOCOL C: THE "EMERGENCY OVERDRAFT" (Scalability Fix)
    - Base capacity: uses config max_audits_per_cycle (honors user setting exactly)
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

    # Optional NO-CONSTRAINTS mode: preserve RL-selected frequencies (within f bounds)
    # Enable with SMARTGRID_DISABLE_CONSTRAINTS=1 or ablation_mode="NO_CONSTRAINTS".
    disable_constraints = (
        os.environ.get("SMARTGRID_DISABLE_CONSTRAINTS", "0").strip().lower() in {"1", "true", "yes", "on"}
        or str(ablation_mode).upper() == "NO_CONSTRAINTS"
    )
    if disable_constraints:
        freqs = {agent.agent_id: agent.audit_frequency for agent in agents}
        if not return_stats:
            return freqs
        assigned = float(sum(freqs.values()))
        stats = {
            "requested_audits": assigned,
            "requested_audits_raw": assigned,
            "allowed_by_cap": assigned,
            "allowed_by_budget": assigned,
            "allowed_final": assigned,
            "assigned_audits": assigned,
            "high_risk_denied": 0.0,
            "denied_budget": 0.0,
        }
        return freqs, stats

    # ==================== DYNAMIC CAPACITY CALCULATION ====================
    # PROTOCOL C: Scale audit capacity based on grid size AND crisis severity
    
    num_agents = len(agents)
    
    # Base capacity: keep the configured cap for smaller runs, but allow
    # scale-aware growth for larger grids so large-N experiments are not
    # artificially under-audited by a flat ceiling.
    base_cap = max(1, int(max_audits_per_cycle))
    cap_fraction = float(os.environ.get("SMARTGRID_MAX_AUDIT_FRACTION", "0.40"))
    scaled_cap = int(math.ceil(max(0.0, cap_fraction) * num_agents))

    # Keep small-N behavior stable by preserving the configured base cap there,
    # while allowing larger grids to scale up to a fraction of agents per cycle.
    is_crisis = False
    dynamic_max_audits = max(base_cap, scaled_cap)
    
    # Cost multiplier: Overdraft audits cost 3× more (emergency overtime spending)
    # This models: hiring emergency contractors, expedited processing, priority handling
    cost_multiplier = 1.0
    effective_audit_cost = audit_cost_per_audit * cost_multiplier
    
    logger.info(
        "Dynamic Audit Capacity | num_agents=%d | base_cap=%d | delta=%.2f | crisis=%s | dynamic_max=%d | cost_multiplier=%.1f",
        num_agents, base_cap, mean_baseline_delta, is_crisis, dynamic_max_audits, cost_multiplier,
    )

    # Compute cap-limited audits (budget is handled softly via Lagrangian)
    requested_raw = sum(agent.audit_frequency for agent in agents)

    # Dynamic budget scaling based on mean system risk
    mean_risk = float(sum((a.last_state.risk_score if a.last_state else 0.0) for a in agents) / max(1, len(agents)))
    dynamic_budget_k = float(os.environ.get("SMARTGRID_DYNAMIC_BUDGET_K", 0.5))
    effective_budget_ratio = float(budget_ratio) * (1.0 + dynamic_budget_k * mean_risk)
    budget_allowed = float(effective_budget_ratio * operational_cost)

    # Soft budget constraint via Lagrangian dual update
    global _DUAL_LAMBDA
    soft_dual_lr = float(os.environ.get("SMARTGRID_SOFT_BUDGET_DUAL_LR", 0.05))
    requested_cost = float(requested_raw) * float(effective_audit_cost)
    budget_excess = requested_cost - budget_allowed
    norm = max(1e-6, budget_allowed)
    _DUAL_LAMBDA = max(0.0, float(_DUAL_LAMBDA + soft_dual_lr * (budget_excess / norm)))

    # Count cap remains to keep physical/operational sanity
    allowed_total = max(0, min(requested_raw, dynamic_max_audits))

    # Smooth scaling (not hard truncation) when budget is exceeded
    excess_ratio = max(0.0, budget_excess / norm)
    soft_scale = 1.0 / (1.0 + _DUAL_LAMBDA * excess_ratio)

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

    cluster_remaining: Dict[int, int] = {}
    if cluster_budget_caps:
        cluster_remaining = {int(k): int(v) for k, v in cluster_budget_caps.items()}

    for agent in agents_by_priority:
        desired = max(f_min, min(f_max, agent.audit_frequency))
        
        # FIX #7: FORCE minimum audits for high-risk agents (governance override)
        # This prevents RL from "gaming" by ignoring high-risk agents
        is_high_risk = agent.last_state and agent.last_state.risk_score > 0.75
        forced_minimum = 2 if is_high_risk else f_min
        
        if remaining <= 0:
            # Even with no budget, give high-risk agents emergency minimum
            grant = forced_minimum if is_high_risk and forced_minimum <= f_min else 0
        else:
            # Ensure high-risk agents get at least forced_minimum
            scaled_desired = max(0, int(round(desired * soft_scale)))
            effective_desired = max(forced_minimum, scaled_desired)
            grant = min(effective_desired, remaining)

        # Hierarchical cap per cluster (master policy)
        if cluster_remaining:
            c_lbl = int(getattr(agent.last_state, "cluster_label", -1)) if agent.last_state else -1
            cap_left = cluster_remaining.get(c_lbl, 0)
            grant = min(grant, cap_left)
            cluster_remaining[c_lbl] = max(0, cap_left - grant)

        agent.set_audit_frequency(grant, f_min=0, f_max=f_max)
        remaining -= max(0, grant)

        if grant == 0 and desired > 0:
            denied_budget += 1
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

    # ==================== GLOBAL MINIMUM COVERAGE CONSTRAINT (40% RULE) ====================
    # Paper-aligned governance: Ensure at least 40% of agents receive audits per cycle
    # This prevents RL from under-auditing despite cost optimization pressure
    min_coverage_pct = float(os.environ.get("SMARTGRID_MIN_COVERAGE_PCT", "0.40"))
    min_agents_requested = int(math.ceil(min_coverage_pct * len(agents)))
    max_coverable_agents = min(
        len(agents),
        int(math.floor(float(dynamic_max_audits) / max(1, int(f_min)))),
    )
    min_agents_covered = min(min_agents_requested, max_coverable_agents)
    if min_agents_requested > max_coverable_agents:
        logger.info(
            "Coverage constraint clipped to feasible bound | "
            f"requested_min_covered={min_agents_requested} | "
            f"max_coverable={max_coverable_agents} | "
            f"num_agents={len(agents)} | f_min={f_min} | dynamic_max={dynamic_max_audits}"
        )
    agents_covered = sum(1 for agent in agents if agent.audit_frequency > 0)
    
    if agents_covered < min_agents_covered:
        shortfall = min_agents_covered - agents_covered
        logger.warning(
            "GOVERNANCE_OVERRIDE: Global minimum coverage constraint triggered | "
            f"agents_covered={agents_covered} | min_required={min_agents_covered} | "
            f"shortfall={shortfall} | forcing additional audits"
        )
        
        # Identify agents with zero audits, sorted by priority (risk + cluster bonus)
        zero_audit_agents = [a for a in agents if a.audit_frequency == 0]
        zero_audit_agents_by_priority = sorted(
            zero_audit_agents,
            key=lambda x: (priority(x), getattr(x.last_state, "cluster_label", -1)),
            reverse=True
        )
        
        # Force minimum audit frequency (f_min) for top-priority zero-audit agents
        forced_count = 0
        for agent in zero_audit_agents_by_priority:
            if forced_count >= shortfall:
                break
            agent.set_audit_frequency(f_min, f_min=f_min, f_max=f_max)
            forced_count += 1
        
        logger.info(
            f"GOVERNANCE_OVERRIDE: Forced {forced_count} additional agents to f_min={f_min} "
            f"to meet feasible minimum coverage target {min_agents_covered}/{len(agents)}"
        )
    
    freqs = {agent.agent_id: agent.audit_frequency for agent in agents}

    if not return_stats:
        return freqs

    stats = {
        "requested_audits": float(min(requested_raw, allowed_total)),
        "requested_audits_raw": float(requested_raw),
        "allowed_by_cap": float(dynamic_max_audits),
        "allowed_by_budget": float(budget_allowed / max(1e-9, effective_audit_cost)),
        "allowed_final": float(allowed_total),
        "assigned_audits": float(sum(freqs.values())),
        "high_risk_denied": float(high_risk_denied),
        "denied_budget": float(denied_budget),
        "dual_lambda": float(_DUAL_LAMBDA),
        "budget_ratio_effective": float(effective_budget_ratio),
        "soft_scale": float(soft_scale),
        "min_coverage_pct": float(min_coverage_pct),
        "min_agents_covered_target": float(min_agents_covered),
        "max_coverable_agents": float(max_coverable_agents),
        "agents_covered": float(sum(1 for agent in agents if agent.audit_frequency > 0)),
    }
    return freqs, stats
