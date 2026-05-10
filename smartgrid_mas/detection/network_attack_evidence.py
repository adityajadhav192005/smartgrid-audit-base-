from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable

import numpy as np
import pandas as pd


_DOS_LIKE = {"dos", "generic", "fuzzers"}
_MITM_LIKE = {"exploits", "backdoor", "shellcode", "worms", "analysis"}
_NETWORK_GENERIC = {"reconnaissance"}


@dataclass
class NetworkAttackEvidence:
    label: str
    confidence: float
    dos_score: float
    mitm_score: float
    network_score: float
    priors: Dict[str, float]


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except Exception:
        return default


def _profile_default_float(key: str, robust: float, balanced: float, cost: float) -> float:
    profile = os.environ.get("SMARTGRID_OPTIMIZATION_PROFILE", "ROBUST").strip().upper()
    defaults = {
        "ROBUST": robust,
        "BALANCED": balanced,
        "COST": cost,
    }
    return _env_float(key, defaults.get(profile, balanced))


def _split_paths(raw_paths: str | Path | Iterable[str | Path]) -> list[Path]:
    if isinstance(raw_paths, (str, Path)):
        tokens = str(raw_paths).replace("\n", ";").replace(",", ";").split(";")
    else:
        tokens = [str(item) for item in raw_paths]
    return [Path(token.strip()) for token in tokens if str(token).strip()]


@lru_cache(maxsize=4)
def _load_attackcat_priors(raw_paths: str, max_rows: int) -> Dict[str, float]:
    paths = _split_paths(raw_paths)
    if not paths:
        return {"DOS": 0.4, "MITM": 0.4, "NETWORK": 0.2}

    counts = {"DOS": 0.0, "MITM": 0.0, "NETWORK": 0.0}
    for path in paths:
        if not path.exists():
            continue
        df = pd.read_csv(path, usecols=["attack_cat"], nrows=max_rows if max_rows > 0 else None)
        series = df["attack_cat"].fillna("Normal").astype(str).str.strip().str.lower()
        vc = series.value_counts()
        counts["DOS"] += float(sum(vc.get(cat, 0) for cat in _DOS_LIKE))
        counts["MITM"] += float(sum(vc.get(cat, 0) for cat in _MITM_LIKE))
        counts["NETWORK"] += float(sum(vc.get(cat, 0) for cat in _NETWORK_GENERIC))

    total = sum(counts.values())
    if total <= 0:
        return {"DOS": 0.4, "MITM": 0.4, "NETWORK": 0.2}
    return {key: value / total for key, value in counts.items()}


def infer_network_attack_evidence(
    y_cyber: np.ndarray,
    by: np.ndarray,
    thy: np.ndarray,
    network_prob: float,
    dataset_paths: str | None = None,
) -> NetworkAttackEvidence:
    """
    Map branch-2 evidence into DOS/MITM/network attack families using
    current cyber deviations plus UNSW attack_cat priors.
    """
    obs = np.asarray(y_cyber, dtype=float)
    base = np.asarray(by, dtype=float)
    th = np.maximum(np.asarray(thy, dtype=float), 1e-6)
    norm = np.abs(obs - base) / th

    latency = float(norm[0]) if norm.size > 0 else 0.0
    packet_loss = float(norm[1]) if norm.size > 1 else 0.0
    integrity = float(norm[2]) if norm.size > 2 else 0.0
    comm_freq = float(norm[3]) if norm.size > 3 else 0.0
    net_prob = float(np.clip(network_prob, 0.0, 1.0))

    priors = _load_attackcat_priors(
        raw_paths=dataset_paths or os.environ.get("SMARTGRID_NET_DATA_PATH", ""),
        max_rows=int(os.environ.get("SMARTGRID_NET_PRIOR_MAX_ROWS", "50000") or 50000),
    )

    dos_signal = min(1.0, ((1.20 * latency) + (1.15 * packet_loss) + (0.95 * comm_freq)) / 4.0)
    mitm_signal = min(1.0, ((1.45 * integrity) + (0.85 * latency) + (0.65 * packet_loss)) / 4.0)
    network_signal = min(1.0, ((1.10 * comm_freq) + (0.75 * latency) + (0.50 * packet_loss)) / 4.0)

    dos_score = (0.44 * net_prob) + (0.40 * dos_signal) + (0.16 * priors["DOS"])
    mitm_score = (0.42 * net_prob) + (0.42 * mitm_signal) + (0.16 * priors["MITM"])
    network_score = (0.39 * net_prob) + (0.38 * network_signal) + (0.23 * priors["NETWORK"])
    if dos_signal >= (mitm_signal + 0.08):
        dos_score += 0.10 * dos_signal
        mitm_score -= 0.06 * dos_signal
    elif mitm_signal >= (dos_signal + 0.08):
        mitm_score += 0.10 * mitm_signal
        dos_score -= 0.06 * mitm_signal
    if integrity <= 0.55 and packet_loss >= 0.85:
        dos_score += 0.08 * min(1.0, packet_loss)
        mitm_score -= 0.12 * min(1.0, packet_loss)
    if integrity >= 0.85 and latency >= 0.55:
        mitm_score += 0.08 * min(1.0, integrity)

    scores = {
        "DOS": float(np.clip(dos_score, 0.0, 1.0)),
        "MITM": float(np.clip(mitm_score, 0.0, 1.0)),
        "NETWORK": float(np.clip(network_score, 0.0, 1.0)),
    }
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    label, top = ranked[0]
    second = ranked[1][1] if len(ranked) > 1 else 0.0

    activation_floor = _profile_default_float("SMARTGRID_NET_EVIDENCE_FLOOR", 0.34, 0.40, 0.46)
    confidence = max(0.0, min(1.0, top - second + 0.35 * top))
    if label == "DOS" and dos_signal >= 0.52 and net_prob >= 0.60:
        confidence = max(confidence, min(1.0, (0.58 * dos_signal) + (0.42 * net_prob)))
    if label == "MITM" and mitm_signal >= 0.52 and net_prob >= 0.58:
        confidence = max(confidence, min(1.0, (0.60 * mitm_signal) + (0.40 * net_prob)))
    if top < activation_floor:
        label = "NONE"
        confidence = 0.0

    return NetworkAttackEvidence(
        label=label,
        confidence=float(confidence),
        dos_score=scores["DOS"],
        mitm_score=scores["MITM"],
        network_score=scores["NETWORK"],
        priors=priors,
    )
