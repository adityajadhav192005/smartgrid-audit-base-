from __future__ import annotations
from dataclasses import dataclass
import numpy as np

@dataclass
class AgentState:
    """
    Minimum state needed for the paper's pipeline:
    - X(t): physical metrics vector
    - Y(t): cyber metrics vector
    - anomaly_prob: from LSTM (or other detector)
    - deviation_score: S_i(t) from deviation scoring
    - anomaly_flag: a_i(t) in {0,1}
    - risk_score: R_i(t)
    - audit_frequency: f_i(t)
    - cluster_label: from trend clustering (K-means)
    """
    x_phys: np.ndarray
    y_cyber: np.ndarray
    anomaly_prob: float = 0.0
    deviation_score: float = 0.0
    anomaly_flag: int = 0
    risk_score: float = 0.0
    audit_frequency: int = 1
    cluster_label: int = -1
    baseline_delta: float = 0.0  # Physical deviation from baseline (voltage/frequency)
