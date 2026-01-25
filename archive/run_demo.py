"""Fast demonstration run - 1 hour of simulation instead of 24.

This shows the framework working end-to-end in ~2-3 minutes.
"""
import sys
import random
import torch
import numpy as np
from pathlib import Path

# Setup reproducibility
seed = 42
random.seed(seed)
np.random.seed(seed)
torch.manual_seed(seed)

from smartgrid_mas.config.loader import load_config
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentCriticality, AgentType
from smartgrid_mas.simulation.debug_logger import setup_debug_logging, get_logger

setup_debug_logging()
logger = get_logger(__name__)

print("\n" + "="*70)
print("SMART GRID AUDIT FRAMEWORK - FAST DEMONSTRATION RUN")
print("="*70 + "\n")

# Load config
print("[1] Loading configuration...")
cfg = load_config("smartgrid_mas/config/global_config.yaml")
logger.info(f"Config loaded with seed={seed}")

# Build agents
print("[2] Building agent pool...")
n_agents = 50  # Smaller for demo
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

print(f"   ✅ Built {len(agents)} agents")

# Load LSTM
print("[3] Loading LSTM model...")
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
model_path = cfg.get("experiment", {}).get("lstm_model_path", 
                                            "smartgrid_mas/data/anomaly_inputs/lstm.pt")
infer = LSTMInferencer(model_path=model_path, input_size=5)
print(f"   ✅ LSTM loaded")

# Initialize components
print("[4] Initializing simulation components...")
from smartgrid_mas.environment.grid_env import GridEnvironment, GridEnvConfig, ScenarioEngine
from smartgrid_mas.environment.scenario_engine import ScenarioConfig
from smartgrid_mas.audit.hybrid_scheduler import QLearningAuditScheduler
from smartgrid_mas.audit.audit_ledger import AuditLedger

env_cfg = GridEnvConfig(phys_dim=3, cyber_dim=2, seed=seed)
scenario_engine = ScenarioEngine(agents=agents, cfg=ScenarioConfig())
env = GridEnvironment(agents, env_cfg, scenario=scenario_engine)
scheduler = QLearningAuditScheduler(gamma=0.9, alpha=0.1, epsilon=1.0)
ledger = AuditLedger()
print(f"   ✅ Environment, scenario engine, scheduler initialized")

# Run 1 hour simulation (12 timesteps at 5 min each)
print("[5] Running 1-hour simulation (demo)...")
print("   Timestep | Audits | Coverage | Attack Rate")
print("   " + "-"*45)

n_steps = 12  # 1 hour
total_audits = 0

try:
    for t in range(n_steps):
        # Step environment
        obs, truth = env.step(t)
        
        # Run scheduler
        actions, rewards, freqs, state_before = __import__('smartgrid_mas.audit.hybrid_scheduler', 
            fromlist=['hybrid_audit_schedule']).hybrid_audit_schedule(
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
        
        # Execute audits
        from smartgrid_mas.audit.audit_executor import execute_audits, AuditExecConfig
        audit_cfg = AuditExecConfig(f_max=5, max_audits_per_timestep=5, audit_cost_per_audit=1.0)
        audited_ids = execute_audits(
            agents=agents,
            t=t,
            ledger=ledger,
            cfg=audit_cfg,
            remaining_budget=1000.0
        )
        total_audits += len(audited_ids)
        
        # Compute outcomes
        from smartgrid_mas.audit.audit_validator import evaluate_audit_outcome
        outcomes = {}
        for aid in audited_ids:
            agent = agents[int(aid)]
            outcome = evaluate_audit_outcome(agent, truth.get(str(aid), 0))
            outcomes[aid] = outcome
        
        # Post-audit RL update
        if outcomes:
            from smartgrid_mas.audit.schedule_step import rl_post_audit_update
            rl_post_audit_update(scheduler, state_before, actions, outcomes)
        
        # Print progress
        coverage = ledger.coverage(len(agents))
        attack_rate = sum(1 for val in truth.values() if val == 1) / len(agents)
        print(f"   {t+1:8d} | {len(audited_ids):6d} | {coverage:7.1%} | {attack_rate:10.1%}")
    
    print()
    print("   " + "="*45)
    print(f"\n✅ DEMO RUN SUCCESSFUL!")
    print(f"\nSummary:")
    print(f"   Duration: 1 hour (12 timesteps)")
    print(f"   Total audits executed: {total_audits}")
    print(f"   Final audit coverage: {ledger.coverage(len(agents)):.1%}")
    print(f"   Total audit spend: ${ledger.total_spend:.2f}")
    print(f"\n🚀 Framework is fully operational!")
    print("\nTo run 24-hour full simulation:")
    print("   python -m smartgrid_mas.simulation.experiment_runner")
    print()
    
except Exception as e:
    print(f"\n❌ Error during simulation: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
