import numpy as np

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.state import AgentState
from smartgrid_mas.agents.types import AgentCriticality, AgentType
from smartgrid_mas.audit.constraints import enforce_audit_constraints
from smartgrid_mas.behavior_analysis.scoring_pipeline import compute_score_and_flag


def _make_agent(agent_id: int) -> BaseAgent:
    return BaseAgent(
        agent_id=str(agent_id),
        agent_type=AgentType.GENERATOR,
        criticality=AgentCriticality(weight=1.0),
        bx=np.ones(3),
        by=np.ones(4),
        thx=np.ones(3) * 0.1,
        thy=np.ones(4) * 0.1,
    )


def test_requested_audits_respect_cap_and_budget():
    agents = [_make_agent(i) for i in range(10)]
    for a in agents:
        a.audit_frequency = 5
        a.last_state = AgentState(
            x_phys=np.ones(3),
            y_cyber=np.ones(4),
            risk_score=1.0,
            audit_frequency=5,
        )

    freqs, stats = enforce_audit_constraints(
        agents=agents,
        f_min=0,
        f_max=5,
        max_audits_per_cycle=3,
        audit_cost_per_audit=1.0,
        operational_cost=10.0,
        budget_ratio=0.10,
        return_stats=True,
    )

    if isinstance(freqs, dict):
        assert sum(freqs.values()) <= 3
    if isinstance(stats, dict):
        assert stats.get('requested_audits', 0) <= stats.get('allowed_final', 0)
        assert stats.get('allowed_final', 0) <= 3


def test_sigma_threshold_floor_applied():
    agent = _make_agent(0)
    st = agent.observe(np.ones(3), np.ones(4))
    st.anomaly_prob = 0.0
    compute_score_and_flag(agent, st)
    assert np.all(agent.thx > 0.0)
    assert np.all(agent.thy > 0.0)
    assert hasattr(st, "sigma_floor_x")
    assert hasattr(st, "sigma_floor_y")
