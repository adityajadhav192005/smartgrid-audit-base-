from smartgrid_mas.anomaly_detection.dual_branch import fuse_branch_probabilities


def test_fusion_rewards_agreement():
    fused = fuse_branch_probabilities(0.9, 0.9)
    assert fused.fused_prob >= 0.9
    assert fused.agreement == 1.0


def test_fusion_damps_disagreement():
    high_low = fuse_branch_probabilities(0.95, 0.10)
    mid_mid = fuse_branch_probabilities(0.55, 0.55)
    assert high_low.fused_prob < 0.75
    assert mid_mid.fused_prob > 0.50
