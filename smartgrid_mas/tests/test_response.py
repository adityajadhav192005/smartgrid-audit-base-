"""
Tests for response mechanism: severity scoring, mitigation, feedback.

Test coverage:
    1. Severity score computation
    2. Severity level classification
    3. Impact factor mapping
    4. Likelihood calculation
    5. Mitigation actions by severity level
    6. Full response pipeline
    7. Risk feedback scaling
"""

import numpy as np

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentType, AgentCriticality
from smartgrid_mas.response.severity_scoring import (
    compute_severity_score,
    likelihood_from_history,
    severity_level,
    SeverityLevel,
    SeverityWeights,
)
from smartgrid_mas.response.impact_factor import impact_factor
from smartgrid_mas.response.mitigation_actions import apply_mitigation
from smartgrid_mas.response.response_controller import response_step


def make_test_agent(agent_id: str, agent_type: AgentType) -> BaseAgent:
    """Create test agent with minimal setup."""
    agent = BaseAgent(
        agent_id=agent_id,
        agent_type=agent_type,
        criticality=AgentCriticality(weight=2.0),
        bx=np.array([0.0]),
        by=np.array([0.0]),
        thx=np.array([1.0]),
        thy=np.array([1.0]),
    )
    # Create initial state
    state = agent.observe(np.array([10.0]), np.array([0.0]))
    state.anomaly_flag = 0
    state.risk_score = agent.update_risk_score_from_flag(0)
    return agent


def test_severity_score_computation():
    """Test severity score calculation."""
    # High impact, high likelihood -> high severity
    score1 = compute_severity_score(impact_factor=0.8, likelihood=0.9)
    assert 0.7 < score1 < 1.0, f"Expected high severity, got {score1}"
    
    # Low impact, low likelihood -> low severity
    score2 = compute_severity_score(impact_factor=0.2, likelihood=0.1)
    assert 0.0 <= score2 < 0.3, f"Expected low severity, got {score2}"
    
    # Default weights: 0.6*impact + 0.4*likelihood
    score3 = compute_severity_score(impact_factor=0.5, likelihood=0.5)
    expected = 0.6 * 0.5 + 0.4 * 0.5
    assert abs(score3 - expected) < 0.01, f"Expected {expected}, got {score3}"
    
    print(f"✓ Severity computation: high={score1:.2f}, low={score2:.2f}, mid={score3:.2f}")


def test_severity_levels():
    """Test severity level classification."""
    assert severity_level(0.1) == SeverityLevel.LOW
    assert severity_level(0.3) == SeverityLevel.MEDIUM
    assert severity_level(0.6) == SeverityLevel.HIGH
    assert severity_level(0.9) == SeverityLevel.CRITICAL
    
    print("✓ Severity levels: LOW/MEDIUM/HIGH/CRITICAL classification correct")


def test_impact_factors():
    """Test impact factor mapping by agent type."""
    # Generators have high impact
    impact_gen = impact_factor(AgentType.GENERATOR)
    assert 0.7 < impact_gen <= 1.0, f"Generator impact should be high, got {impact_gen}"
    
    # PMUs have lower impact (monitoring role)
    impact_pmu = impact_factor(AgentType.PMU)
    assert 0.0 <= impact_pmu < 0.5, f"PMU impact should be lower, got {impact_pmu}"
    
    # Generator > Substation > Breaker > PMU
    impact_sub = impact_factor(AgentType.SUBSTATION)
    impact_brk = impact_factor(AgentType.BREAKER)
    assert impact_gen > impact_sub > impact_brk > impact_pmu
    
    print(f"✓ Impact factors: GEN={impact_gen:.1f}, SUB={impact_sub:.1f}, BRK={impact_brk:.1f}, PMU={impact_pmu:.1f}")


def test_likelihood_from_history():
    """Test likelihood calculation from anomaly history."""
    # All anomalies
    likelihood1 = likelihood_from_history(np.array([1, 1, 1, 1, 1]))
    assert likelihood1 == 1.0
    
    # No anomalies
    likelihood2 = likelihood_from_history(np.array([0, 0, 0, 0, 0]))
    assert likelihood2 == 0.0
    
    # 50% anomalies
    likelihood3 = likelihood_from_history(np.array([1, 0, 1, 0, 1, 0]))
    assert abs(likelihood3 - 0.5) < 0.01
    
    print(f"✓ Likelihood: all={likelihood1:.1f}, none={likelihood2:.1f}, half={likelihood3:.1f}")


