from __future__ import annotations

from typing import Any, Dict, List, Sequence
import numpy as np


def _to_1d(arr: Sequence[float], name: str) -> np.ndarray:
    a = np.asarray(arr, dtype=float).reshape(-1)
    if a.size == 0:
        raise ValueError(f"{name} cannot be empty")
    return a


def explain_deviation(
    obs: Sequence[float],
    base: Sequence[float],
    th: Sequence[float],
    feature_names: Sequence[str] | None = None,
) -> Dict[str, Any]:
    """
    Explain deviation score contributions feature-wise.

    Contribution uses normalized squared deviation:
      c_j = ((x_j - b_j) / th_j)^2
    and relative contribution ratio c_j / sum(c).
    """
    x = _to_1d(obs, "obs")
    b = _to_1d(base, "base")
    t = _to_1d(th, "th")

    if x.shape != b.shape or x.shape != t.shape:
        raise ValueError(f"Shape mismatch obs{x.shape}, base{b.shape}, th{t.shape}")
    if np.any(t <= 0):
        raise ValueError("th values must be > 0")

    z = (x - b) / t
    sq = z**2
    denom = float(np.sum(sq))
    if denom <= 0:
        ratios = np.zeros_like(sq)
    else:
        ratios = sq / denom

    if feature_names is None:
        feature_names = [f"f{i}" for i in range(x.size)]

    rows: List[Dict[str, Any]] = []
    for i, name in enumerate(feature_names):
        rows.append(
            {
                "feature": str(name),
                "observed": float(x[i]),
                "baseline": float(b[i]),
                "threshold": float(t[i]),
                "z": float(z[i]),
                "squared_contribution": float(sq[i]),
                "relative_contribution": float(ratios[i]),
            }
        )

    rows = sorted(rows, key=lambda r: r["relative_contribution"], reverse=True)

    return {
        "rms_normalized_deviation": float(np.sqrt(np.mean(sq))),
        "top_features": rows[:5],
        "all_features": rows,
    }


def explain_audit_decision(
    risk_score: float,
    risk_threshold: float,
    action: str,
    budget_remaining: float | None = None,
    cluster_label: int | None = None,
) -> Dict[str, Any]:
    """Generate a compact natural-language explanation for audit action."""
    reasons: List[str] = []

    if risk_score >= risk_threshold:
        reasons.append(
            f"risk_score ({risk_score:.4f}) exceeded threshold ({risk_threshold:.4f})"
        )
    else:
        reasons.append(
            f"risk_score ({risk_score:.4f}) remained below threshold ({risk_threshold:.4f})"
        )

    if budget_remaining is not None:
        reasons.append(f"budget_remaining={budget_remaining:.2f}")

    if cluster_label is not None and int(cluster_label) >= 0:
        reasons.append(f"cluster_label={int(cluster_label)} influenced prioritization")

    return {
        "action": action,
        "risk_score": float(risk_score),
        "risk_threshold": float(risk_threshold),
        "reasons": reasons,
    }
