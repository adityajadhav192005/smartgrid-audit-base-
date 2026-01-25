"""Behavior analysis module for Smart Grid MAS"""
from .deviation_score import deviation_score, anomaly_flag_from_score, layer_rms_norm_dev
from .scoring_pipeline import compute_score_and_flag
from .baseline_update import update_baseline_vector, update_agent_baselines
from .threshold_update import update_threshold_vector, update_agent_thresholds
from .behavior_pipeline import behavior_update
from .trend_features import build_trend_feature, deviation_series, trend_slope
from .trend_clustering import cluster_agents_trends, assign_cluster_labels

__all__ = [
    "deviation_score",
    "anomaly_flag_from_score",
    "layer_rms_norm_dev",
    "compute_score_and_flag",
    "update_baseline_vector",
    "update_agent_baselines",
    "update_threshold_vector",
    "update_agent_thresholds",
    "behavior_update",
    "build_trend_feature",
    "deviation_series",
    "trend_slope",
    "cluster_agents_trends",
    "assign_cluster_labels",
]
