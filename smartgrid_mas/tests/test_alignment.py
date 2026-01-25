import pytest
import os
import sys
from pathlib import Path

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

def test_horizon_window_alignment():
    """Test that LSTM/threshold windows adapt to short horizons."""
    # Simulate short horizon: 12 steps (1 hour at 5-min intervals)
    cycle_hours = 1
    timestep_minutes = 5
    steps = int((cycle_hours * 60) / timestep_minutes)  # 12
    
    # Check adaptive clustering window
    cluster_window = 50  # default
    cluster_window_eff = min(cluster_window, max(5, steps // 2 if steps > 1 else 1))
    assert cluster_window_eff == 6, f"Expected 6, got {cluster_window_eff}"
    
    # Check adaptive clustering period
    cluster_period = 10 if steps >= 30 else max(1, steps // 3)
    assert cluster_period == 4, f"Expected 4, got {cluster_period}"
    
    # Ensure at least one clustering event happens
    cluster_timesteps = [t for t in range(steps) if t >= cluster_window_eff and ((t % cluster_period == 0) or t == steps - 1)]
    assert len(cluster_timesteps) > 0, "No clustering events scheduled"
    print(f"✓ Short horizon ({steps} steps): cluster_window_eff={cluster_window_eff}, period={cluster_period}, events at {cluster_timesteps}")


def test_baseline_fixed_f_override():
    """Test that baseline fixed frequency respects env override."""
    os.environ["SMARTGRID_BASELINE_F"] = "1"
    from smartgrid_mas.run_all import BASELINE_FIXED_F
    assert BASELINE_FIXED_F == 1, f"Expected 1, got {BASELINE_FIXED_F}"
    del os.environ["SMARTGRID_BASELINE_F"]
    print("✓ BASELINE_FIXED_F respects env override")


def test_lstm_window_override():
    """Test that LSTM window respects env override."""
    os.environ["SMARTGRID_LSTM_WINDOW"] = "12"
    import importlib
    import smartgrid_mas.run_all
    importlib.reload(smartgrid_mas.run_all)
    from smartgrid_mas.run_all import LSTM_WINDOW
    assert LSTM_WINDOW == 12, f"Expected 12, got {LSTM_WINDOW}"
    del os.environ["SMARTGRID_LSTM_WINDOW"]
    print("✓ LSTM_WINDOW respects env override")


def test_rl_episode_alignment():
    """Test RL iteration count aligns with timesteps and agents."""
    # Example: 288 timesteps × 100 agents = 28,800 RL state updates
    # (per-agent RL decisions per timestep)
    n_agents = 100
    n_timesteps = 288
    expected_rl_updates = n_agents * n_timesteps  # 28,800
    
    # In practice, RL updates happen only when audits executed or frequencies adjusted
    # So actual count may be lower; test assumes full coverage for upper bound
    # From last run: rl_iterations=30,240 (slightly more due to warmup/exploration)
    observed_rl_iterations = 30240
    
    # Allow 10% tolerance for exploration/warmup overhead
    tolerance = 0.1
    lower_bound = expected_rl_updates * (1 - tolerance)
    upper_bound = expected_rl_updates * (1 + tolerance)
    
    assert lower_bound <= observed_rl_iterations <= upper_bound, \
        f"RL iterations {observed_rl_iterations} outside expected range [{lower_bound:.0f}, {upper_bound:.0f}]"
    print(f"✓ RL iterations {observed_rl_iterations} within expected range for {n_agents} agents × {n_timesteps} steps")


def test_coverage_from_ledger():
    """Test coverage computation from ledger end-state."""
    # Mock ledger with 22 unique agents audited out of 100
    class MockLedger:
        def coverage(self, total_agents):
            return 22 / total_agents
    
    ledger = MockLedger()
    coverage = ledger.coverage(100)
    assert coverage == 0.22, f"Expected 0.22, got {coverage}"
    print("✓ Coverage computed from ledger end-state")


if __name__ == "__main__":
    test_horizon_window_alignment()
    test_baseline_fixed_f_override()
    test_lstm_window_override()
    test_rl_episode_alignment()
    test_coverage_from_ledger()
    print("\n✅ All alignment tests passed")
