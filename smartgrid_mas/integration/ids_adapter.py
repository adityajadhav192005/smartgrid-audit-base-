from __future__ import annotations

from typing import Dict, Any


def recommend_action_from_alert(alert: Dict[str, Any]) -> Dict[str, Any]:
    """
    Basic IDS/IPS alert-to-action mapping.

    Expected fields:
      - severity: low|medium|high|critical
      - confidence: float [0,1] (optional)
      - source, signature, category (optional metadata)
    """
    severity = str(alert.get("severity", "low")).lower()
    confidence = float(alert.get("confidence", 0.5))

    if severity == "critical" or (severity == "high" and confidence >= 0.8):
        action = "ISOLATE_NOTIFY"
        priority = "P1"
    elif severity == "high":
        action = "INCREASE_AUDIT"
        priority = "P2"
    elif severity == "medium":
        action = "MAINTAIN_AUDIT"
        priority = "P3"
    else:
        action = "LOG_MONITOR"
        priority = "P4"

    return {
        "severity": severity,
        "confidence": confidence,
        "recommended_action": action,
        "priority": priority,
        "source": alert.get("source"),
        "signature": alert.get("signature"),
        "category": alert.get("category"),
    }
