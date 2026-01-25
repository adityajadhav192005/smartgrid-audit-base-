from __future__ import annotations

from dataclasses import dataclass, field
from typing import Deque, Dict, Any, Optional
from collections import deque
import numpy as np

from smartgrid_mas.agents.types import AgentType, AgentCriticality
from smartgrid_mas.agents.state import AgentState

@dataclass
class BaseAgent:
    """
    Paper-faithful agent container:
    - Baselines Bx, By (vectors)
    - Thresholds Thx, Thy (vectors)
    - Criticality weight w_i
    - Risk score R_i(t) computed from flags + weights
    - Audit frequency f_i(t) updated by RL + gradient module
    - History buffers for X and Y
    """
    agent_id: str
    agent_type: AgentType
    criticality: AgentCriticality

    # Baselines
    bx: np.ndarray
    by: np.ndarray

    # Thresholds
    thx: np.ndarray
    thy: np.ndarray

    # Runtime scalars
    risk_score: float = 0.0
    audit_frequency: int = 1

    # History
    x_history: Deque[np.ndarray] = field(default_factory=lambda: deque(maxlen=512))
    y_history: Deque[np.ndarray] = field(default_factory=lambda: deque(maxlen=512))

    # Latest computed state snapshot
    last_state: Optional[AgentState] = None

    def observe(self, x_phys: np.ndarray, y_cyber: np.ndarray) -> AgentState:
        """
        Store observation and return a new AgentState.
        Downstream modules will fill anomaly_prob, deviation_score, etc.
        """
        x_phys = np.asarray(x_phys, dtype=float)
        y_cyber = np.asarray(y_cyber, dtype=float)

        self.x_history.append(x_phys)
        self.y_history.append(y_cyber)

        st = AgentState(
            x_phys=x_phys,
            y_cyber=y_cyber,
            risk_score=self.risk_score,
            audit_frequency=self.audit_frequency,
        )
        self.last_state = st
        return st

    def get_history_window(self, window: int) -> Dict[str, np.ndarray]:
        """
        Returns last `window` timesteps for X and Y for LSTM input.
        Shape: (window, dim)
        """
        if window <= 0:
            raise ValueError("window must be > 0")

        x = list(self.x_history)[-window:]
        y = list(self.y_history)[-window:]
        if len(x) < window or len(y) < window:
            # pad with first available (or zeros) to keep shapes stable
            if len(x) == 0:
                raise RuntimeError("No history available yet for X.")
            if len(y) == 0:
                raise RuntimeError("No history available yet for Y.")
            while len(x) < window:
                x.insert(0, x[0])
            while len(y) < window:
                y.insert(0, y[0])

        return {
            "X": np.stack(x, axis=0),
            "Y": np.stack(y, axis=0),
        }

    def set_audit_frequency(self, f: int, f_min: int = 1, f_max: int = 5) -> None:
        if not isinstance(f, int):
            raise TypeError("audit frequency must be int")
        self.audit_frequency = int(max(f_min, min(f_max, f)))

    def update_risk_score_from_flag(self, anomaly_flag: int) -> float:
        """
        Paper risk score form (global) is sum(w_i * a_i),
        but per-agent we keep component term w_i * a_i.
        """
        a = 1 if anomaly_flag else 0
        self.risk_score = float(self.criticality.weight * a)
        return self.risk_score

    def export_debug(self) -> Dict[str, Any]:
        return {
            "id": self.agent_id,
            "type": self.agent_type.value,
            "w": self.criticality.weight,
            "risk_score": self.risk_score,
            "audit_frequency": self.audit_frequency,
            "bx": self.bx.tolist(),
            "by": self.by.tolist(),
            "thx": self.thx.tolist(),
            "thy": self.thy.tolist(),
        }
