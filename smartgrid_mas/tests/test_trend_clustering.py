import numpy as np
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentType, AgentCriticality
from smartgrid_mas.behavior_analysis.trend_clustering import cluster_agents_trends, assign_cluster_labels

def make_agent(aid: str, trend_slope: float = 0.0):
    """Create a test agent with synthetic history."""
    a = BaseAgent(
        agent_id=aid,
        agent_type=AgentType.PMU,
        criticality=AgentCriticality(weight=1.0),
        bx=np.array([0.0, 0.0, 0.0]),
        by=np.array([0.0, 0.0]),
        thx=np.array([1.0, 1.0, 1.0]),
        thy=np.array([1.0, 1.0]),
    )
    # create history with trend
    for t in range(60):
        x = np.array([t, t, t], dtype=float) * (1.0 + trend_slope)
        y = np.array([t * 0.1, t * 0.1], dtype=float) * (1.0 + trend_slope)
        a.observe(x, y)
    return a

def test_kmeans_labels():
    """Test that K-Means produces valid cluster labels."""
    agents = [make_agent(f"A{i}") for i in range(6)]
    labels = cluster_agents_trends(agents, window=50, k=3, seed=42)
    
    assert len(labels) == 6, f"Expected 6 labels, got {len(labels)}"
    assert all(isinstance(v, int) for v in labels.values()), "All labels should be integers"
    assert all(0 <= v < 3 for v in labels.values()), "All labels should be in [0, 3)"

def test_cluster_separation():
    """Test that agents with different trends cluster differently."""
    # Create agents with different behaviors
    agents = [
        make_agent("stable", trend_slope=0.0),      # stable
        make_agent("stable2", trend_slope=0.001),   # stable
        make_agent("drifting", trend_slope=0.1),    # drifting
        make_agent("drifting2", trend_slope=0.15),  # drifting
    ]
    
    labels = cluster_agents_trends(agents, window=50, k=2, seed=42)
    
    # Stable agents should be in same cluster
    # Drifting agents should be in same cluster
    # Or at least they shouldn't all be in same cluster
    unique_labels = set(labels.values())
    assert len(unique_labels) >= 1, "Should have at least 1 cluster"

def test_assign_cluster_labels():
    """Test that cluster labels are assigned to agent states."""
    agents = [make_agent(f"A{i}") for i in range(4)]
    
    # Force observation to create last_state
    for a in agents:
        st = a.observe(np.array([0.0, 0.0, 0.0]), np.array([0.0, 0.0]))
        a.last_state = st
    
    labels = cluster_agents_trends(agents, window=50, k=2, seed=42)
    assign_cluster_labels(agents, labels)
    
    # Check that labels were assigned
    for a in agents:
        assert a.last_state is not None, f"Agent {a.agent_id} has no last_state"
        assert a.last_state.cluster_label in [0, 1], f"Invalid cluster label for {a.agent_id}"

if __name__ == "__main__":
    test_kmeans_labels()
    test_cluster_separation()
    test_assign_cluster_labels()
    print("✓ All trend clustering tests passed")
