import numpy as np
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentType, AgentCriticality

def test_agent_observe_and_history():
    a = BaseAgent(
        agent_id="A1",
        agent_type=AgentType.PMU,
        criticality=AgentCriticality(weight=0.7),
        bx=np.array([1.0, 1.0, 1.0]),
        by=np.array([1.0, 1.0]),
        thx=np.array([0.5, 0.5, 0.5]),
        thy=np.array([0.5, 0.5]),
    )

    st = a.observe(np.array([1.1, 0.9, 1.0]), np.array([0.2, 0.3]))
    assert st.x_phys.shape == (3,)
    assert st.y_cyber.shape == (2,)

    w = a.get_history_window(window=4)
    assert w["X"].shape == (4, 3)
    assert w["Y"].shape == (4, 2)

def test_risk_score_component():
    a = BaseAgent(
        agent_id="A2",
        agent_type=AgentType.GENERATOR,
        criticality=AgentCriticality(weight=2.0),
        bx=np.array([0.0]),
        by=np.array([0.0]),
        thx=np.array([1.0]),
        thy=np.array([1.0]),
    )
    r0 = a.update_risk_score_from_flag(0)
    r1 = a.update_risk_score_from_flag(1)
    assert r0 == 0.0
    assert r1 == 2.0

if __name__ == "__main__":
    test_agent_observe_and_history()
    test_risk_score_component()
    print("✓ All agent tests passed")
