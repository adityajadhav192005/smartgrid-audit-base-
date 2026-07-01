import numpy as np
from smartgrid_mas.behavior_analysis.baseline_update import update_baseline_vector
from smartgrid_mas.behavior_analysis.threshold_update import update_threshold_vector

def test_baseline_alpha_switching():
    """Test that alpha_low (0.1) adapts conservatively, showing EMA behavior."""
    b = np.array([0.0, 0.0])
    obs = np.array([10.0, 10.0])

    # With alpha_low=0.1, should get partial update: (1-0.1)*0 + 0.1*10 = 1.0
    b_new = update_baseline_vector(b, obs, anomaly_flag=0, alpha_low=0.1, alpha_high=0.9)

    # Verify conservative update (not full jump to observation)
    expected = np.array([1.0, 1.0])  # (1-0.1)*0 + 0.1*10
    assert np.allclose(b_new, expected), f"Expected {expected}, got {b_new}"

def test_baseline_zero_change_no_anomaly():
    """When no anomaly and already close, low alpha prevents drift."""
    b = np.array([1.0, 2.0])
    obs = np.array([1.01, 2.01])

    b_new = update_baseline_vector(b, obs, anomaly_flag=0, alpha_low=0.01, alpha_high=0.9)
    
    # With low alpha, change should be very small
    delta = b_new - b
    assert np.all(np.abs(delta) < 0.02), f"Expected small change, got {delta}"

def test_threshold_increases_with_deviation():
    """Threshold should move toward observed deviation (mean-reverting EMA)."""
    th = np.array([0.1, 0.1])
    obs = np.array([5.0, 1.0])
    base = np.array([1.0, 1.0])

    th_new = update_threshold_vector(th, obs, base, beta=0.5, th_min=1e-3, th_max=100.0)

    # First element has large deviation (4.0), threshold should increase toward it
    assert th_new[0] > th[0], f"Expected th_new[0] > th[0], got {th_new[0]} vs {th[0]}"
    # Second element has zero deviation, threshold should shrink toward th_min
    assert th_new[1] < th[1], f"Expected th_new[1] < th[1], got {th_new[1]} vs {th[1]}"

def test_threshold_respects_bounds():
    """Threshold must be bounded and strictly positive."""
    th = np.array([0.001, 100.0])
    obs = np.array([10.0, 10.0])
    base = np.array([0.0, 0.0])
    
    th_new = update_threshold_vector(th, obs, base, beta=10.0, th_min=0.001, th_max=50.0)
    
    # All values must be >= th_min
    assert np.all(th_new >= 0.001), f"Expected all >= 0.001, got {th_new}"
    # All values must be <= th_max
    assert np.all(th_new <= 50.0), f"Expected all <= 50.0, got {th_new}"

def test_baseline_convergence():
    """Baseline should converge towards observation with repeated updates (anomaly_flag=0)."""
    b = np.array([0.0])
    obs = np.array([10.0])
    
    # Apply multiple updates with alpha_low=0.5 (higher for convergence test)
    for _ in range(5):
        b = update_baseline_vector(b, obs, anomaly_flag=0, alpha_low=0.5, alpha_high=0.9)
    
    # Should converge towards observation: b = 10 * (1 - (1-0.5)^5) ≈ 9.69
    assert b[0] > 9.0, f"Expected b > 9.0 after convergence, got {b[0]}"

if __name__ == "__main__":
    test_baseline_alpha_switching()
    test_baseline_zero_change_no_anomaly()
    test_threshold_increases_with_deviation()
    test_threshold_respects_bounds()
    test_baseline_convergence()
    print("✓ All behavior update tests passed")
