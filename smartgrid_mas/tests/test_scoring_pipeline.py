from __future__ import annotations

import numpy as np

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentCriticality, AgentType
from smartgrid_mas.behavior_analysis.scoring_pipeline import compute_score_and_flag


def _make_agent(agent_id: str, agent_type: AgentType) -> BaseAgent:
    return BaseAgent(
        agent_id=agent_id,
        agent_type=agent_type,
        criticality=AgentCriticality(weight=1.0),
        bx=np.array([230.0, 50.0, 15.0, 3.0, 3.0], dtype=float),
        by=np.array([3.0, 0.001, 1.0, 50.0], dtype=float),
        thx=np.array([12.0, 0.5, 8.0, 2.5, 4.0], dtype=float),
        thy=np.array([1.5, 0.01, 0.1, 8.0], dtype=float),
    )


def _make_sim_agent(agent_id: str, agent_type: AgentType) -> BaseAgent:
    return BaseAgent(
        agent_id=agent_id,
        agent_type=agent_type,
        criticality=AgentCriticality(weight=1.0),
        bx=np.array([1.0, 1.0, 1.0], dtype=float),
        by=np.array([10.0, 0.01, 0.99, 100.0], dtype=float),
        thx=np.array([0.1, 0.1, 0.1], dtype=float),
        thy=np.array([0.5, 0.02, 0.05, 10.0], dtype=float),
    )


def test_low_signal_with_high_probability_does_not_flag(monkeypatch):
    monkeypatch.delenv("SMARTGRID_SCORE_THRESHOLD", raising=False)
    monkeypatch.delenv("SMARTGRID_ANOMALY_PROB_THRESHOLD", raising=False)

    agent = _make_agent("GEN-01", AgentType.GENERATOR)
    st = agent.observe(
        np.array([231.0, 50.2, 15.5, 3.4, 3.2], dtype=float),
        np.array([3.4, 0.004, 0.98, 48.8], dtype=float),
    )
    st.anomaly_prob = 0.99

    compute_score_and_flag(agent, st)

    assert st.anomaly_flag == 0
    assert st.attack_type == "NONE"


def test_attack_typing_requires_binary_anomaly_even_with_network_signal():
    agent = _make_agent("PMU-09", AgentType.PMU)
    st = agent.observe(
        np.array([231.0, 50.1, 15.4, 3.2, 3.1], dtype=float),
        np.array([3.3, 0.003, 0.99, 49.2], dtype=float),
    )
    st.anomaly_prob = 0.99
    st.network_intrusion_prob = 0.98

    compute_score_and_flag(agent, st)

    assert st.anomaly_flag == 0
    assert st.attack_type == "NONE"


def test_cyber_heavy_signal_classifies_as_dos():
    agent = _make_agent("SUB-21", AgentType.SUBSTATION)
    st = agent.observe(
        np.array([230.5, 50.0, 15.2, 3.1, 3.4], dtype=float),
        np.array([10.0, 0.085, 0.98, 18.0], dtype=float),
    )
    st.anomaly_prob = 0.995

    compute_score_and_flag(agent, st)

    assert st.anomaly_flag == 1
    assert st.attack_type == "DOS"
    assert st.attack_type_confidence > 0.0


def test_strong_network_signature_can_rescue_binary_flag_to_dos():
    agent = _make_agent("SUB-88", AgentType.SUBSTATION)
    st = agent.observe(
        np.array([231.2, 49.9, 15.3, 3.2, 3.6], dtype=float),
        np.array([7.5, 0.07, 0.98, 22.0], dtype=float),
    )
    st.anomaly_prob = 0.58
    st.network_intrusion_prob = 0.93

    compute_score_and_flag(agent, st)

    assert st.anomaly_flag == 1
    assert st.attack_type == "DOS"


def test_integrity_dominant_signal_classifies_as_mitm():
    agent = _make_agent("PMU-51", AgentType.PMU)
    st = agent.observe(
        np.array([230.2, 50.0, 15.1, 3.0, 3.0], dtype=float),
        np.array([6.0, 0.03, 0.2, 35.0], dtype=float),
    )
    st.anomaly_prob = 0.995

    compute_score_and_flag(agent, st)

    assert st.anomaly_flag == 1
    assert st.attack_type == "MITM"
    assert st.attack_type_confidence > 0.0


