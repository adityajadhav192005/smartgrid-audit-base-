from __future__ import annotations

from typing import Any, Dict


def scada_tags_to_score_request(
    agent_id: str,
    tags: Dict[str, float],
    criticality_weight: float = 1.0,
    score_threshold: float = 1.0,
) -> Dict[str, Any]:
    """
    Convert generic SCADA tag dictionary into score-request schema.

    Required tags (physical): voltage, frequency, current, power, response_time
    Required tags (cyber): latency, packet_loss, integrity, comm_freq

    Missing tags fall back to nominal defaults.
    """

    phys_defaults = {
        "voltage": 1.0,
        "frequency": 1.0,
        "current": 1.0,
        "power": 1.0,
        "response_time": 1.0,
    }
    cyber_defaults = {
        "latency": 0.1,
        "packet_loss": 0.1,
        "integrity": 1.0,
        "comm_freq": 0.5,
    }

    merged_phys = {k: float(tags.get(k, v)) for k, v in phys_defaults.items()}
    merged_cyber = {k: float(tags.get(k, v)) for k, v in cyber_defaults.items()}

    x_phys = [merged_phys[k] for k in phys_defaults.keys()]
    y_cyber = [merged_cyber[k] for k in cyber_defaults.keys()]

    # Nominal baselines and thresholds; these can be replaced by site-specific profiles.
    bx = [phys_defaults[k] for k in phys_defaults.keys()]
    by = [cyber_defaults[k] for k in cyber_defaults.keys()]
    thx = [0.2] * len(x_phys)
    thy = [0.2] * len(y_cyber)

    return {
        "agent_id": agent_id,
        "x_phys": x_phys,
        "y_cyber": y_cyber,
        "bx": bx,
        "by": by,
        "thx": thx,
        "thy": thy,
        "criticality_weight": float(criticality_weight),
        "score_threshold": float(score_threshold),
        "feature_names_phys": list(phys_defaults.keys()),
        "feature_names_cyber": list(cyber_defaults.keys()),
    }
