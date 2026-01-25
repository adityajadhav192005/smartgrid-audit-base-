"""
Audit Executor - converts audit frequencies into real audit events.

Paper-faithful implementation:
- Priority-based selection: risk_score * (f_i / f_max)
- Budget constraints: audits only executed if budget available
- Capacity constraints: max audits per timestep
- Realistic audit event generation (not approximated)
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List
import os

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.audit.audit_ledger import AuditLedger


@dataclass
class AuditExecConfig:
    """
    Configuration for audit execution engine.
    
    Attributes:
        f_max: Maximum audit frequency (for normalization)
        max_audits_per_timestep: Maximum audits allowed per timestep
        audit_cost_per_audit: Cost of single audit ($)
    """
    f_max: int = 5
    max_audits_per_timestep: int = 1
    audit_cost_per_audit: float = 1.0


def execute_audits(
    agents: List[BaseAgent],
    t: int,
    ledger: AuditLedger,
    remaining_budget: float,
    cfg: AuditExecConfig,
) -> List[str]:
    """
    Execute audits for current timestep based on priority scoring.
    
    Algorithm:
    1. Compute priority = risk_score * (f_i / f_max) for each agent
    2. Sort agents by priority (descending)
    3. Select top agents up to max_audits_per_timestep
    4. Execute audits if budget allows
    5. Record events in ledger
    
    Args:
        agents: List of all agents in system
        t: Current timestep
        ledger: AuditLedger to record events
        remaining_budget: Available budget for audits
        cfg: Audit execution configuration
        
    Returns:
        List of agent IDs that were audited this timestep
    """
    audited: List[str] = []
    
    # No audits if budget exhausted
    if remaining_budget <= 0:
        return audited

    # Compute priority scores
    scored = []
    for a in agents:
        if a.last_state is None:
            continue
        if a.audit_frequency <= 0:
            continue
        
        # Normalize frequency: f_i / f_max
        norm_f = float(a.audit_frequency) / float(cfg.f_max)
        
        # Priority: risk * normalized frequency
        # Higher risk + higher frequency → higher priority
        priority = float(a.last_state.risk_score) * norm_f

        # Fairness bonus: prioritize agents never audited to improve coverage
        fairness_bonus = 0.0
        try:
            fairness_bonus = float(os.environ.get("SMARTGRID_FAIRNESS_BONUS", 0.0))
        except Exception:
            fairness_bonus = 0.0
        if fairness_bonus > 0.0 and not ledger.has_audit(a.agent_id):
            priority += fairness_bonus
        scored.append((priority, a))

    # Sort by priority (highest first)
    scored.sort(key=lambda x: x[0], reverse=True)

    # Execute top audits up to capacity and budget
    for priority, a in scored[: cfg.max_audits_per_timestep]:
        # Check budget constraint
        if remaining_budget < cfg.audit_cost_per_audit:
            break
        
        # Record audit event
        ledger.record_audit(t, a.agent_id, cfg.audit_cost_per_audit)
        remaining_budget -= cfg.audit_cost_per_audit
        audited.append(a.agent_id)

    return audited
