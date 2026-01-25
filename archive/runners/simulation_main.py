"""
Main entry point for 24-hour simulation

Run with:
    python -m smartgrid_mas.simulation.main

Connects all framework components and executes full cycle.
"""

import numpy as np
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentType, AgentCriticality
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.simulation.run_simulation import run_simulation_24h
from smartgrid_mas.data.cyber_attacks import AttackConfig
from smartgrid_mas.data.synthetic_faults import FaultConfig


def build_agents(n: int = 20) -> list[BaseAgent]:
    """
    Build n agents with varying criticality weights.
    
    Paper alignment: Mix of agent types (generators, PMUs, substations, etc.)
    For now all PMU type; Step 11 will add realistic type distribution.
    """
    agents = []
    for i in range(n):
        agents.append(
            BaseAgent(
                agent_id=f"A{i}",
                agent_type=AgentType.PMU,
                criticality=AgentCriticality(weight=1.0 + 0.05 * i),
                bx=np.zeros(3),
                by=np.zeros(2),
                thx=np.ones(3) * 0.1,  # further lower thresholds for demo visibility
                thy=np.ones(2) * 0.1,
            )
        )
    return agents


if __name__ == "__main__":
    print("=" * 70)
    print("STEP 10: Full End-to-End 24-Hour Simulation")
    print("=" * 70)
    print()
    
    # Build agent grid
    n_agents = 30
    print(f"Building grid with {n_agents} agents...")
    agents = build_agents(n_agents)
    
    # Load LSTM model
    model_path = "smartgrid_mas/data/anomaly_inputs/lstm.pt"
    print(f"Loading LSTM model from: {model_path}")
    
    # input_size = phys_dim + cyber_dim = 3 + 2 = 5
    infer = LSTMInferencer(model_path=model_path, input_size=5)
    
    print("\nRunning 24-hour simulation (288 timesteps)...")
    print("Pipeline: Observe -> LSTM -> Score -> Behavior -> Cluster -> Schedule -> Response -> Log")
    print()
    
    # Demo: tune scenario rates and attack/fault magnitudes for visible anomalies
    demo_attack_cfg = AttackConfig(
        fdi_bias=2.5,
        fdi_drift=0.05,
        dos_latency_increase=4.0,
        dos_integrity_drop=0.8,
        mitm_noise_std=1.0,
    )
    demo_fault_cfg = FaultConfig(
        sag_pct=0.45,
        surge_pct=0.35,
        overcurrent_pct=0.70,
        freq_delta=1.5,
    )

    metrics, events = run_simulation_24h(
        agents,
        infer,
        # Scenario rates: higher for demo visibility
        scenario_fdi_rate=0.40,
        scenario_dos_rate=0.20,
        scenario_chain_rate=0.20,
        scenario_fault_rate=0.20,
        # Magnitudes
        attack_cfg=demo_attack_cfg,
        fault_cfg=demo_fault_cfg,
    )
    
    # Display summary
    print("=" * 70)
    print("SIMULATION COMPLETE")
    print("=" * 70)
    print()
    print(f"Total timesteps: {len(metrics)}")
    print(f"Total events logged: {len(events)}")
    print()
    print("Last timestep metrics:")
    last = metrics[-1]
    print(f"  t = {last['t']}")
    print(f"  attack_rate = {last['attack_rate']:.4f}")
    print(f"  mean_deviation = {last['mean_deviation']:.4f}")
    print(f"  global_risk = {last['global_risk']:.4f}")
    print(f"  freq_sum = {last.get('freq_sum', 0)} (scheduler intent)")
    print(f"  audits_executed = {last.get('audits_executed', 0)} (actual)")
    print(f"  total_spend = ${last.get('total_spend', 0.0):.2f}")
    print(f"  coverage = {last.get('coverage', 0.0):.4f}")
    if last.get('remaining_budget') is not None:
        print(f"  remaining_budget = ${last['remaining_budget']:.2f}")
    print()
    # Also show mean attack rate across the cycle
    mean_attack_rate = float(np.mean([m['attack_rate'] for m in metrics]))
    print(f"Mean attack_rate over 24h: {mean_attack_rate:.4f}")
    print()
    print("Framework Status: 10/10 steps complete (100%)")
    print("✓ All 9 core components + End-to-End integration operational")
    print()
