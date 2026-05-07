from __future__ import annotations

import os
from typing import Any, Dict


ENGINEERING_DEFAULTS = {
    "voltage": 230.0,
    "frequency": 50.0,
    "current": 100.0,
    "power": 250.0,
    "response_time": 20.0,
}

CYBER_DEFAULTS = {
    "latency": 0.1,
    "packet_loss": 0.1,
    "integrity": 1.0,
    "comm_freq": 0.5,
}

ENG_SCALE = {
    "voltage": 230.0,
    "frequency": 50.0,
    "current": 100.0,
    "power": 250.0,
    "response_time": 20.0,
}

SCADA_COMPANY_PROFILE = {
    "phys_defaults": {
        "voltage": float(os.environ.get("SMARTGRID_SCADA_PROFILE_VOLTAGE_BASELINE", "230.0")),
        "frequency": float(os.environ.get("SMARTGRID_SCADA_PROFILE_FREQUENCY_BASELINE", "50.0")),
        "current": float(os.environ.get("SMARTGRID_SCADA_PROFILE_CURRENT_BASELINE", "100.0")),
        "power": float(os.environ.get("SMARTGRID_SCADA_PROFILE_POWER_BASELINE", "250.0")),
        "response_time": float(os.environ.get("SMARTGRID_SCADA_PROFILE_RESPONSE_TIME_BASELINE", "20.0")),
    },
    "cyber_defaults": {
        "latency": float(os.environ.get("SMARTGRID_SCADA_PROFILE_LATENCY_BASELINE", "0.1")),
        "packet_loss": float(os.environ.get("SMARTGRID_SCADA_PROFILE_PACKET_LOSS_BASELINE", "0.1")),
        "integrity": float(os.environ.get("SMARTGRID_SCADA_PROFILE_INTEGRITY_BASELINE", "1.0")),
        "comm_freq": float(os.environ.get("SMARTGRID_SCADA_PROFILE_COMM_FREQ_BASELINE", "0.5")),
    },
    "thx": [
        float(os.environ.get("SMARTGRID_SCADA_PROFILE_VOLTAGE_THRESHOLD", "10.0")),
        float(os.environ.get("SMARTGRID_SCADA_PROFILE_FREQUENCY_THRESHOLD", "0.5")),
        float(os.environ.get("SMARTGRID_SCADA_PROFILE_CURRENT_THRESHOLD", "20.0")),
        float(os.environ.get("SMARTGRID_SCADA_PROFILE_POWER_THRESHOLD", "50.0")),
        float(os.environ.get("SMARTGRID_SCADA_PROFILE_RESPONSE_TIME_THRESHOLD", "10.0")),
    ],
    "thy": [
        float(os.environ.get("SMARTGRID_SCADA_PROFILE_LATENCY_THRESHOLD", "10.0")),
        float(os.environ.get("SMARTGRID_SCADA_PROFILE_PACKET_LOSS_THRESHOLD", "0.02")),
        float(os.environ.get("SMARTGRID_SCADA_PROFILE_INTEGRITY_THRESHOLD", "0.1")),
        float(os.environ.get("SMARTGRID_SCADA_PROFILE_COMM_FREQ_THRESHOLD", "10.0")),
    ],
}


