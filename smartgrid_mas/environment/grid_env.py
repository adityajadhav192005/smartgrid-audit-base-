"""
GridEnvironment - Synthetic smart grid data generator

Generates realistic observations (physical + cyber metrics) with controllable anomalies.
Paper-aligned structure for 24-hour simulation cycles.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Tuple, List
import numpy as np

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.environment.scenario_engine import ScenarioEngine
from smartgrid_mas.data.cyber_attacks import AttackInjector, AttackType, AttackConfig
from smartgrid_mas.data.synthetic_faults import apply_fault, PhysIndexMap, FaultType, FaultConfig
from smartgrid_mas.response.mitigation_actions import ensure_mitigation_status


@dataclass
class GridEnvConfig:
    """Configuration for grid environment data generation"""
    seed: int = 42
    phys_dim: int = 3   # e.g., V, I, f (paper example style)
    cyber_dim: int = 4  # Enhanced: latency, packet_loss, integrity, comm_frequency
    noise_std: float = 0.05
    anomaly_scale: float = 3.0
    # Cyber metric baselines (paper Y matrix components)
    base_latency_ms: float = 10.0  # Communication latency (milliseconds)
    base_packet_loss: float = 0.01  # Packet loss rate (fraction)
    base_integrity: float = 0.99  # Communication integrity score
    base_comm_freq_hz: float = 100.0  # Communication frequency (Hz)


class GridEnvironment:
    """
    Synthetic smart grid environment generating observations for agents.
    
    Produces baseline signals (slow sine wave) with noise, and supports
    injecting anomalies per agent for testing detection/response mechanisms.
    
    Paper alignment:
    - Physical metrics: X(t) - voltage, current, frequency
    - Cyber metrics: Y(t) - latency, communication integrity
    - 24-hour cycles with 5-minute timesteps (288 steps)
    """
    
    def __init__(
        self,
        agents: List[BaseAgent],
        cfg: GridEnvConfig = GridEnvConfig(),
        scenario: ScenarioEngine | None = None,
        attack_cfg: AttackConfig | None = None,
        fault_cfg: FaultConfig | None = None,
    ):
        self.agents = agents
        self.cfg = cfg
        self.rng = np.random.default_rng(cfg.seed)
        # per-agent anomaly switch (legacy manual toggle)
        self.anomaly_on: Dict[str, bool] = {a.agent_id: False for a in agents}
        # scenario engine for paper-grade attacks/faults
        self.scenario = scenario
        # injectors/mappings
        self.attack_injector = AttackInjector(attack_cfg or AttackConfig())
        self.phys_map = PhysIndexMap()
        self.fault_cfg = fault_cfg or FaultConfig()
        # Track last step's attacks and faults for downstream per-attack metrics
        self.last_attacks: Dict[str, AttackType] = {}
        self.last_faults: Dict[str, FaultType] = {}
    
    def set_anomaly(self, agent_id: str, on: bool) -> None:
        """Enable/disable anomaly injection for specific agent"""
        self.anomaly_on[agent_id] = bool(on)
    
    def step(self, t: int) -> Tuple[Dict[str, Tuple[np.ndarray, np.ndarray]], Dict[str, int]]:
        """
        Generate observations for all agents at timestep t.
        
        Args:
            t: Current timestep (0-based, paper uses 288 steps for 24h with 5-min intervals)
        
        Returns:
            Tuple of:
            - obs: Dict mapping agent_id -> (x_phys, y_cyber) observation tuples
            - truth: Dict mapping agent_id -> ground truth label (1 if attacked/faulty, 0 otherwise)
        """
        obs: Dict[str, Tuple[np.ndarray, np.ndarray]] = {}
        truth: Dict[str, int] = {}
        
        # obtain scenario-driven attacks/faults, if any
        attacks = self.scenario.attacks_at(t) if self.scenario else {}
        faults = self.scenario.faults_at(t) if self.scenario else {}
        # Store for external per-attack evaluation
        self.last_attacks = attacks.copy() if attacks else {}
        self.last_faults = faults.copy() if faults else {}

        for a in self.agents:
            # Ensure mitigation status exists
            ensure_mitigation_status(a)
            m = getattr(a, "mitigation")

            # Baseline signal: slow sine + noise (24h cycle with 288 steps)
            base = 1.0 + 0.1 * np.sin(2 * np.pi * (t / 288.0))
            
            x = base + self.rng.normal(0, self.cfg.noise_std, size=self.cfg.phys_dim)
            
            # Enhanced Y matrix: [latency, packet_loss, integrity, comm_frequency]
            y = np.array([
                self.cfg.base_latency_ms * (1 + 0.1 * np.sin(2 * np.pi * (t / 288.0))) + self.rng.normal(0, self.cfg.noise_std * self.cfg.base_latency_ms),
                self.cfg.base_packet_loss * (1 + 0.05 * np.sin(2 * np.pi * (t / 288.0))) + self.rng.normal(0, self.cfg.noise_std * self.cfg.base_packet_loss),
                self.cfg.base_integrity + self.rng.normal(0, self.cfg.noise_std * 0.01),
                self.cfg.base_comm_freq_hz * (1 + 0.05 * np.sin(2 * np.pi * (t / 288.0))) + self.rng.normal(0, self.cfg.noise_std * self.cfg.base_comm_freq_hz),
            ])
            
            # If agent is isolated/shutdown, dampen metrics and suppress attacks/faults
            if m is not None and (m.shutdown or (not m.active)):
                attacks[a.agent_id] = AttackType.NONE
                faults[a.agent_id] = FaultType.NONE
                # Isolation: reduce variance and pull toward baseline
                x = 0.5 * x + 0.5 * np.ones_like(x)
                y = 0.5 * y + 0.5 * np.array([
                    self.cfg.base_latency_ms,
                    self.cfg.base_packet_loss,
                    self.cfg.base_integrity,
                    self.cfg.base_comm_freq_hz,
                ])
                # Shutdown: zero out deviations completely
                if m.shutdown:
                    x = np.ones_like(x)
                    y = np.array([
                        self.cfg.base_latency_ms,
                        self.cfg.base_packet_loss,
                        self.cfg.base_integrity,
                        self.cfg.base_comm_freq_hz,
                    ])

            # Apply physical faults (scenario-driven)
            f = faults.get(a.agent_id, FaultType.NONE)
            if f != FaultType.NONE:
                x = apply_fault(x, f, idx=self.phys_map, cfg=self.fault_cfg)

            # Apply cyber attacks (scenario-driven)
            atk = attacks.get(a.agent_id, AttackType.NONE)
            if atk == AttackType.FDI:
                x = self.attack_injector.apply_fdi(x, t)
            elif atk == AttackType.DOS:
                y = self.attack_injector.apply_dos(y)
            elif atk == AttackType.MITM:
                x, y = self.attack_injector.apply_mitm(x, y)

            # Legacy manual anomaly toggle (kept for tests/backward compat)
            if self.anomaly_on.get(a.agent_id, False):
                x = x + self.cfg.anomaly_scale * self.rng.normal(0, 1.0, size=self.cfg.phys_dim)
                y = y + self.cfg.anomaly_scale * self.rng.normal(0, 1.0, size=self.cfg.cyber_dim)
            
            obs[a.agent_id] = (x.astype(float), y.astype(float))
            
            # Ground truth label (1 if attack or fault present, 0 otherwise)
            atk = attacks.get(a.agent_id, AttackType.NONE)
            flt = faults.get(a.agent_id, FaultType.NONE)
            truth[a.agent_id] = 1 if (atk != AttackType.NONE or flt != FaultType.NONE) else 0
        
        return obs, truth
