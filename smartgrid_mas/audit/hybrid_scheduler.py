"""
Hybrid RL + Gradient audit scheduler (paper-faithful).

Combines two optimization approaches:
    1. RL (Q-learning): Directional decisions (increase/decrease/hold)
    2. Gradient descent: Magnitude refinement based on cost function

Pipeline:
    Step 1: RL proposes frequency adjustments (discrete actions)
    Step 2: Gradient refines frequencies (continuous optimization)
    Step 3: Enforce global constraints (budget, max audits)

This matches the paper's approach where both RL and gradient-based
methods are used together for robust audit scheduling.
"""

from __future__ import annotations
from typing import List, Dict, Tuple

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.audit.audit_scheduler_rl import QLearningAuditScheduler
from smartgrid_mas.audit.schedule_step import rl_schedule_step
from smartgrid_mas.audit.gradient_step import gradient_opt_step, GradientTracker
from smartgrid_mas.audit.constraints import enforce_audit_constraints


def hybrid_audit_schedule(
    agents: List[BaseAgent],
    scheduler: QLearningAuditScheduler,
    risk_threshold: float,
    f_min: int,
    f_max: int,
    max_audits_per_cycle: int,
    audit_cost_per_audit: float,
    operational_cost: float,
    budget_ratio: float,
    # Gradient-specific parameters
    C_a: float,
    C_f: float,
    grad_lr: float = 0.01,  # Paper specification
    gradient_tracker: GradientTracker | None = None,
    # Ablation mode: 'HYBRID' (default), 'RL_ONLY', or 'GRADIENT_ONLY'
    ablation_mode: str = 'HYBRID',
) -> Tuple[Dict[str, int], Dict[str, float], Dict[str, int], Dict[str, tuple], Dict[str, float]]:
    """
    Hybrid RL + Gradient audit scheduling.
    
    Three-stage pipeline:
        1. RL stage: Q-learning proposes directional changes
        2. Gradient stage: Refine frequencies using cost gradient
        3. Constraint stage: Enforce budget and audit limits
    
    Args:
        agents: List of agents to schedule audits for
        scheduler: Q-learning scheduler instance
        risk_threshold: Threshold for high-risk classification
        f_min: Minimum audit frequency
        f_max: Maximum audit frequency
        max_audits_per_cycle: Maximum total audits per cycle
        audit_cost_per_audit: Cost per audit execution
        operational_cost: Total operational budget
        budget_ratio: Fraction of budget for audits
        C_a: Cost per audit (for gradient)
        C_f: Failure cost coefficient (for gradient)
        grad_lr: Gradient descent learning rate (default 0.01)
    
    Returns:
        Tuple of:
            - actions: Dict[agent_id, action_value] from RL stage
            - rewards: Dict[agent_id, reward_value] from RL stage
            - freqs: Dict[agent_id, final_frequency] after all stages
            - state_before: Dict[agent_id, state_tuple] for post-audit RL updates
            - constraint_stats: Dict of requested/allowed/denied audit counts
    
    Example:
        >>> scheduler = QLearningAuditScheduler(gamma=0.9, alpha=0.1, epsilon=0.5)
        >>> actions, rewards, freqs = hybrid_audit_schedule(
        ...     agents=my_agents,
        ...     scheduler=scheduler,
        ...     risk_threshold=0.5,
        ...     f_min=1, f_max=5,
        ...     max_audits_per_cycle=50,
        ...     audit_cost_per_audit=1.0,
        ...     operational_cost=1000.0,
        ...     budget_ratio=0.1,
        ...     C_a=1.0,
        ...     C_f=10.0,
        ...     grad_lr=0.01
        ... )
    """
    # Stage 1: RL directional decisions (Q-learning)
    # Proposes discrete actions: DEC/HOLD/INC for each agent
    actions, rewards, _, state_before = {}, {}, {}, {}
    if ablation_mode in ['HYBRID', 'RL_ONLY']:
        actions, rewards, _, state_before = rl_schedule_step(
            agents=agents,
            scheduler=scheduler,
            risk_threshold=risk_threshold,
            f_min=f_min,
            f_max=f_max,
            max_audits_per_cycle=max_audits_per_cycle,
            audit_cost_per_audit=audit_cost_per_audit,
            operational_cost=operational_cost,
            budget_ratio=budget_ratio,
        )
    
    # Stage 2: Gradient refinement (continuous optimization)
    # Uses cost function gradient to fine-tune frequencies
    if ablation_mode in ['HYBRID', 'GRADIENT_ONLY']:
        _ = gradient_opt_step(
            agents=agents,
            C_a=C_a,
            C_f=C_f,
            lr=grad_lr,
            f_min=f_min,
            f_max=f_max,
            tracker=gradient_tracker,
        )
    
    # Stage 3: Constraint enforcement (global limits)
    # Ensures total audits ≤ max and cost ≤ budget
    # Compute mean baseline delta for dynamic capacity
    mean_baseline_delta = float(sum(a.last_state.baseline_delta if a.last_state else 0.0 for a in agents)) / max(1, len(agents))
    
    freqs, constraint_stats = enforce_audit_constraints(
        agents=agents,
        f_min=f_min,
        f_max=f_max,
        max_audits_per_cycle=max_audits_per_cycle,
        audit_cost_per_audit=audit_cost_per_audit,
        operational_cost=operational_cost,
        budget_ratio=budget_ratio,
        mean_baseline_delta=mean_baseline_delta,
        ablation_mode=ablation_mode,
        return_stats=True,
    )
    
    return actions, rewards, freqs, state_before, constraint_stats
