"""
Impact factor estimation for smart grid agents.

Maps agent types to normalized impact values [0, 1] based on their
criticality to grid operations.

Agent type impact hierarchy (paper-based):
    Generator:   High impact (8/10)   - Power supply disruption
    Substation:  High impact (7/10)   - Distribution hub failure
    Security:    Med-High (6/10)      - Cascade prevention
    Breaker:     Medium (5/10)        - Protection/isolation
    PMU:         Lower (3/10)         - Monitoring/telemetry
"""

from __future__ import annotations
from dataclasses import dataclass
from smartgrid_mas.agents.types import AgentType


@dataclass
class ImpactConfig:
    """Impact value configuration for different agent types."""
    generator: float = 8.0
    substation: float = 7.0
    breaker: float = 5.0
    pmu: float = 3.0
    security: float = 6.0
    max_impact: float = 10.0  # Normalization constant (paper uses 0-10 scale)


def impact_factor(
    agent_type: AgentType,
    cfg: ImpactConfig = ImpactConfig()
) -> float:
    """
    Compute normalized impact factor for agent type.
    
    ImpactFactor = raw_impact / max_impact
    
    Args:
        agent_type: Type of agent (GENERATOR, SUBSTATION, etc.)
        cfg: Impact configuration (default from paper)
    
    Returns:
        Normalized impact factor in [0, 1]
    
    Example:
        >>> impact_factor(AgentType.GENERATOR)
        0.8  # 8/10
        >>> impact_factor(AgentType.PMU)
        0.3  # 3/10
    """
    # Map agent type to raw impact value
    raw = {
        AgentType.GENERATOR: cfg.generator,
        AgentType.SUBSTATION: cfg.substation,
        AgentType.BREAKER: cfg.breaker,
        AgentType.PMU: cfg.pmu,
        AgentType.SECURITY: cfg.security,
    }[agent_type]
    
    # Normalize to [0, 1]
    normalized = raw / cfg.max_impact
    
    # Clamp to ensure bounds
    return float(max(0.0, min(1.0, normalized)))
