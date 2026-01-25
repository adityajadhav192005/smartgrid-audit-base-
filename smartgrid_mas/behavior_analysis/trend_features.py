from __future__ import annotations
import numpy as np
from smartgrid_mas.agents.base_agent import BaseAgent

def _safe_mean_abs(v: np.ndarray) -> float:
    """Safely compute mean of absolute values."""
    v = np.asarray(v, dtype=float).reshape(-1)
    return float(np.mean(np.abs(v))) if v.size else 0.0

def deviation_series(agent: BaseAgent, window: int) -> np.ndarray:
    """
    Returns a per-timestep scalar deviation magnitude series over window.
    
    Formula: dev(t) = mean(|X(t)-Bx|) + mean(|Y(t)-By|)
    
    Uses current baselines as reference (paper-style for trends).
    
    Args:
        agent: BaseAgent with observation history
        window: number of timesteps to analyze
    
    Returns:
        Array of shape (window,) with scalar deviations per timestep
    """
    X = list(agent.x_history)[-window:]
    Y = list(agent.y_history)[-window:]
    if len(X) == 0 or len(Y) == 0:
        return np.zeros((0,), dtype=float)

    # pad to window if short
    while len(X) < window:
        X.insert(0, X[0])
    while len(Y) < window:
        Y.insert(0, Y[0])

    bx = np.asarray(agent.bx, dtype=float).reshape(-1)
    by = np.asarray(agent.by, dtype=float).reshape(-1)

    devs = []
    for xt, yt in zip(X, Y):
        xt = np.asarray(xt, dtype=float).reshape(-1)
        yt = np.asarray(yt, dtype=float).reshape(-1)
        dx = float(np.mean(np.abs(xt - bx)))
        dy = float(np.mean(np.abs(yt - by)))
        devs.append(dx + dy)
    return np.asarray(devs, dtype=float)

def trend_slope(y: np.ndarray) -> float:
    """
    Linear regression slope for y over t=0..n-1.
    
    Closed-form solution: slope = Σ((t - t_mean)*(y - y_mean)) / Σ((t - t_mean)²)
    
    Args:
        y: 1D array of values
    
    Returns:
        Scalar slope (trend direction)
    """
    y = np.asarray(y, dtype=float).reshape(-1)
    n = y.size
    if n < 2:
        return 0.0
    t = np.arange(n, dtype=float)
    t_mean = np.mean(t)
    y_mean = np.mean(y)
    num = np.sum((t - t_mean) * (y - y_mean))
    den = np.sum((t - t_mean) ** 2)
    return float(num / den) if den > 0 else 0.0

def build_trend_feature(agent: BaseAgent, window: int = 50) -> np.ndarray:
    """
    Build 4D feature vector for trend clustering.
    
    Features:
    1. cumulative_deviation: sum of per-timestep deviations over window
    2. baseline_magnitude: mean(|Bx|) + mean(|By|)
    3. threshold_magnitude: mean(Thx) + mean(Thy)
    4. deviation_slope: linear trend in deviation series
    
    Args:
        agent: BaseAgent
        window: lookback window for trend analysis (default 50 timesteps)
    
    Returns:
        Array of shape (4,) with features for K-Means
    """
    dev = deviation_series(agent, window=window)
    cum_dev = float(np.sum(dev))

    base_mag = _safe_mean_abs(agent.bx) + _safe_mean_abs(agent.by)
    th_mag = float(np.mean(agent.thx)) + float(np.mean(agent.thy))

    slope = trend_slope(dev)

    return np.array([cum_dev, base_mag, th_mag, slope], dtype=float)
