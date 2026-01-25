"""Configuration Management Module

Centralizes all configuration parameters for the smart grid audit framework.
Provides type-safe access to simulation parameters, RL hyperparameters,
and evaluation settings.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, Optional
import json


@dataclass
class SimulationConfig:
    """Simulation parameters"""
    n_agents: int = 100
    n_timesteps: int = 288
    attack_rate: float = 0.15
    seed: int = 42
    
    # Agent distribution
    generator_ratio: float = 0.20
    substation_ratio: float = 0.30
    pmu_ratio: float = 0.50
    
    # Physical constraints
    voltage_min: float = 0.95
    voltage_max: float = 1.05
    frequency_nominal: float = 50.0
    frequency_tolerance: float = 0.5


@dataclass
class RLConfig:
    """Reinforcement Learning hyperparameters"""
    learning_rate: float = 0.01
    discount_factor: float = 0.9
    exploration_rate: float = 0.3
    exploration_decay: float = 0.995
    min_exploration_rate: float = 0.01
    
    # Training
    max_episodes: int = 200
    convergence_window: int = 10
    convergence_threshold: float = 0.01


@dataclass
class AuditConfig:
    """Audit scheduling parameters"""
    max_audits_per_cycle: int = 5
    audit_cost_per_agent: float = 100.0
    failure_cost_coefficient: float = 10.0
    
    # Frequency constraints
    min_audit_frequency: float = 0.01
    max_audit_frequency: float = 0.20


@dataclass
class AnomalyConfig:
    """Anomaly detection parameters"""
    lstm_hidden_size: int = 64
    lstm_num_layers: int = 2
    sequence_length: int = 10
    anomaly_threshold: float = 0.5
    
    # Adaptive baseline parameters
    alpha_high: float = 0.5  # Learning rate during anomalies
    alpha_low: float = 0.01   # Learning rate during stable periods
    beta_stable: float = 0.05 # Threshold adjustment (stable grids)
    beta_dynamic: float = 0.5  # Threshold adjustment (dynamic grids)


@dataclass
class EvaluationConfig:
    """Evaluation and metrics parameters"""
    statistical_tests: bool = True
    per_attack_metrics: bool = True
    cross_layer_analysis: bool = True
    
    # Output paths
    output_dir: Path = field(default_factory=lambda: Path("logs"))
    save_csv: bool = True
    save_json: bool = True


@dataclass
class Config:
    """Main configuration container"""
    simulation: SimulationConfig = field(default_factory=SimulationConfig)
    rl: RLConfig = field(default_factory=RLConfig)
    audit: AuditConfig = field(default_factory=AuditConfig)
    anomaly: AnomalyConfig = field(default_factory=AnomalyConfig)
    evaluation: EvaluationConfig = field(default_factory=EvaluationConfig)


class ConfigManager:
    """Manages configuration loading, validation, and access"""
    
    def __init__(self, config_path: Optional[Path] = None):
        """Initialize configuration manager
        
        Args:
            config_path: Optional path to JSON config file. If None, uses defaults.
        """
        self.config = Config()
        if config_path and config_path.exists():
            self.load_from_file(config_path)
    
    def load_from_file(self, path: Path) -> None:
        """Load configuration from JSON file"""
        with open(path, 'r') as f:
            data = json.load(f)
        
        if 'simulation' in data:
            self.config.simulation = SimulationConfig(**data['simulation'])
        if 'rl' in data:
            self.config.rl = RLConfig(**data['rl'])
        if 'audit' in data:
            self.config.audit = AuditConfig(**data['audit'])
        if 'anomaly' in data:
            self.config.anomaly = AnomalyConfig(**data['anomaly'])
        if 'evaluation' in data:
            eval_data = data['evaluation']
            if 'output_dir' in eval_data:
                eval_data['output_dir'] = Path(eval_data['output_dir'])
            self.config.evaluation = EvaluationConfig(**eval_data)
    
    def save_to_file(self, path: Path) -> None:
        """Save current configuration to JSON file"""
        data = {
            'simulation': self.config.simulation.__dict__,
            'rl': self.config.rl.__dict__,
            'audit': self.config.audit.__dict__,
            'anomaly': self.config.anomaly.__dict__,
            'evaluation': {
                **self.config.evaluation.__dict__,
                'output_dir': str(self.config.evaluation.output_dir)
            }
        }
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
    
    def validate(self) -> None:
        """Validate configuration parameters"""
        # Simulation validation
        assert self.config.simulation.n_agents > 0, "n_agents must be positive"
        assert self.config.simulation.n_timesteps > 0, "n_timesteps must be positive"
        assert 0 <= self.config.simulation.attack_rate <= 1, "attack_rate must be in [0, 1]"
        
        # RL validation
        assert 0 < self.config.rl.learning_rate <= 1, "learning_rate must be in (0, 1]"
        assert 0 <= self.config.rl.discount_factor <= 1, "discount_factor must be in [0, 1]"
        
        # Audit validation
        assert self.config.audit.max_audits_per_cycle > 0, "max_audits_per_cycle must be positive"
        assert self.config.audit.min_audit_frequency < self.config.audit.max_audit_frequency
    
    def get_simulation_params(self) -> Dict[str, Any]:
        """Get simulation parameters as dictionary"""
        return {
            'N': self.config.simulation.n_agents,
            'T': self.config.simulation.n_timesteps,
            'attack_rate': self.config.simulation.attack_rate,
            'seed': self.config.simulation.seed,
        }
    
    def get_rl_params(self) -> Dict[str, Any]:
        """Get RL parameters as dictionary"""
        return {
            'alpha': self.config.rl.learning_rate,
            'gamma': self.config.rl.discount_factor,
            'epsilon': self.config.rl.exploration_rate,
        }
    
    def __repr__(self) -> str:
        return (
            f"ConfigManager(\n"
            f"  Simulation: {self.config.simulation.n_agents} agents, "
            f"{self.config.simulation.n_timesteps} timesteps\n"
            f"  RL: α={self.config.rl.learning_rate}, γ={self.config.rl.discount_factor}\n"
            f"  Audit: max {self.config.audit.max_audits_per_cycle} audits/cycle\n"
            f")"
        )
