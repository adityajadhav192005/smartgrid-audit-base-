"""
Multi-layer anomaly detection (thesis contribution).

Combines three complementary detection layers that catch attacks the primary
LSTM threshold detector misses, while keeping FPR low through OR-with-precedence
logic (each agent flagged at most once per timestep).

Layer A : Calibrated LSTM threshold      - implemented in scoring_pipeline.py
Layer B : Temporal accumulator            - this module, sustained_suspicion()
Layer C : Attack-type sub-detectors       - this module
          - CUSUM drift detector  -> FDI
          - Network rule detector -> DoS
          - Integrity check       -> MITM

Each Layer-B/C detector returns (fired: bool, label: str, confidence: float).
The combiner aggregates with OR-precedence: if any layer fires, the agent is
flagged and the strongest-confidence label wins for attack typing.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable, Optional

import numpy as np


def _env_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except Exception:
        return default


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except Exception:
        return default


@dataclass
class DetectionLayerResult:
    fired: bool
    label: str
    confidence: float
    reason: str


_NULL_RESULT = DetectionLayerResult(False, "NONE", 0.0, "")


# ---------------------------------------------------------------------------
# Layer B: Temporal accumulator
# ---------------------------------------------------------------------------
def sustained_suspicion(
    prob_history: Iterable[float],
    *,
    window: Optional[int] = None,
    floor: Optional[float] = None,
    min_consecutive: Optional[int] = None,
) -> DetectionLayerResult:
    """
    Layer B: flag if the LSTM probability has stayed above a low floor for
    `min_consecutive` consecutive steps within the trailing window.

    Catches attacks where individual timesteps are below the primary threshold
    but the sustained pattern reveals the attack (FDI continuous injection,
    MITM persistent tampering).

    Defaults are tuned conservative-by-default: floor 0.55, 5 consecutive steps.
    Random noise rarely persists above 0.55 for 5 steps, so FPR stays near 0.
    """
    win = window if window is not None else _env_int("SMARTGRID_TEMPORAL_WINDOW", 6)
    flr = floor if floor is not None else _env_float("SMARTGRID_TEMPORAL_FLOOR", 0.55)
    need = min_consecutive if min_consecutive is not None else _env_int(
        "SMARTGRID_TEMPORAL_CONSEC", 5
    )

    seq = list(prob_history)[-win:]
    if len(seq) < need:
        return _NULL_RESULT

    # Find the longest run of consecutive values >= floor
    run = 0
    longest = 0
    sustained_avg = 0.0
    for p in seq:
        if float(p) >= flr:
            run += 1
            longest = max(longest, run)
        else:
            run = 0
    if longest < need:
        return _NULL_RESULT

    # Confidence reflects how high above the floor the recent trail sits
    above = [float(p) for p in seq if float(p) >= flr]
    sustained_avg = float(np.mean(above)) if above else flr
    confidence = float(min(1.0, (sustained_avg - flr) / max(1e-6, 1.0 - flr)))
    return DetectionLayerResult(
        fired=True,
        label="SUSTAINED",  # type-agnostic; the type classifier handles labelling
        confidence=confidence,
        reason=f"sustained_prob>={flr:.2f} for {longest} steps",
    )


# ---------------------------------------------------------------------------
# Layer C-1: CUSUM drift detector for FDI
# ---------------------------------------------------------------------------
def cusum_fdi_detector(
    phys_history: Iterable[np.ndarray],
    baseline: np.ndarray,
    *,
    scale: Optional[np.ndarray] = None,
    drift_k: Optional[float] = None,
    alarm_h: Optional[float] = None,
    window: Optional[int] = None,
) -> DetectionLayerResult:
    """
    Layer C-1: CUSUM (cumulative sum) test on physical residuals.

    FDI attacks slowly bias sensor readings - each step is small but the
    cumulative bias grows over time. CUSUM accumulates the signed residual
    minus a tolerance `k`; when the cumulative sum exceeds `h`, alarm.

    Random noise has zero mean -> CUSUM stays near zero.
    FDI bias has nonzero mean -> CUSUM ramps up linearly.

    `scale` should be the per-feature normal-variability scale (e.g. the
    agent's `thx` threshold vector). When supplied, k and h are interpretable
    as multiples of normal sensor variation. When omitted, the function falls
    back to a fixed unit scale, which works for already-normalised features
    but is less robust against noise.
    """
    k = drift_k if drift_k is not None else _env_float("SMARTGRID_CUSUM_K", 0.50)
    h = alarm_h if alarm_h is not None else _env_float("SMARTGRID_CUSUM_H", 4.00)
    win = window if window is not None else _env_int("SMARTGRID_CUSUM_WINDOW", 8)

    hist = list(phys_history)[-win:]
    if len(hist) < 4:
        return _NULL_RESULT

    base = np.asarray(baseline, dtype=float)
    if base.size == 0:
        return _NULL_RESULT

    seq = np.stack([np.asarray(x, dtype=float) for x in hist], axis=0)
    if seq.shape[1] != base.shape[0]:
        return _NULL_RESULT
    residual = seq - base[None, :]

    # Normalisation: prefer external scale (sensor thresholds). Otherwise use
    # the LARGER of intra-window std and a fixed minimum, to prevent zero-std
    # collapse from amplifying tiny zero-mean noise into spurious z-scores.
    if scale is not None:
        sc = np.asarray(scale, dtype=float)
        if sc.shape != base.shape:
            sc = np.maximum(np.abs(sc), 1.0)
        sc = np.maximum(sc, 1e-3)
    else:
        intra_std = np.std(residual, axis=0)
        sc = np.maximum(intra_std, 0.5)
    z = residual / sc[None, :]

    s_pos = np.zeros(base.shape[0])
    s_neg = np.zeros(base.shape[0])
    peak = 0.0
    for t in range(z.shape[0]):
        s_pos = np.maximum(0.0, s_pos + z[t] - k)
        s_neg = np.minimum(0.0, s_neg + z[t] + k)
        cur = float(max(np.max(s_pos), np.max(np.abs(s_neg))))
        if cur > peak:
            peak = cur

    if peak < h:
        return _NULL_RESULT

    confidence = float(min(1.0, (peak - h) / max(1.0, h)))
    return DetectionLayerResult(
        fired=True,
        label="FDI",
        confidence=max(0.55, confidence),
        reason=f"cusum_peak={peak:.2f} >= h={h:.2f}",
    )


# ---------------------------------------------------------------------------
# Layer C-2: Network rule-based DoS detector
# ---------------------------------------------------------------------------
def network_dos_detector(
    y_cyber: np.ndarray,
    baseline_y: np.ndarray,
    *,
    latency_mult: Optional[float] = None,
    packet_loss_min: Optional[float] = None,
    comm_drop_frac: Optional[float] = None,
) -> DetectionLayerResult:
    """
    Layer C-2: explicit rule check for DoS network signature.

    DoS leaves an unmistakable network fingerprint:
      - latency >> baseline (flooded channel)
      - packet loss elevated
      - comm frequency drops (agent stops responding normally)

    Two of three conditions must hold to flag (precision over recall).
    """
    if y_cyber is None or baseline_y is None:
        return _NULL_RESULT
    y = np.asarray(y_cyber, dtype=float)
    by = np.asarray(baseline_y, dtype=float)
    if y.size < 4 or by.size < 4:
        return _NULL_RESULT

    lat_mult = latency_mult if latency_mult is not None else _env_float(
        "SMARTGRID_DOS_LATENCY_MULT", 3.0
    )
    pl_min = packet_loss_min if packet_loss_min is not None else _env_float(
        "SMARTGRID_DOS_PACKETLOSS_MIN", 0.15
    )
    cf_drop = comm_drop_frac if comm_drop_frac is not None else _env_float(
        "SMARTGRID_DOS_COMM_DROP", 0.40
    )

    base_lat = max(1e-3, float(by[0]))
    latency_ratio = float(y[0]) / base_lat
    packet_loss = float(y[1])
    base_cf = max(1e-3, float(by[3]))
    comm_drop = max(0.0, 1.0 - (float(y[3]) / base_cf))

    cond_lat = latency_ratio >= lat_mult
    cond_loss = packet_loss >= pl_min
    cond_drop = comm_drop >= cf_drop

    fired_count = int(cond_lat) + int(cond_loss) + int(cond_drop)
    if fired_count < 2:
        return _NULL_RESULT

    severity = (
        min(1.0, latency_ratio / max(1.0, lat_mult * 2.0)) * 0.4
        + min(1.0, packet_loss / max(0.05, pl_min * 2.0)) * 0.3
        + min(1.0, comm_drop / max(0.05, cf_drop * 2.0)) * 0.3
    )
    return DetectionLayerResult(
        fired=True,
        label="DOS",
        confidence=max(0.55, float(severity)),
        reason=f"dos_signals={fired_count}/3 (lat={latency_ratio:.1f}x, loss={packet_loss:.2f}, drop={comm_drop:.2f})",
    )


# ---------------------------------------------------------------------------
# Layer C-3: Integrity / consistency MITM detector
# ---------------------------------------------------------------------------
def integrity_mitm_detector(
    y_cyber: np.ndarray,
    baseline_y: np.ndarray,
    *,
    y_history: Optional[Iterable[np.ndarray]] = None,
    integrity_floor: Optional[float] = None,
    jump_z: Optional[float] = None,
) -> DetectionLayerResult:
    """
    Layer C-3: MITM detection via data integrity + temporal consistency.

    MITM tampers messages in transit. Two signatures betray it:
      1. integrity score (y[2]) deviates well below baseline
      2. temporal jump: this step's cyber vector is statistically far from
         the recent trailing mean (sudden swap of values)

    Both signals required (AND) to keep precision high.
    """
    if y_cyber is None or baseline_y is None:
        return _NULL_RESULT
    y = np.asarray(y_cyber, dtype=float)
    by = np.asarray(baseline_y, dtype=float)
    if y.size < 3 or by.size < 3:
        return _NULL_RESULT

    floor_mult = integrity_floor if integrity_floor is not None else _env_float(
        "SMARTGRID_MITM_INTEGRITY_DROP", 0.35
    )
    z_thresh = jump_z if jump_z is not None else _env_float(
        "SMARTGRID_MITM_JUMP_Z", 2.5
    )

    base_integrity = max(1e-3, float(by[2]))
    integrity_ratio = float(y[2]) / base_integrity
    integrity_drop = (1.0 - integrity_ratio) >= floor_mult

    if not integrity_drop:
        return _NULL_RESULT

    # Temporal consistency: how many sigmas is the current vector from history mean?
    if y_history is None:
        return _NULL_RESULT
    hist = list(y_history)[-8:]
    if len(hist) < 4:
        return _NULL_RESULT
    arr = np.stack([np.asarray(h, dtype=float) for h in hist], axis=0)
    mu = arr.mean(axis=0)
    sd = arr.std(axis=0)
    sd = np.where(sd < 1e-3, 1.0, sd)
    z = np.abs(y - mu) / sd
    peak_z = float(np.max(z))
    if peak_z < z_thresh:
        return _NULL_RESULT

    confidence = float(
        min(1.0, 0.5 * (1.0 - integrity_ratio) / max(1e-3, floor_mult)
            + 0.5 * (peak_z - z_thresh) / max(1.0, z_thresh))
    )
    return DetectionLayerResult(
        fired=True,
        label="MITM",
        confidence=max(0.55, confidence),
        reason=f"integrity_drop={(1.0 - integrity_ratio):.2f}, jump_z={peak_z:.1f}",
    )


# ---------------------------------------------------------------------------
# Combiner: OR-with-precedence
# ---------------------------------------------------------------------------
def combine_layers(*results: DetectionLayerResult) -> DetectionLayerResult:
    """
    OR-with-precedence: an agent is flagged if any layer fires. The label
    chosen is the firing layer with the highest confidence; the temporal
    accumulator (label SUSTAINED) defers to any specific-type detector that
    also fires, since type-specific results carry domain meaning.
    """
    fired = [r for r in results if r.fired]
    if not fired:
        return _NULL_RESULT
    typed = [r for r in fired if r.label not in ("SUSTAINED", "NONE")]
    pool = typed if typed else fired
    winner = max(pool, key=lambda r: r.confidence)
    return winner


__all__ = [
    "DetectionLayerResult",
    "sustained_suspicion",
    "cusum_fdi_detector",
    "network_dos_detector",
    "integrity_mitm_detector",
    "combine_layers",
]
