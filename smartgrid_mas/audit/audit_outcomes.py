"""
Audit Outcomes - classification of audit results

Paper-faithful implementation:
- True Positive: Confirmed anomaly (correct detection)
- True Negative: Clean (correct rejection)
- False Positive: False alarm (incorrect detection)
- False Negative: Missed anomaly (incorrect rejection)
"""
from __future__ import annotations
from enum import Enum


class AuditOutcome(str, Enum):
    """
    Outcome classification for audit events.
    
    Used to compute TP/TN/FP/FN rates and provide learning signals
    for RL-based audit scheduling.
    """
    CONFIRMED_ANOMALY = "CONFIRMED_ANOMALY"  # True Positive
    FALSE_ALARM = "FALSE_ALARM"              # False Positive
    MISSED_ANOMALY = "MISSED_ANOMALY"        # False Negative
    CLEAN = "CLEAN"                          # True Negative
