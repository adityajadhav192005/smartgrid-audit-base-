from __future__ import annotations
from dataclasses import dataclass
from enum import Enum

class AgentType(str, Enum):
    GENERATOR = "generator"
    SUBSTATION = "substation"
    PMU = "pmu"
    BREAKER = "breaker"
    SECURITY = "security"

@dataclass(frozen=True)
class AgentCriticality:
    """Paper's criticality weight w_i (>=0)."""
    weight: float