def _agent_profile(agent_id: str) -> Dict[str, Any]:
    normalized = str(agent_id or "").strip().upper()

    if normalized.startswith("GEN-"):
        phys_defaults = {
            "voltage": float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_VOLTAGE_BASELINE", "230.0")),
            "frequency": float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_FREQUENCY_BASELINE", "50.0")),
            "current": float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_CURRENT_BASELINE", "15.0")),
            "power": float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_POWER_BASELINE", "3.0")),
            "response_time": float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_RESPONSE_TIME_BASELINE", "3.0")),
        }
        cyber_defaults = {
            "latency": float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_LATENCY_BASELINE", "3.0")),
            "packet_loss": float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_PACKET_LOSS_BASELINE", "0.001")),
            "integrity": float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_INTEGRITY_BASELINE", "1.0")),
            "comm_freq": float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_COMM_FREQ_BASELINE", "50.0")),
        }
        thx = [
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_VOLTAGE_THRESHOLD", "12.0")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_FREQUENCY_THRESHOLD", "0.5")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_CURRENT_THRESHOLD", "8.0")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_POWER_THRESHOLD", "2.5")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_RESPONSE_TIME_THRESHOLD", "4.0")),
        ]
        thy = [
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_LATENCY_THRESHOLD", "1.5")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_PACKET_LOSS_THRESHOLD", "0.01")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_INTEGRITY_THRESHOLD", "0.1")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_GEN_COMM_FREQ_THRESHOLD", "8.0")),
        ]
    elif normalized.startswith("SUB-"):
        phys_defaults = {
            "voltage": float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_VOLTAGE_BASELINE", "230.0")),
            "frequency": float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_FREQUENCY_BASELINE", "50.0")),
            "current": float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_CURRENT_BASELINE", "12.0")),
            "power": float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_POWER_BASELINE", "180.0")),
            "response_time": float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_RESPONSE_TIME_BASELINE", "4.0")),
        }
        cyber_defaults = {
            "latency": float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_LATENCY_BASELINE", "4.0")),
            "packet_loss": float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_PACKET_LOSS_BASELINE", "0.001")),
            "integrity": float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_INTEGRITY_BASELINE", "1.0")),
            "comm_freq": float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_COMM_FREQ_BASELINE", "50.0")),
        }
        thx = [
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_VOLTAGE_THRESHOLD", "12.0")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_FREQUENCY_THRESHOLD", "0.5")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_CURRENT_THRESHOLD", "10.0")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_POWER_THRESHOLD", "80.0")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_RESPONSE_TIME_THRESHOLD", "5.0")),
        ]
        thy = [
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_LATENCY_THRESHOLD", "1.5")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_PACKET_LOSS_THRESHOLD", "0.01")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_INTEGRITY_THRESHOLD", "0.1")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_SUB_COMM_FREQ_THRESHOLD", "8.0")),
        ]
    elif normalized.startswith("PMU-"):
        phys_defaults = {
            "voltage": float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_VOLTAGE_BASELINE", "230.0")),
            "frequency": float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_FREQUENCY_BASELINE", "50.0")),
            "current": float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_CURRENT_BASELINE", "0.5")),
            "power": float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_POWER_BASELINE", "1.0")),
            "response_time": float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_RESPONSE_TIME_BASELINE", "2.0")),
        }
        cyber_defaults = {
            "latency": float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_LATENCY_BASELINE", "2.0")),
            "packet_loss": float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_PACKET_LOSS_BASELINE", "0.001")),
            "integrity": float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_INTEGRITY_BASELINE", "1.0")),
            "comm_freq": float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_COMM_FREQ_BASELINE", "50.0")),
        }
        thx = [
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_VOLTAGE_THRESHOLD", "10.0")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_FREQUENCY_THRESHOLD", "0.3")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_CURRENT_THRESHOLD", "1.5")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_POWER_THRESHOLD", "1.5")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_RESPONSE_TIME_THRESHOLD", "3.0")),
        ]
        thy = [
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_LATENCY_THRESHOLD", "1.0")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_PACKET_LOSS_THRESHOLD", "0.01")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_INTEGRITY_THRESHOLD", "0.1")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_PMU_COMM_FREQ_THRESHOLD", "8.0")),
        ]
    elif normalized.startswith("BRK-"):
        phys_defaults = {
            "voltage": float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_VOLTAGE_BASELINE", "230.0")),
            "frequency": float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_FREQUENCY_BASELINE", "50.0")),
            "current": float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_CURRENT_BASELINE", "0.0")),
            "power": float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_POWER_BASELINE", "0.0")),
            "response_time": float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_RESPONSE_TIME_BASELINE", "3.0")),
        }
        cyber_defaults = {
            "latency": float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_LATENCY_BASELINE", "3.0")),
            "packet_loss": float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_PACKET_LOSS_BASELINE", "0.001")),
            "integrity": float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_INTEGRITY_BASELINE", "1.0")),
            "comm_freq": float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_COMM_FREQ_BASELINE", "50.0")),
        }
        thx = [
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_VOLTAGE_THRESHOLD", "15.0")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_FREQUENCY_THRESHOLD", "0.5")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_CURRENT_THRESHOLD", "5.0")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_POWER_THRESHOLD", "2.0")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_RESPONSE_TIME_THRESHOLD", "4.0")),
        ]
        thy = [
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_LATENCY_THRESHOLD", "1.5")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_PACKET_LOSS_THRESHOLD", "0.01")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_INTEGRITY_THRESHOLD", "0.1")),
            float(os.environ.get("SMARTGRID_SCADA_PROFILE_BRK_COMM_FREQ_THRESHOLD", "8.0")),
        ]
    else:
        phys_defaults = dict(SCADA_COMPANY_PROFILE["phys_defaults"])
        cyber_defaults = dict(SCADA_COMPANY_PROFILE["cyber_defaults"])
        thx = list(SCADA_COMPANY_PROFILE["thx"])
        thy = list(SCADA_COMPANY_PROFILE["thy"])
    return {
        "phys_defaults": phys_defaults,
        "cyber_defaults": cyber_defaults,
        "thx": thx,
        "thy": thy,
    }


def get_scada_algorithm_config(score_threshold: float = 3.0) -> Dict[str, Any]:
    type_ids = {
        "generator": "GEN-01",
        "substation": "SUB-21",
        "pmu": "PMU-51",
        "breaker": "BRK-76",
    }
    profiles = {}
    for name, agent_id in type_ids.items():
        profile = _agent_profile(agent_id)
        profiles[name] = {
            "agent_id_example": agent_id,
            "phys_defaults": dict(profile["phys_defaults"]),
            "cyber_defaults": dict(profile["cyber_defaults"]),
            "thx": list(profile["thx"]),
            "thy": list(profile["thy"]),
        }

    return {
        "score_threshold": float(score_threshold),
        "shared_profile": {
            "phys_defaults": dict(SCADA_COMPANY_PROFILE["phys_defaults"]),
            "cyber_defaults": dict(SCADA_COMPANY_PROFILE["cyber_defaults"]),
            "thx": list(SCADA_COMPANY_PROFILE["thx"]),
            "thy": list(SCADA_COMPANY_PROFILE["thy"]),
        },
        "profiles": profiles,
        "feature_names_phys": ["voltage", "frequency", "current", "power", "response_time"],
        "feature_names_cyber": ["latency", "packet_loss", "integrity", "comm_freq"],
    }


