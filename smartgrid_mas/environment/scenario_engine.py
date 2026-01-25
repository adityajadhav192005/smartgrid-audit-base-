from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Tuple, Set
import numpy as np

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentType
from smartgrid_mas.data.cyber_attacks import AttackType
from smartgrid_mas.data.synthetic_faults import FaultType

@dataclass
class ScenarioConfig:
    seed: int = 42
    fdi_rate: float = 0.10
    dos_rate: float = 0.05
    mitm_rate: float = 0.00
    chain_rate: float = 0.05  # fraction of breakers involved in chain
    fault_rate: float = 0.05  # fraction with physical faults at a time
    fault_types: Tuple[FaultType, ...] = (
        FaultType.VOLTAGE_SAG,
        FaultType.OVERCURRENT,
        FaultType.FREQ_DEV,
    )

class ScenarioEngine:
    def __init__(self, agents: List[BaseAgent], cfg: ScenarioConfig = ScenarioConfig()):
        self.cfg = cfg
        self.rng = np.random.default_rng(cfg.seed)
        self.agent_ids = [a.agent_id for a in agents]

        self.breakers = [a.agent_id for a in agents if a.agent_type == AgentType.BREAKER]
        self.substations = [a.agent_id for a in agents if a.agent_type == AgentType.SUBSTATION]

        self.fdi_set = self._sample_set(self.agent_ids, cfg.fdi_rate)
        self.dos_set = self._sample_set(self.agent_ids, cfg.dos_rate)
        self.mitm_set = self._sample_set(self.agent_ids, cfg.mitm_rate)

        self.chain_pairs = self._sample_chain_pairs(cfg.chain_rate)
        
        # Track audited agents to prevent re-attack
        self.audited_agents: Dict[str, int] = {}  # agent_id → timestep of audit
        self.audit_protection_window = 24  # hours of protection after successful audit

    def _sample_set(self, ids: List[str], rate: float) -> Set[str]:
        k = int(round(rate * len(ids)))
        if k <= 0:
            return set()
        return set(self.rng.choice(ids, size=min(k, len(ids)), replace=False).tolist())

    def _sample_chain_pairs(self, chain_rate: float) -> List[Tuple[str, str]]:
        """
        Returns list of (breaker_id, substation_id) pairs representing coordinated attack chain.
        """
        if not self.breakers or not self.substations:
            return []
        k = int(round(chain_rate * len(self.breakers)))
        k = max(0, min(k, len(self.breakers)))
        selected_breakers = self.rng.choice(self.breakers, size=k, replace=False).tolist()
        pairs = []
        for b in selected_breakers:
            s = self.rng.choice(self.substations)
            pairs.append((b, s))
        return pairs

    def attacks_at(self, t: int) -> Dict[str, AttackType]:
        atk = {aid: AttackType.NONE for aid in self.agent_ids}
        
        # Skip agents that were recently audited (protection window)
        protected = set()
        for aid, audit_time in self.audited_agents.items():
            if t - audit_time < self.audit_protection_window:
                protected.add(aid)
        
        for aid in self.fdi_set:
            if aid not in protected:
                atk[aid] = AttackType.FDI
        for aid in self.dos_set:
            if aid not in protected and atk[aid] == AttackType.NONE:
                atk[aid] = AttackType.DOS
        for aid in self.mitm_set:
            if aid not in protected:
                atk[aid] = AttackType.MITM
        # Apply coordinated chain attacks (breaker-substation pairs)
        for b, s in self.chain_pairs:
            if b not in protected:
                atk[b] = AttackType.MITM
            if s not in protected:
                atk[s] = AttackType.FDI
        return atk
    
    def mark_audited(self, agent_id: str, timestep: int) -> None:
        """Mark an agent as audited at a specific timestep to prevent re-attack."""
        self.audited_agents[agent_id] = timestep
    
    def get_chain_attacks(self) -> List[Tuple[str, str]]:
        """Return list of coordinated chain attack pairs (breaker_id, substation_id)."""
        return self.chain_pairs
    
    def is_chain_attack(self, agent_id: str) -> bool:
        """Check if agent is involved in a coordinated chain attack."""
        for b, s in self.chain_pairs:
            if agent_id == b or agent_id == s:
                return True
        return False

    def faults_at(self, t: int) -> Dict[str, FaultType]:
        faults = {aid: FaultType.NONE for aid in self.agent_ids}
        k = int(round(self.cfg.fault_rate * len(self.agent_ids)))
        if k <= 0:
            return faults
        chosen = self.rng.choice(self.agent_ids, size=min(k, len(self.agent_ids)), replace=False).tolist()
        for aid in chosen:
            faults[aid] = self.rng.choice(self.cfg.fault_types)
        return faults