def test_network_branch_can_override_to_mitm_when_confident():
    agent = _make_agent("PMU-77", AgentType.PMU)
    st = agent.observe(
        np.array([230.1, 50.0, 15.0, 3.0, 3.0], dtype=float),
        np.array([4.0, 0.02, 0.4, 40.0], dtype=float),
    )
    st.anomaly_prob = 0.98
    st.network_intrusion_prob = 0.96

    compute_score_and_flag(agent, st)

    assert st.network_attack_label in {"MITM", "DOS", "NETWORK"}
    assert st.network_attack_confidence >= 0.0
    assert st.attack_type == "MITM"


def test_breaker_physical_signal_classifies_as_fault():
    agent = _make_agent("BRK-76", AgentType.BREAKER)
    st = agent.observe(
        np.array([260.0, 47.5, 46.0, 18.0, 14.0], dtype=float),
        np.array([3.1, 0.001, 0.99, 49.0], dtype=float),
    )
    st.anomaly_prob = 0.99

    compute_score_and_flag(agent, st)

    assert st.anomaly_flag == 1
    assert st.attack_type == "FAULT"


def test_physical_fault_signature_can_rescue_binary_flag():
    agent = _make_agent("BRK-84", AgentType.BREAKER)
    st = agent.observe(
        np.array([246.0, 49.4, 28.0, 8.0, 7.4], dtype=float),
        np.array([3.2, 0.002, 0.99, 49.0], dtype=float),
    )
    st.anomaly_prob = 0.57

    compute_score_and_flag(agent, st)

    assert st.anomaly_flag == 1
    assert st.attack_type == "FAULT"


def test_physical_fault_stays_fault_even_with_network_branch_signal():
    agent = _make_agent("BRK-91", AgentType.BREAKER)
    st = agent.observe(
        np.array([260.0, 47.5, 46.0, 18.0, 14.0], dtype=float),
        np.array([9.0, 0.08, 0.2, 22.0], dtype=float),
    )
    st.anomaly_prob = 0.99
    st.network_intrusion_prob = 0.99

    compute_score_and_flag(agent, st)

    assert st.attack_type == "FAULT"


def test_generator_physical_signal_classifies_as_fdi():
    agent = _make_agent("GEN-02", AgentType.GENERATOR)
    st = agent.observe(
        np.array([268.0, 48.0, 47.0, 18.0, 3.2], dtype=float),
        np.array([3.2, 0.001, 0.99, 49.5], dtype=float),
    )
    st.anomaly_prob = 0.99

    compute_score_and_flag(agent, st)

    assert st.anomaly_flag == 1
    assert st.attack_type == "FDI"


def test_physical_fdi_signature_can_rescue_binary_flag():
    agent = _make_agent("GEN-07", AgentType.GENERATOR)
    st = agent.observe(
        np.array([248.0, 49.0, 24.0, 7.0, 2.4], dtype=float),
        np.array([3.2, 0.002, 0.99, 49.0], dtype=float),
    )
    st.anomaly_prob = 0.56

    compute_score_and_flag(agent, st)

    assert st.anomaly_flag == 1
    assert st.attack_type == "FDI"


def test_simulation_style_fault_signature_with_three_phys_dims_is_detected():
    agent = _make_sim_agent("BRK-SIM", AgentType.BREAKER)
    st = agent.observe(
        np.array([0.74, 1.55, 1.10], dtype=float),
        np.array([10.4, 0.012, 0.99, 98.0], dtype=float),
    )
    st.anomaly_prob = 0.58

    compute_score_and_flag(agent, st)

    assert st.anomaly_flag == 1
    assert st.attack_type == "FAULT"


def test_simulation_style_fdi_signature_with_three_phys_dims_is_detected():
    agent = _make_sim_agent("GEN-SIM", AgentType.GENERATOR)
    st = agent.observe(
        np.array([2.45, 1.72, 0.32], dtype=float),
        np.array([10.2, 0.012, 0.995, 99.0], dtype=float),
    )
    st.anomaly_prob = 0.59

    compute_score_and_flag(agent, st)

    assert st.anomaly_flag == 1
    assert st.attack_type == "FDI"