def test_mitigation_actions():
    """Test mitigation actions for each severity level."""
    agent = make_test_agent("A0", AgentType.GENERATOR)
    
    # LOW: Log and monitor
    event1 = apply_mitigation(agent, SeverityLevel.LOW)
    assert event1["action"] == "LOG_MONITOR"
    
    # MEDIUM: Increase audit frequency
    initial_freq = agent.audit_frequency
    event2 = apply_mitigation(agent, SeverityLevel.MEDIUM, f_min=1, f_max=5)
    assert event2["action"] == "INCREASE_AUDIT"
    assert agent.audit_frequency == initial_freq + 1
    
    # HIGH: Isolate agent
    event3 = apply_mitigation(agent, SeverityLevel.HIGH)
    assert event3["action"] == "ISOLATE_NOTIFY"
    mitigation = getattr(agent, "mitigation")
    assert mitigation.active is False
    
    # CRITICAL: Emergency shutdown
    agent2 = make_test_agent("A1", AgentType.GENERATOR)
    event4 = apply_mitigation(agent2, SeverityLevel.CRITICAL)
    assert event4["action"] == "EMERGENCY_SHUTDOWN"
    mitigation2 = getattr(agent2, "mitigation")
    assert mitigation2.shutdown is True
    assert mitigation2.active is False
    
    print("✓ Mitigation actions: LOG_MONITOR, INCREASE_AUDIT, ISOLATE_NOTIFY, EMERGENCY_SHUTDOWN")


def test_response_pipeline():
    """Test full response controller pipeline."""
    agent = make_test_agent("G1", AgentType.GENERATOR)
    agent.last_state.anomaly_flag = 1
    
    # High anomaly history -> should trigger response
    history = [1, 1, 1, 1, 0, 1, 1, 0, 1, 1]  # 80% anomalous
    
    event = response_step(agent, history, T=10)
    
    # Verify event structure
    assert "severity_score" in event
    assert "severity_level" in event
    assert "action" in event
    assert "impact_factor" in event
    assert "likelihood" in event
    
    # Generator + high anomaly rate -> should be HIGH or CRITICAL
    assert event["severity_score"] > 0.5
    assert event["severity_level"] in ["HIGH", "CRITICAL"]
    
    # Verify risk was updated
    assert agent.risk_score > 0.0
    
    print(f"✓ Response pipeline: severity={event['severity_score']:.2f}, level={event['severity_level']}, action={event['action']}")


def test_severity_risk_feedback():
    """Test that severity scales risk score (feedback loop)."""
    agent = make_test_agent("G2", AgentType.GENERATOR)
    agent.last_state.anomaly_flag = 1
    
    # High severity history
    high_severity_history = [1] * 20
    
    # Test with feedback enabled
    event1 = response_step(agent, high_severity_history, T=20, severity_risk_scale=True)
    risk_with_scaling = agent.risk_score
    
    # Test with feedback disabled
    agent2 = make_test_agent("G3", AgentType.GENERATOR)
    agent2.last_state.anomaly_flag = 1
    event2 = response_step(agent2, high_severity_history, T=20, severity_risk_scale=False)
    risk_without_scaling = agent2.risk_score
    
    # With scaling should have higher risk
    assert risk_with_scaling > risk_without_scaling
    
    print(f"✓ Risk feedback: with_scaling={risk_with_scaling:.2f}, without={risk_without_scaling:.2f}")


def test_response_with_low_severity():
    """Test response for low-severity events (should only log)."""
    agent = make_test_agent("P1", AgentType.PMU)  # PMU has low impact
    agent.last_state.anomaly_flag = 0
    
    # Low anomaly history
    low_history = [0, 0, 1, 0, 0, 0, 0, 0, 0, 0]  # 10% anomalous
    
    event = response_step(agent, low_history, T=10)
    
    # Should be LOW severity
    assert event["severity_level"] == "LOW"
    assert event["action"] == "LOG_MONITOR"
    
    # Agent should remain active
    if hasattr(agent, "mitigation"):
        assert getattr(agent, "mitigation").active is True
    
    print(f"✓ Low severity: level={event['severity_level']}, action={event['action']}")


if __name__ == "__main__":
    print("\n" + "="*70)
    print("RESPONSE MECHANISM TESTS")
    print("="*70 + "\n")
    
    test_severity_score_computation()
    test_severity_levels()
    test_impact_factors()
    test_likelihood_from_history()
    test_mitigation_actions()
    test_response_pipeline()
    test_severity_risk_feedback()
    test_response_with_low_severity()
    
    print("\n" + "="*70)
    print("✅ ALL RESPONSE TESTS PASSED")
    print("="*70 + "\n")
