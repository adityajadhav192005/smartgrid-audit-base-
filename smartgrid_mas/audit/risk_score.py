from __future__ import annotations
from typing import List, Dict, Tuple
from smartgrid_mas.agents.base_agent import BaseAgent


def compute_global_risk(agents: List[BaseAgent]) -> Tuple[float, Dict[str, float]]:
    """
    Compute global risk score for the grid.
    
    Paper: R(t) = Σ_i w_i * a_i(t)
    where a_i(t) = anomaly_flag, w_i = criticality weight
    
    Args:
        agents: List of BaseAgent instances
    
    Returns:
        total_risk: Scalar R(t)
        components: Dict mapping agent_id → w_i * a_i(t)
    """
    total = 0.0
    components: Dict[str, float] = {}
    
    for agent in agents:
        if agent.last_state is None:
            components[agent.agent_id] = 0.0
            continue

        # PAPER-FAITHFUL RISK (pinned reference):
        # R(t) = Σ_i w_i * a_i(t)
        # Always use binary anomaly flag and criticality weight for evaluation.
        a_i = 1 if agent.last_state.anomaly_flag else 0
        r_i = float(agent.criticality.weight * a_i)

        components[agent.agent_id] = r_i
        total += r_i
    
    return float(total), components
