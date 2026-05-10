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
    grid_anomaly_prob: float = 0.0
    network_intrusion_prob: float = 0.0
    fusion_agreement: float = 0.0
    network_attack_label: str = "NONE"
    network_attack_confidence: float = 0.0
    network_dos_score: float = 0.0
    network_mitm_score: float = 0.0
    network_generic_score: float = 0.0
    deviation_score: float = 0.0
    anomaly_flag: int = 0
    risk_score: float = 0.0
    audit_frequency: int = 1
    cluster_label: int = -1
    baseline_delta: float = 0.0  # Physical deviation from baseline (voltage/frequency)
    hybrid_confidence: float = 0.0
    adaptive_score_threshold: float = 0.0
    adaptive_prob_threshold: float = 0.0
    persistence_recent: int = 0
    persistence_window: int = 0
    suspicion_credit: float = 0.0
    model_confirmed: int = 0
    persistent_model_confirmed: int = 0
    prob_support: float = 0.0
    attack_type: str = "NONE"
    attack_type_confidence: float = 0.0
    multilayer_label: str = "NONE"
    multilayer_confidence: float = 0.0
    multilayer_reason: str = ""