def normalize_scada_tags(tags: Dict[str, float]) -> Dict[str, float]:
    normalized = {str(key): float(value) for key, value in tags.items()}

    voltage = float(normalized.get("voltage", 0.0))
    current = float(normalized.get("current", 0.0))
    latency = normalized.get("latency")
    response_time = normalized.get("response_time")
    power = normalized.get("power")
    substation_load = normalized.get("substation_load")
    breaker_status = normalized.get("breaker_status")

    if latency is None and response_time is not None:
        normalized["latency"] = float(response_time)
    if response_time is None and latency is not None:
        normalized["response_time"] = float(latency)

    if power is None and substation_load is not None:
        normalized["power"] = float(substation_load)
    if substation_load is None and power is not None:
        normalized["substation_load"] = float(power)

    if ("power" not in normalized or "substation_load" not in normalized) and voltage > 0 and current > 0:
        # Approximate feeder load from live V/I when SCADA omits an explicit load channel.
        inferred_kw = (voltage * current * 0.92) / 1000.0
        normalized.setdefault("power", inferred_kw)
        normalized.setdefault("substation_load", inferred_kw)

    if breaker_status is None:
        normalized["breaker_status"] = 1.0 if current > 0.5 else 0.0

    return normalized


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

    Missing required tags are rejected for strict live ingest.
    """

    tags = normalize_scada_tags(tags)
    profile = _agent_profile(agent_id)
    phys_defaults = dict(profile["phys_defaults"])
    cyber_defaults = dict(profile["cyber_defaults"])

    agent = str(agent_id or "").strip().upper()
    if agent.startswith("GEN-"):
        required_live = ["voltage", "current", "latency", "packet_loss", "integrity", "comm_freq"]
    elif agent.startswith("SUB-"):
        required_live = ["substation_load", "latency", "packet_loss", "integrity", "comm_freq"]
    elif agent.startswith("PMU-"):
        required_live = ["voltage", "frequency", "latency", "packet_loss", "integrity", "comm_freq"]
    elif agent.startswith("BRK-"):
        required_live = ["breaker_status", "latency", "packet_loss", "integrity", "comm_freq"]
    else:
        required_live = ["latency", "packet_loss", "integrity", "comm_freq"]

    missing_live = [k for k in required_live if k not in tags]
    if missing_live:
        raise ValueError(
            "Live SCADA ingest rejected due to missing required live tags: " + str(missing_live)
        )

    required_cyber = list(cyber_defaults.keys())
    missing_cyber = [k for k in required_cyber if k not in tags]
    if missing_cyber:
        missing_parts = []
        if missing_cyber:
            missing_parts.append(f"cyber={missing_cyber}")
        if missing_parts:
            raise ValueError(
                "Live SCADA ingest rejected due to missing required tags: " + ", ".join(missing_parts)
            )

    voltage = float(tags.get("voltage", 0.0)) if "voltage" in tags else 0.0
    frequency = float(tags.get("frequency", 0.0)) if "frequency" in tags else 0.0
    current = float(tags.get("current", 0.0)) if "current" in tags else 0.0
    latency = float(tags.get("latency", 0.0)) if "latency" in tags else 0.0
    response_time = float(tags.get("response_time", latency)) if ("response_time" in tags or "latency" in tags) else 0.0
    power = (
        float(tags["power"]) if "power" in tags else
        float(tags["substation_load"]) if "substation_load" in tags else
        ((voltage * current * 0.92) / 1000.0 if (voltage > 0 and current > 0) else 0.0)
    )

    if current <= 0 and power > 0 and voltage > 0:
        current = (power * 1000.0) / (voltage * 0.92)

    merged_phys = {
        "voltage": float(voltage),
        "frequency": float(frequency),
        "current": float(current),
        "power": float(power),
        "response_time": float(response_time),
    }

    for k in merged_phys.keys():
        raw_val = float(merged_phys[k])
        if k in ENG_SCALE and 0.0 <= raw_val <= 2.0:
            merged_phys[k] = raw_val * ENG_SCALE[k]
    merged_cyber = {k: float(tags[k]) for k in cyber_defaults.keys()}

    x_phys = [merged_phys[k] for k in phys_defaults.keys()]
    y_cyber = [merged_cyber[k] for k in cyber_defaults.keys()]

    # Nominal baselines and thresholds; these can be replaced by site-specific profiles.
    bx = [phys_defaults[k] for k in phys_defaults.keys()]
    by = [cyber_defaults[k] for k in cyber_defaults.keys()]
    thx = list(profile["thx"])
    thy = list(profile["thy"])

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
