"""
Gradient-based audit frequency optimization.

Implements paper cost function:
    C_i = C_a * f_i + C_f * (R_i / f_i)

Gradient:
    dC/df = C_a - C_f * (R_i / f_i^2)

Update rule:
    f_i <- f_i - lr * dC/df

where:
    C_a = cost per audit
    C_f = failure/attack cost
    R_i = risk score for agent i
    f_i = audit frequency
    lr = learning rate (default 0.01 per paper)
"""

from __future__ import annotations


def audit_cost_per_agent(C_a: float, C_f: float, R_i: float, f_i: int) -> float:
    """
    Compute total cost for agent i given audit frequency f_i.
    
    Cost function from paper:
        C_i = C_a * f_i + C_f * (R_i / f_i)
    
    Args:
        C_a: Cost per audit
        C_f: Failure/attack cost coefficient
        R_i: Risk score for agent i
        f_i: Audit frequency (integer)
    
    Returns:
        Total cost (float)
    """
    f = max(1, int(f_i))  # Ensure f >= 1 to avoid division by zero
    return float(C_a * f + C_f * (float(R_i) / float(f)))


def grad_cost_wrt_f(C_a: float, C_f: float, R_i: float, f_i: int) -> float:
    """
    Compute gradient of cost w.r.t. frequency.
    
    Gradient from paper:
        dC/df = C_a - C_f * (R_i / f^2)
    
    Args:
        C_a: Cost per audit
        C_f: Failure/attack cost coefficient
        R_i: Risk score for agent i
        f_i: Current audit frequency
    
    Returns:
        Gradient value (float)
    """
    f = max(1, int(f_i))  # Ensure f >= 1 to avoid division by zero
    return float(C_a - C_f * (float(R_i) / (float(f) ** 2)))


def gradient_update_frequency(
    f_i: int,
    R_i: float,
    C_a: float,
    C_f: float,
    lr: float = 0.01,  # Paper specification
    f_min: int = 1,
    f_max: int = 5,
) -> int:
    """
    Perform one gradient descent step on audit frequency.
    
    Update rule:
        f_{i}^{k+1} = f_{i}^{k} - lr * (dC/df)
    
    Then:
        - Round to nearest integer
        - Clamp to [f_min, f_max]
    
    Args:
        f_i: Current audit frequency
        R_i: Risk score for agent
        C_a: Cost per audit
        C_f: Failure/attack cost coefficient
        lr: Learning rate (default 0.01)
        f_min: Minimum allowed frequency
        f_max: Maximum allowed frequency
    
    Returns:
        Updated audit frequency (integer)
    
    Example:
        >>> gradient_update_frequency(f_i=3, R_i=2.0, C_a=1.0, C_f=10.0, lr=0.01)
        3  # Small adjustment based on cost gradient
    """
    # Compute gradient
    g = grad_cost_wrt_f(C_a=C_a, C_f=C_f, R_i=R_i, f_i=f_i)
    
    # Gradient descent update
    f_new = float(f_i) - float(lr) * float(g)
    
    # Round to nearest integer (audit counts must be discrete)
    f_int = int(round(f_new))
    
    # Enforce bounds [f_min, f_max] and ensure non-zero
    f_int = max(f_min, min(f_max, f_int))
    
    return f_int
