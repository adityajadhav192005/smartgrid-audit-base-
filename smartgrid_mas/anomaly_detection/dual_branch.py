from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict

import numpy as np

from smartgrid_mas.anomaly_detection.inference import concat_xy_window


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except Exception:
        return default


@dataclass
class BranchFusionResult:
    grid_prob: float
    network_prob: float
    fused_prob: float
    agreement: float
    agreement_bonus: float


def build_grid_branch_window(history: Dict[str, Any]) -> np.ndarray:
    return concat_xy_window(history["X"], history["Y"])


def build_network_branch_window(history: Dict[str, Any]) -> np.ndarray:
    return np.asarray(history["Y"], dtype=np.float32)


def fuse_branch_probabilities(grid_prob: float, network_prob: float) -> BranchFusionResult:
    """
    Decision-level fusion for dual-branch anomaly detection.

    Branch 1: cyber-physical grid anomaly score
    Branch 2: communication/intrusion score
    """
    w_grid = _env_float("SMARTGRID_FUSION_W_GRID", 0.58)
    w_network = _env_float("SMARTGRID_FUSION_W_NETWORK", 0.42)
    agreement_scale = _env_float("SMARTGRID_FUSION_AGREEMENT_SCALE", 0.10)
    disagreement_scale = _env_float("SMARTGRID_FUSION_DISAGREEMENT_SCALE", 0.05)
    high_support_floor = _env_float("SMARTGRID_FUSION_HIGH_SUPPORT_FLOOR", 0.85)
    high_support_bonus = _env_float("SMARTGRID_FUSION_HIGH_SUPPORT_BONUS", 0.08)

    gp = float(np.clip(grid_prob, 0.0, 1.0))
    npb = float(np.clip(network_prob, 0.0, 1.0))
    agreement = float(max(0.0, 1.0 - abs(gp - npb)))
    joint_support = min(gp, npb)
    support_peak = max(gp, npb)

    agreement_bonus = agreement_scale * agreement * joint_support
    disagreement_penalty = disagreement_scale * abs(gp - npb)
    fused = (w_grid * gp) + (w_network * npb) + agreement_bonus - disagreement_penalty

    if gp >= high_support_floor and npb >= high_support_floor:
        fused += high_support_bonus
    elif support_peak >= 0.95:
        fused += 0.5 * high_support_bonus

    fused = float(np.clip(fused, 0.0, 1.0))
    return BranchFusionResult(
        grid_prob=gp,
        network_prob=npb,
        fused_prob=fused,
        agreement=agreement,
        agreement_bonus=agreement_bonus,
    )
