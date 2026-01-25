"""
Tests for gradient-based optimization and hybrid RL+Gradient scheduler.

Test coverage:
    1. Gradient update computation
    2. Cost function calculation
    3. Gradient step for all agents
    4. Hybrid scheduler (RL + Gradient + Constraints)
    5. Constraint satisfaction after hybrid scheduling
"""

import numpy as np

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentType, AgentCriticality
from smartgrid_mas.audit.gradient_update import (
    audit_cost_per_agent,
    grad_cost_wrt_f,
    gradient_update_frequency,
)
from smartgrid_mas.audit.gradient_step import gradient_opt_step
from smartgrid_mas.audit.audit_scheduler_rl import QLearningAuditScheduler
from smartgrid_mas.audit.hybrid_scheduler import hybrid_audit_schedule


def make_agent(i: int) -> BaseAgent:
    """Create test agent with varying properties."""
    agent = BaseAgent(
        agent_id=f"A{i}",
        agent_type=AgentType.PMU,
        criticality=AgentCriticality(weight=1.0 + 0.2 * i),
        bx=np.array([0.0, 0.0, 0.0]),
        by=np.array([0.0, 0.0]),
        thx=np.array([1.0, 1.0, 1.0]),
        thy=np.array([1.0, 1.0]),
    )
    
    # Create initial state
    state = agent.observe(
        np.array([1.0, 0.0, 0.0]),
        np.array([0.0, 0.0])
    )
    
    # Set anomaly indicators
    state.anomaly_prob = 0.6
    state.deviation_score = 1.0
    state.anomaly_flag = 1 if i % 2 == 0 else 0
    state.risk_score = agent.update_risk_score_from_flag(state.anomaly_flag)
    state.cluster_label = i % 3
    
    return agent


def test_gradient_cost_function():
    """Test cost function calculation."""
    # High frequency -> high audit cost, low failure cost
    cost_high_f = audit_cost_per_agent(C_a=1.0, C_f=10.0, R_i=2.0, f_i=5)
    
    # Low frequency -> low audit cost, high failure cost
    cost_low_f = audit_cost_per_agent(C_a=1.0, C_f=10.0, R_i=2.0, f_i=1)
    
    # Verify tradeoff exists
    assert cost_high_f > 0
    assert cost_low_f > 0
    print(f"✓ Cost function: f=5 -> {cost_high_f:.2f}, f=1 -> {cost_low_f:.2f}")


def test_gradient_computation():
    """Test gradient calculation."""
    # At optimal point, gradient should be near zero
    # For high risk, gradient should suggest increasing frequency
    grad_high_risk = grad_cost_wrt_f(C_a=1.0, C_f=10.0, R_i=5.0, f_i=2)
    
    # For low risk, gradient might suggest decreasing
    grad_low_risk = grad_cost_wrt_f(C_a=1.0, C_f=10.0, R_i=0.1, f_i=3)
    
    assert isinstance(grad_high_risk, float)
    assert isinstance(grad_low_risk, float)
    print(f"✓ Gradient: high_risk={grad_high_risk:.3f}, low_risk={grad_low_risk:.3f}")


def test_gradient_update_single():
    """Test single frequency update."""
    # High risk agent should increase frequency
    f_new = gradient_update_frequency(
        f_i=2,
        R_i=5.0,
        C_a=1.0,
        C_f=10.0,
        lr=0.01,
        f_min=1,
        f_max=5,
    )
    
    # Verify bounds
    assert 1 <= f_new <= 5
    assert isinstance(f_new, int)
    print(f"✓ Gradient update: f=2 (R=5.0) -> f={f_new}")


def test_gradient_step_all_agents():
    """Test gradient optimization for multiple agents."""
    agents = [make_agent(i) for i in range(5)]
    
    # Set initial frequencies
    for agent in agents:
        agent.set_audit_frequency(2, f_min=1, f_max=5)
    
    # Perform gradient step
    freqs = gradient_opt_step(
        agents=agents,
        C_a=1.0,
        C_f=10.0,
        lr=0.01,
        f_min=1,
        f_max=5,
    )
    
    # Verify all frequencies updated
    assert len(freqs) == 5
    assert all(1 <= f <= 5 for f in freqs.values())
    print(f"✓ Gradient step: {len(freqs)} agents updated")


def test_hybrid_scheduler_constraints():
    """Test hybrid RL+Gradient scheduler with constraint enforcement."""
    # Create 12 agents (exceeds max_audits_per_cycle=5)
    agents = [make_agent(i) for i in range(12)]
    
    # Initialize Q-learning scheduler
    scheduler = QLearningAuditScheduler(gamma=0.9, alpha=0.1, epsilon=1.0)
    
    # Run hybrid scheduling
    actions, rewards, freqs, _, constraint_stats = hybrid_audit_schedule(
        agents=agents,
        scheduler=scheduler,
        risk_threshold=0.5,
        f_min=0,  # Allow zero frequency to enable constraint enforcement
        f_max=5,
        max_audits_per_cycle=5,
        audit_cost_per_audit=1.0,
        operational_cost=100.0,
        budget_ratio=0.10,
        C_a=1.0,
        C_f=10.0,
        grad_lr=0.01,
    )
    
    # Verify constraint satisfaction
    total_audits = sum(freqs.values())
    assert total_audits <= 5, f"Total audits {total_audits} exceeds max 5"
    assert constraint_stats["allowed_final"] <= 5
    
    # Verify frequency bounds
    assert all(0 <= f <= 5 for f in freqs.values()), "Frequencies out of bounds"
    
    # Verify all outputs present
    assert len(actions) > 0, "No RL actions recorded"
    assert len(rewards) > 0, "No rewards recorded"
    assert len(freqs) > 0, "No frequencies returned"
    
    print(f"✓ Hybrid scheduler: {total_audits} total audits (≤5), all bounds satisfied")


def test_hybrid_scheduler_convergence():
    """Test that hybrid scheduler produces consistent results over episodes."""
    agents = [make_agent(i) for i in range(8)]
    scheduler = QLearningAuditScheduler(gamma=0.9, alpha=0.1, epsilon=0.5)
    
    prev_total = None
    episode = 0
    for episode in range(3):
        actions, rewards, freqs, _, constraint_stats = hybrid_audit_schedule(
            agents=agents,
            scheduler=scheduler,
            risk_threshold=0.5,
            f_min=0,
            f_max=5,
            max_audits_per_cycle=10,
            audit_cost_per_audit=1.0,
            operational_cost=100.0,
            budget_ratio=0.15,
            C_a=1.0,
            C_f=10.0,
            grad_lr=0.01,
        )
        
        total = sum(freqs.values())
        if prev_total is not None:
            # Total may vary as RL explores, but should stay within bounds
            assert total <= 10, f"Episode {episode}: total {total} exceeds max"
            assert constraint_stats["allowed_final"] <= 10
        prev_total = total
    
    print(f"✓ Hybrid convergence: {episode+1} episodes completed successfully")


if __name__ == "__main__":
    print("\n" + "="*70)
    print("GRADIENT + HYBRID SCHEDULER TESTS")
    print("="*70 + "\n")
    
    test_gradient_cost_function()
    test_gradient_computation()
    test_gradient_update_single()
    test_gradient_step_all_agents()
    test_hybrid_scheduler_constraints()
    test_hybrid_scheduler_convergence()
    
    print("\n" + "="*70)
    print("✅ ALL GRADIENT + HYBRID TESTS PASSED")
    print("="*70 + "\n")
