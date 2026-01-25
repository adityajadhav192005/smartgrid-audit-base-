"""
Audit Validator - computes audit outcomes from ground truth

Paper-faithful implementation:
- Compares agent predictions (anomaly_flag) with ground truth labels
- Returns AuditOutcome for each audited agent
- Enables RL learning from audit results
"""
from __future__ import annotations
from smartgrid_mas.audit.audit_outcomes import AuditOutcome
from smartgrid_mas.agents.base_agent import BaseAgent


def evaluate_audit_outcome(
    agent: BaseAgent,
    truth_label: int,
) -> AuditOutcome:
    """
    Evaluate audit outcome by comparing prediction with ground truth.
    
    Args:
        agent: Agent being audited (contains prediction in last_state.anomaly_flag)
        truth_label: Ground truth (1 if attacked/faulty, 0 otherwise)
        
    Returns:
        AuditOutcome classification (CONFIRMED_ANOMALY, FALSE_ALARM, MISSED_ANOMALY, CLEAN)
        
    Confusion matrix:
                    Truth=1         Truth=0
        Pred=1      CONFIRMED       FALSE_ALARM
        Pred=0      MISSED          CLEAN
    """
    if agent.last_state is None:
        return AuditOutcome.CLEAN
    
    pred = 1 if agent.last_state.anomaly_flag else 0
    truth = 1 if truth_label else 0
    
    if pred == 1 and truth == 1:
        return AuditOutcome.CONFIRMED_ANOMALY  # True Positive
    if pred == 1 and truth == 0:
        return AuditOutcome.FALSE_ALARM        # False Positive
    if pred == 0 and truth == 1:
        return AuditOutcome.MISSED_ANOMALY     # False Negative
    return AuditOutcome.CLEAN                  # True Negative
