"""
Severity scoring for anomalies in smart grid MAS.

Implements paper severity formula:
    Se_i = w_impact * ImpactFactor_i + w_likelihood * Likelihood_i

Severity levels:
    LOW: 0.0 <= Se < 0.25
    MEDIUM: 0.25 <= Se < 0.5
    HIGH: 0.5 <= Se < 0.75
    CRITICAL: 0.75 <= Se <= 1.0
"""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
import numpy as np


class SeverityLevel(str, Enum):
    """Severity classification levels for anomalies."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class SeverityThresholds:
    """Thresholds for severity level classification."""
    low: float = 0.25      # Below this: LOW
    medium: float = 0.5    # Below this: MEDIUM
    high: float = 0.75     # Below this: HIGH, above: CRITICAL


@dataclass
class SeverityWeights:
    """Weights for severity score components (paper defaults)."""
    w_impact: float = 0.6      # Impact factor weight
    w_likelihood: float = 0.4  # Likelihood weight


def likelihood_from_history(anomaly_flags: np.ndarray) -> float:
    """
    Compute likelihood from recent anomaly history.
    
    Likelihood = mean(anomaly_flags over last T timesteps)
    
    Args:
        anomaly_flags: Array of binary flags (0/1) from recent history
    
    Returns:
        Likelihood in [0, 1]
    
    Example:
        >>> flags = np.array([1, 1, 0, 1, 0])  # 60% anomalous
        >>> likelihood_from_history(flags)
        0.6
    """
    flags = np.asarray(anomaly_flags, dtype=float).reshape(-1)
    if flags.size == 0:
        return 0.0
    return float(np.mean(flags))


def compute_severity_score(
    impact_factor: float,
    likelihood: float,
    weights: SeverityWeights = SeverityWeights(),
) -> float:
    """
    Compute severity score using paper formula.
    
    Formula:
        Se = w_impact * ImpactFactor + w_likelihood * Likelihood
    
    Args:
        impact_factor: Normalized impact value [0, 1]
        likelihood: Estimated likelihood [0, 1]
        weights: Component weights (default from paper)
    
    Returns:
        Severity score in [0, 1]
    
    Example:
        >>> compute_severity_score(impact_factor=0.8, likelihood=0.6)
        0.72  # 0.6*0.8 + 0.4*0.6
    """
    # Clamp inputs to [0, 1]
    impact_factor = float(max(0.0, min(1.0, impact_factor)))
    likelihood = float(max(0.0, min(1.0, likelihood)))
    
    # Compute weighted sum
    score = weights.w_impact * impact_factor + weights.w_likelihood * likelihood
    return float(score)


def severity_level(
    score: float,
    th: SeverityThresholds = SeverityThresholds(),
) -> SeverityLevel:
    """
    Classify severity level based on score.
    
    Levels:
        LOW:      score < 0.25
        MEDIUM:   0.25 <= score < 0.5
        HIGH:     0.5 <= score < 0.75
        CRITICAL: 0.75 <= score
    
    Args:
        score: Severity score [0, 1]
        th: Thresholds for classification
    
    Returns:
        SeverityLevel enum
    
    Example:
        >>> severity_level(0.3)
        SeverityLevel.MEDIUM
    """
    s = float(score)
    
    if s < th.low:
        return SeverityLevel.LOW
    elif s < th.medium:
        return SeverityLevel.MEDIUM
    elif s < th.high:
        return SeverityLevel.HIGH
    else:
        return SeverityLevel.CRITICAL
