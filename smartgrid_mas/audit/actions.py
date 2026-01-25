from __future__ import annotations
from enum import IntEnum


class AuditAction(IntEnum):
    """
    Audit frequency adjustment actions.
    
    - DEC: Decrease audit frequency (more conservative)
    - HOLD: Maintain current audit frequency
    - INC: Increase audit frequency (more aggressive)
    """
    DEC = 0
    HOLD = 1
    INC = 2
