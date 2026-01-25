"""
Apply gradient-based optimization to all agents in the grid.

For each agent:
    1. Extract risk score R_i from last state
    2. Compute gradient of cost w.r.t. frequency
    3. Update frequency using gradient descent
    4. Apply bounds [f_min, f_max]
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.audit.gradient_update import gradient_update_frequency


@dataclass
class GradientTracker:
    """
    Track convergence of gradient descent optimization.
    
    Monitors gradient magnitude and iteration count to detect
    when gradient-based frequency updates have stabilized.
    """
    iteration_count: int = 0
    converged: bool = False
    convergence_threshold: float = 1e-3  # Min gradient magnitude for convergence
    convergence_window: int = 50  # Check convergence over this many steps
    recent_gradients: List[float] = field(default_factory=list)
    
    def update(self, gradient_magnitude: float) -> None:
        """Track gradient magnitude and check convergence."""
        self.iteration_count += 1
        self.recent_gradients.append(gradient_magnitude)
        
        # Keep sliding window
        if len(self.recent_gradients) > self.convergence_window:
            self.recent_gradients.pop(0)
        
        # Check convergence: all recent gradients below threshold
        if len(self.recent_gradients) >= self.convergence_window:
            max_recent_grad = max(self.recent_gradients)
            if max_recent_grad < self.convergence_threshold:
                self.converged = True


def gradient_opt_step(
    agents: List[BaseAgent],
    C_a: float,
    C_f: float,
    lr: float = 0.01,  # Paper specification
    f_min: int = 1,
    f_max: int = 5,
    tracker: GradientTracker | None = None,
) -> Dict[str, int]:
    """
    Perform gradient optimization step for all agents.
    
    For each agent:
        - Use last_state.risk_score as R_i
        - Update audit_frequency using gradient descent
        - Store updated frequency in agent
    
    Args:
        agents: List of BaseAgent instances
        C_a: Cost per audit
        C_f: Failure/attack cost coefficient
        lr: Learning rate (default 0.01 per paper)
        f_min: Minimum audit frequency
        f_max: Maximum audit frequency
        tracker: Optional GradientTracker for convergence monitoring
    
    Returns:
        Dictionary mapping agent_id -> updated frequency
    
    Example:
        >>> agents = [agent1, agent2, agent3]
        >>> tracker = GradientTracker()
        >>> freqs = gradient_opt_step(agents, C_a=1.0, C_f=10.0, tracker=tracker)
        >>> print(freqs)
        {'A0': 2, 'A1': 3, 'A2': 1}
    """
    freqs: Dict[str, int] = {}
    total_gradient_magnitude = 0.0
    count = 0
    
    for agent in agents:
        # Skip agents without state history
        if agent.last_state is None:
            continue
        
        # Extract risk score from last observation
        R_i = float(agent.last_state.risk_score)
        f_old = agent.audit_frequency
        
        # Perform gradient descent update
        f_new = gradient_update_frequency(
            f_i=f_old,
            R_i=R_i,
            C_a=C_a,
            C_f=C_f,
            lr=lr,
            f_min=f_min,
            f_max=f_max,
        )
        
        # Track gradient magnitude (approximated by frequency change)
        gradient_magnitude = abs(f_new - f_old)
        total_gradient_magnitude += gradient_magnitude
        count += 1
        
        # Update agent's audit frequency
        agent.set_audit_frequency(f_new, f_min=f_min, f_max=f_max)
        
        # Sync state record
        if agent.last_state is not None:
            agent.last_state.audit_frequency = agent.audit_frequency
        
        # Record updated frequency
        freqs[agent.agent_id] = agent.audit_frequency
    
    # Update convergence tracker if provided
    if tracker is not None and count > 0:
        avg_gradient = total_gradient_magnitude / count
        tracker.update(avg_gradient)
    
    return freqs
