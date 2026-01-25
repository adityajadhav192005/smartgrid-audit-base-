#!/usr/bin/env python3
"""Quick test - run just a few timesteps to verify everything works."""
import numpy as np
import random
import torch

# Reproducibility
seed = 42
random.seed(seed)
np.random.seed(seed)
torch.manual_seed(seed)

from pathlib import Path
from smartgrid_mas.config.loader import load_config
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentCriticality, AgentType
from smartgrid_mas.simulation.debug_logger import setup_debug_logging, get_logger
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.environment.grid_env import GridEnvironment, GridEnvConfig
from smartgrid_mas.environment.scenario_engine import ScenarioEngine, ScenarioConfig
from smartgrid_mas.audit.hybrid_scheduler import QLearningAuditScheduler, hybrid_audit_schedule
from smartgrid_mas.audit.audit_ledger import AuditLedger
from smartgrid_mas.audit.audit_executor import execute_audits, AuditExecConfig
from smartgrid_mas.data.cyber_attacks import AttackConfig
from smartgrid_mas.data.synthetic_faults import FaultConfig

setup_debug_logging()
logger = get_logger(__name__)

print("\n" + "="*70)
print("QUICK TEST - 5 TIMESTEPS")
print("="*70 + "\n")

# Load config
cfg = load_config("smartgrid_mas/config/global_config.yaml")
print(f"✅ Config loaded")

# Build agents
n_agents = 20
agents = []
agent_id = 0

def make_agent(agent_type: AgentType, criticality: float):
    global agent_id
    aid = f"{agent_id}"
    agent_id += 1
    return BaseAgent(
        agent_id=aid,
        agent_type=agent_type,
        criticality=AgentCriticality(weight=criticality),
        bx=np.ones(3),
        by=np.ones(2),
        thx=np.ones(3) * 0.1,
        thy=np.ones(2) * 0.1,
    )

for _ in range(int(n_agents * 0.20)):
    agents.append(make_agent(AgentType.GENERATOR, 1.5))
for _ in range(int(n_agents * 0.30)):
    agents.append(make_agent(AgentType.SUBSTATION, 1.2))
for _ in range(int(n_agents * 0.25)):
    agents.append(make_agent(AgentType.PMU, 0.8))
for _ in range(int(n_agents * 0.25)):
    agents.append(make_agent(AgentType.BREAKER, 1.0))

print(f"✅ Built {len(agents)} agents")

# Load LSTM
infer = LSTMInferencer(model_path="smartgrid_mas/data/anomaly_inputs/lstm.pt", input_size=5)
print(f"✅ LSTM loaded")

# Initialize environment
env_cfg = GridEnvConfig(phys_dim=3, cyber_dim=2, seed=seed)
scenario_engine = ScenarioEngine(agents=agents, cfg=ScenarioConfig())
env = GridEnvironment(agents, env_cfg, scenario=scenario_engine)
print(f"✅ Environment initialized")

# Setup components
attack_cfg = AttackConfig(fdi_bias=2.5, fdi_drift=0.05, dos_latency_increase=4.0, dos_integrity_drop=0.8, mitm_noise_std=1.0)
fault_cfg = FaultConfig(sag_pct=0.45, surge_pct=0.35, overcurrent_pct=0.70, freq_delta=1.5)

scheduler = QLearningAuditScheduler(gamma=0.9, alpha=0.1, epsilon=1.0)
ledger = AuditLedger()

print(f"✅ Scheduler and ledger initialized")

# Run 5 timesteps
print("\nRunning 5 timesteps:\n")
print(f"{'t':>2} | {'Obs':>20} | {'Anomalies':>10} | {'Audits':>6} | {'Cost':>6}")
print("-" * 70)

total_cost = 0

for t in range(5):
    # Step environment
    obs, truth = env.step(t)
    
    # Run scheduler
    actions, rewards, freqs, state_before = hybrid_audit_schedule(
        agents=agents,
        scheduler=scheduler,
        risk_threshold=0.5,
        f_min=1,
        f_max=5,
        max_audits_per_cycle=5,
        audit_cost_per_audit=1.0,
        operational_cost=100.0,
        budget_ratio=0.10,
        C_a=1.0,
        C_f=10.0,
        grad_lr=0.01,
    )
    
    # Get LSTM predictions
    anomalies = 0
    for agent in agents:
        X_combined = np.concatenate([agent.bx, agent.by], axis=0).reshape(1, -1)
        try:
            score = infer.predict_proba(X_combined)
            if score > 0.5:
                anomalies += 1
                agent.is_anomalous = True
            else:
                agent.is_anomalous = False
        except:
            agent.is_anomalous = False
    
    # Execute audits
    audit_cfg = AuditExecConfig(f_max=5, max_audits_per_timestep=5, audit_cost_per_audit=1.0)
    audited_ids = execute_audits(agents=agents, t=t, ledger=ledger, cfg=audit_cfg, remaining_budget=1000.0)
    
    cost = len(audited_ids) * 1.0
    total_cost += cost
    
    obs_str = f"{obs.shape}"
    print(f"{t+1:>2} | {obs_str:>20} | {anomalies:>10} | {len(audited_ids):>6} | ${cost:>5.1f}")

print("-" * 70)
print(f"\n✅ Test completed successfully!")
print(f"   Total audits: {len(ledger.events)}")
print(f"   Total cost: ${total_cost:.2f}")
