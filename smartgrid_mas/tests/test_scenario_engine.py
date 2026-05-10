import numpy as np

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentCriticality, AgentType
from smartgrid_mas.environment.scenario_engine import ScenarioConfig, ScenarioEngine


def _agent(agent_id: str, agent_type: AgentType) -> BaseAgent:
    return BaseAgent(
        agent_id=agent_id,
        agent_type=agent_type,
        criticality=AgentCriticality(weight=1.0),
        bx=np.ones(3),
        by=np.ones(4),
        thx=np.ones(3) * 0.1,
        thy=np.ones(4) * 0.1,
    )


def test_type_aware_attack_pools_are_disjoint():
    agents = [
        _agent("g1", AgentType.GENERATOR),
        _agent("g2", AgentType.GENERATOR),
        _agent("s1", AgentType.SUBSTATION),
        _agent("s2", AgentType.SUBSTATION),
        _agent("p1", AgentType.PMU),
        _agent("p2", AgentType.PMU),
        _agent("b1", AgentType.BREAKER),
        _agent("b2", AgentType.BREAKER),
    ]
    engine = ScenarioEngine(
        agents,
        ScenarioConfig(seed=7, fdi_rate=0.25, dos_rate=0.25, mitm_rate=0.25, chain_rate=0.0, fault_rate=0.0),
    )

    assert engine.fdi_set.isdisjoint(engine.dos_set)
    assert engine.fdi_set.isdisjoint(engine.mitm_set)
    assert engine.dos_set.isdisjoint(engine.mitm_set)


def test_fault_sampling_prefers_physical_asset_types():
    agents = [
        _agent("g1", AgentType.GENERATOR),
        _agent("s1", AgentType.SUBSTATION),
        _agent("p1", AgentType.PMU),
        _agent("b1", AgentType.BREAKER),
    ]
    engine = ScenarioEngine(
        agents,
        ScenarioConfig(seed=11, fdi_rate=0.0, dos_rate=0.0, mitm_rate=0.0, chain_rate=0.0, fault_rate=0.5),
    )

    faults = engine.faults_at(0)
    assert faults["p1"].name == "NONE"
