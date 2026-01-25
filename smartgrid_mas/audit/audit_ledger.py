"""
Audit Ledger - tracks explicit audit events, spend, and coverage.

Paper-faithful implementation:
- Records every audit event (timestep, agent, cost)
- Tracks total spend and spend per timestep
- Computes true audit coverage (agents audited at least once / total)
- Supports budget constraint checking
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Set


@dataclass
class AuditEvent:
    """Single audit event record."""
    t: int
    agent_id: str
    cost: float


@dataclass
class AuditLedger:
    """
    Tracks all audit events and budget accounting for a simulation run.
    
    Attributes:
        events: List of all audit events executed
        total_spend: Cumulative audit cost across all timesteps
        spend_by_timestep: Map of timestep -> total cost at that timestep
        audited_agents: Set of unique agent IDs audited at least once
    """
    events: List[AuditEvent] = field(default_factory=list)
    total_spend: float = 0.0
    spend_by_timestep: Dict[int, float] = field(default_factory=dict)
    audited_agents: Set[str] = field(default_factory=set)

    def record_audit(self, t: int, agent_id: str, cost: float) -> None:
        """
        Record a single audit event.
        
        Args:
            t: Timestep when audit occurred
            agent_id: ID of agent audited
            cost: Cost of this audit
        """
        c = float(cost)
        self.events.append(AuditEvent(t=t, agent_id=agent_id, cost=c))
        self.total_spend += c
        self.spend_by_timestep[t] = self.spend_by_timestep.get(t, 0.0) + c
        self.audited_agents.add(agent_id)

    def coverage(self, total_agents: int) -> float:
        """
        Compute true audit coverage.
        
        Coverage = |agents audited at least once| / |total agents|
        
        Args:
            total_agents: Total number of agents in the system
            
        Returns:
            Coverage ratio [0.0, 1.0]
        """
        if total_agents <= 0:
            return 0.0
        return float(len(self.audited_agents)) / float(total_agents)

    def remaining_budget(self, budget: float) -> float:
        """
        Compute remaining audit budget.
        
        Args:
            budget: Total budget allocated for audit cycle
            
        Returns:
            Remaining budget (clamped to 0 if exhausted)
        """
        return float(max(0.0, float(budget) - self.total_spend))

    def audits_at_timestep(self, t: int) -> List[AuditEvent]:
        """Get all audit events at specific timestep."""
        return [e for e in self.events if e.t == t]

    def export_events(self) -> List[dict]:
        """Export events as list of dicts for CSV export."""
        return [
            {"t": e.t, "agent_id": e.agent_id, "cost": e.cost}
            for e in self.events
        ]

    def has_audit(self, agent_id: str) -> bool:
        """Return True if the agent has been audited at least once."""
        return agent_id in self.audited_agents
