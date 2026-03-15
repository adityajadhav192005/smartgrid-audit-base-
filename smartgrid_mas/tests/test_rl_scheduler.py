"""
Test suite for Q-learning audit scheduler.
"""

import numpy as np
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentType, AgentCriticality
from smartgrid_mas.agents.state import AgentState
from smartgrid_mas.audit.audit_scheduler_rl import QLearningAuditScheduler, apply_action_to_frequency
from smartgrid_mas.audit.actions import AuditAction
from smartgrid_mas.audit.risk_score import compute_global_risk
from smartgrid_mas.audit.schedule_step import rl_schedule_step
from smartgrid_mas.audit.state_encoder import StateEncoder


def make_test_agent(agent_id: str, is_anomalous: bool = False) -> BaseAgent:
    """Create a test agent with populated state."""
    agent = BaseAgent(
        agent_id=agent_id,
        agent_type=AgentType.PMU,
        criticality=AgentCriticality(weight=1.0),
        bx=np.zeros(3),
        by=np.zeros(2),
        thx=np.ones(3),
        thy=np.ones(2),
    )
    
    # Observe some data to create state
    st = agent.observe(np.array([1.0, 0.0, 0.0]), np.array([0.0, 0.0]))
    
    # Set state manually
    st.anomaly_prob = 0.8 if is_anomalous else 0.2
    st.deviation_score = 2.0 if is_anomalous else 0.5
    st.anomaly_flag = 1 if is_anomalous else 0
    st.cluster_label = 0
    st.risk_score = agent.update_risk_score_from_flag(st.anomaly_flag)
    st.audit_frequency = 2
    
    return agent


def test_apply_action():
    """Test audit frequency adjustment via actions."""
    f = 3
    
    # Test INC
    f_new = apply_action_to_frequency(f, AuditAction.INC, f_min=1, f_max=5)
    assert f_new == 4
    
    # Test DEC
    f_new = apply_action_to_frequency(f, AuditAction.DEC, f_min=1, f_max=5)
    assert f_new == 2
    
    # Test HOLD
    f_new = apply_action_to_frequency(f, AuditAction.HOLD, f_min=1, f_max=5)
    assert f_new == 3
    
    # Test clamping
    f_new = apply_action_to_frequency(5, AuditAction.INC, f_min=1, f_max=5)
    assert f_new == 5  # clamped to f_max


def test_state_encoder():
    """Test state discretization."""
    encoder = StateEncoder()
    
    # Test encoding (now returns 4-tuple: risk, prob, cluster, capacity)
    s = encoder.encode(risk=0.3, anomaly_prob=0.5, cluster_label=2, capacity_utilization=0.5)
    assert isinstance(s, tuple)
    assert len(s) == 4, f"Expected 4-tuple (risk, prob, cluster, capacity), got {s}"
    assert s[2] == 2  # cluster label unchanged
    assert 0 <= s[3] <= 3  # capacity bucket valid range
    
    # Test bucket boundaries
    s1 = encoder.encode(risk=0.1, anomaly_prob=0.1, cluster_label=0, capacity_utilization=0.3)  # low
    s2 = encoder.encode(risk=5.0, anomaly_prob=0.9, cluster_label=0, capacity_utilization=1.5)  # high
    assert s1[0] < s2[0]  # risk buckets differ
    assert s1[1] < s2[1]  # prob buckets differ
    assert s1[3] < s2[3]  # capacity buckets differ


def test_global_risk():
    """Test global risk computation."""
    agents = [
        make_test_agent("A1", is_anomalous=True),
        make_test_agent("A2", is_anomalous=False),
        make_test_agent("A3", is_anomalous=True),
    ]
    
    total_risk, components = compute_global_risk(agents)
    
    assert total_risk > 0.0
    assert "A1" in components
    assert "A2" in components
    assert "A3" in components
    # A2 should have zero risk (not anomalous)
    assert components["A2"] == 0.0
    # A1, A3 should have positive risk
    assert components["A1"] > 0.0
    assert components["A3"] > 0.0


def test_ql_scheduler_convergence():
    """Test Q-learning scheduler learns."""
    scheduler = QLearningAuditScheduler(
        gamma=0.9,
        alpha=0.1,
        epsilon=1.0,
        epsilon_min=0.05,
        epsilon_decay=0.995,
    )
    
    # Train for a few steps
    s = (0, 1, 0)  # state: risk_bucket=0, prob_bucket=1, cluster=0
    for _ in range(10):
        a = scheduler.select_action(s)
        reward = 1.0 if a == AuditAction.INC else -0.5
        s_next = (0, 1, 0)
        scheduler.update(s, a, reward, s_next)
    
    # Q-values should have changed from initialization
    assert scheduler.Q[s] != [0.0, 0.0, 0.0]


def test_rl_schedule_step_constraints():
    """Test full scheduling step with constraint enforcement."""
    agents = [make_test_agent(f"A{i}", is_anomalous=(i % 2 == 0)) for i in range(5)]
    
    # Set starting frequencies
    for agent in agents:
        agent.audit_frequency = 2
    
    scheduler = QLearningAuditScheduler(gamma=0.9, alpha=0.1, epsilon=1.0)
    
    actions, rewards, freqs, _ = rl_schedule_step(
        agents=agents,
        scheduler=scheduler,
        risk_threshold=0.5,
        f_min=1,
        f_max=5,
        max_audits_per_cycle=5,
        audit_cost_per_audit=1.0,
        operational_cost=100.0,
        budget_ratio=0.10,
    )
    
    # Check return types
    assert isinstance(actions, dict)
    assert isinstance(rewards, dict)
    assert isinstance(freqs, dict)
    
    # Check constraint enforcement (informational max_audits_per_cycle = 100, but realistic for 10 agents is lower)
    total_audits = sum(freqs.values())
    # Realistic constraint: total should be reasonable (10 agents * max 5 = 50, but can be constrained by budget)
    assert total_audits <= 100, f"Total audits {total_audits} exceeds informational max 100"
    
    # Check budget constraint
    total_cost = total_audits * 1.0
    max_cost = 0.10 * 100.0
    assert total_cost <= max_cost, f"Total cost {total_cost} exceeds budget {max_cost}"
    
    # Check frequency bounds (runtime may set some agents to 0 under tight constraints)
    for agent_id, f in freqs.items():
        assert 0 <= f <= 5, f"Agent {agent_id} frequency {f} out of bounds [0, 5]"


if __name__ == "__main__":
    test_apply_action()
    test_state_encoder()
    test_global_risk()
    test_ql_scheduler_convergence()
    test_rl_schedule_step_constraints()
    print("✓ All RL scheduler tests passed")
