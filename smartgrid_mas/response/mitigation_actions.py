"""
Mitigation actions based on severity levels.

Paper-specified response actions:
    LOW:      Log and monitor (no structural changes)
    MEDIUM:   Increase audit frequency (+1 within bounds)
    HIGH:     Isolate agent and notify controller
    CRITICAL: Emergency shutdown

Each action updates agent state and returns event descriptor.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any

from smartgrid_mas.response.severity_scoring import SeverityLevel
from smartgrid_mas.agents.base_agent import BaseAgent


@dataclass
class MitigationStatus:
    """Runtime mitigation status attached to agents."""
    active: bool = True        # Agent operational?
    shutdown: bool = False     # Emergency shutdown triggered?
    notes: str = ""           # Human-readable status


def ensure_mitigation_status(agent: BaseAgent) -> None:
    """
    Ensure agent has mitigation status attribute.
    
    Lazily creates MitigationStatus if not present.
    
    Args:
        agent: Agent to check/initialize
    """
    if not hasattr(agent, "mitigation"):
        setattr(agent, "mitigation", MitigationStatus())


def apply_mitigation(
    agent: BaseAgent,
    level: SeverityLevel,
    f_min: int = 1,
    f_max: int = 5,
) -> Dict[str, Any]:
    """
    Apply mitigation action based on severity level.
    
    Actions by level:
        LOW:      Log event, continue monitoring
        MEDIUM:   Increase audit frequency by 1
        HIGH:     Isolate agent (set active=False)
        CRITICAL: Emergency shutdown (active=False, shutdown=True)
    
    Args:
        agent: Agent to apply mitigation to
        level: Severity level determining action
        f_min: Minimum audit frequency (for MEDIUM)
        f_max: Maximum audit frequency (for MEDIUM)
    
    Returns:
        Event dictionary describing action taken
    
    Example:
        >>> event = apply_mitigation(agent, SeverityLevel.MEDIUM)
        >>> event['action']
        'INCREASE_AUDIT'
    """
    ensure_mitigation_status(agent)
    m: MitigationStatus = getattr(agent, "mitigation")
    
    # Initialize event descriptor
    event: Dict[str, Any] = {
        "agent_id": agent.agent_id,
        "severity": level.value
    }
    
    # Apply action based on severity
    if level == SeverityLevel.LOW:
        # Passive monitoring - no structural changes
        m.notes = "Logged anomaly; monitoring."
        event["action"] = "LOG_MONITOR"
    
    elif level == SeverityLevel.MEDIUM:
        # Increase audit intensity
        agent.set_audit_frequency(
            agent.audit_frequency + 1,
            f_min=f_min,
            f_max=f_max
        )
        # Sync state record
        if agent.last_state is not None:
            agent.last_state.audit_frequency = agent.audit_frequency
        
        m.notes = "Increased audit frequency."
        event["action"] = "INCREASE_AUDIT"
        event["new_frequency"] = agent.audit_frequency
    
    elif level == SeverityLevel.HIGH:
        # Isolate agent from grid operations
        m.active = False
        m.notes = "Isolated agent; notify controller."
        event["action"] = "ISOLATE_NOTIFY"
    
    elif level == SeverityLevel.CRITICAL:
        # Emergency shutdown - highest priority
        m.shutdown = True
        m.active = False
        m.notes = "Emergency shutdown triggered."
        event["action"] = "EMERGENCY_SHUTDOWN"
    
    else:
        # Unknown level - no operation
        event["action"] = "NOOP"
    
    return event
