from __future__ import annotations
import numpy as np

def _validate_threshold(th: np.ndarray, name: str) -> None:
    th = np.asarray(th, dtype=float)
    if th.ndim != 1:
        raise ValueError(f"{name} must be a 1D vector, got shape {th.shape}")
    if np.any(th <= 0):
        raise ValueError(f"{name} must be strictly > 0 elementwise to avoid division issues.")

def layer_rms_norm_dev(obs: np.ndarray, base: np.ndarray, th: np.ndarray) -> float:
    """
    Compute RMS normalized deviation for a single layer (physical or cyber).
    
    Formula: sqrt(mean(((obs - base) / th)^2))
    """
    obs = np.asarray(obs, dtype=float).reshape(-1)
    base = np.asarray(base, dtype=float).reshape(-1)
    th = np.asarray(th, dtype=float).reshape(-1)

    if obs.shape != base.shape or obs.shape != th.shape:
        raise ValueError(f"Shape mismatch: obs{obs.shape}, base{base.shape}, th{th.shape}")

    _validate_threshold(th, "threshold")

    z = (obs - base) / th
    return float(np.sqrt(np.mean(z ** 2)))

def deviation_score(
    x_phys: np.ndarray,
    bx: np.ndarray,
    thx: np.ndarray,
    y_cyber: np.ndarray,
    by: np.ndarray,
    thy: np.ndarray,
    w_i: float,
) -> float:
    """
    Paper-faithful deviation scoring:
    
    dx = RMS normalized deviation of physical metrics
    dy = RMS normalized deviation of cyber metrics
    S_i(t) = w_i * (dx + dy)
    
    Args:
        x_phys: observed physical metrics vector
        bx: baseline for physical metrics
        thx: threshold vector for physical metrics
        y_cyber: observed cyber metrics vector
        by: baseline for cyber metrics
        thy: threshold vector for cyber metrics
        w_i: criticality weight (>= 0)
    
    Returns:
        S_i(t): deviation score
    """
    if w_i < 0:
        raise ValueError("w_i must be >= 0")

    dx = layer_rms_norm_dev(x_phys, bx, thx)
    dy = layer_rms_norm_dev(y_cyber, by, thy)
    return float(w_i * (dx + dy))

def anomaly_flag_from_score(score: float, threshold: float = 1.0) -> int:
    """
    Paper rule: anomalous if S_i(t) > threshold
    
    Args:
        score: deviation score S_i(t)
        threshold: decision boundary (default 1.0 from paper)
    
    Returns:
        a_i(t): 1 if anomalous, 0 otherwise
    """
    return 1 if float(score) > float(threshold) else 0
