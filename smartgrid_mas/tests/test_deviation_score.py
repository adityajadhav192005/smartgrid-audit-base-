import numpy as np
from smartgrid_mas.behavior_analysis.deviation_score import deviation_score, anomaly_flag_from_score

def test_score_zero_when_equal():
    """When observation equals baseline, score should be 0."""
    x = np.array([1.0, 2.0, 3.0])
    bx = np.array([1.0, 2.0, 3.0])
    thx = np.array([1.0, 1.0, 1.0])

    y = np.array([0.5, 0.25])
    by = np.array([0.5, 0.25])
    thy = np.array([1.0, 1.0])

    s = deviation_score(x, bx, thx, y, by, thy, w_i=2.0)
    assert s == 0.0, f"Expected 0.0, got {s}"
    assert anomaly_flag_from_score(s) == 0, "Should not flag as anomaly when score=0"

def test_score_positive_and_flags():
    """Large deviation should produce high score and anomaly flag."""
    x = np.array([2.0, 2.0, 2.0])
    bx = np.array([1.0, 1.0, 1.0])
    thx = np.array([0.5, 0.5, 0.5])

    y = np.array([2.0, 2.0])
    by = np.array([1.0, 1.0])
    thy = np.array([0.5, 0.5])

    s = deviation_score(x, bx, thx, y, by, thy, w_i=1.0)
    assert s > 1.0, f"Expected score > 1.0, got {s}"
    assert anomaly_flag_from_score(s) == 1, "Should flag as anomaly when score > 1"

def test_criticality_weight():
    """Score should scale linearly with criticality weight."""
    x = np.array([2.0, 2.0, 2.0])
    bx = np.array([1.0, 1.0, 1.0])
    thx = np.array([0.5, 0.5, 0.5])
    y = np.array([1.0])
    by = np.array([1.0])
    thy = np.array([1.0])

    s1 = deviation_score(x, bx, thx, y, by, thy, w_i=1.0)
    s2 = deviation_score(x, bx, thx, y, by, thy, w_i=2.0)
    
    assert abs(s2 - 2*s1) < 1e-10, "Score should scale linearly with w_i"

def test_anomaly_threshold():
    """Test boundary around threshold=1.0."""
    # Just below threshold
    a_low = anomaly_flag_from_score(0.99)
    assert a_low == 0, "Score 0.99 should not be anomalous"
    
    # Just above threshold
    a_high = anomaly_flag_from_score(1.01)
    assert a_high == 1, "Score 1.01 should be anomalous"
    
    # Exactly at threshold (not anomalous per paper)
    a_exact = anomaly_flag_from_score(1.0)
    assert a_exact == 0, "Score exactly 1.0 should not be anomalous (> check)"

if __name__ == "__main__":
    test_score_zero_when_equal()
    test_score_positive_and_flags()
    test_criticality_weight()
    test_anomaly_threshold()
    print("✓ All deviation score tests passed")
