from __future__ import annotations
import os
from pathlib import Path
from typing import List, Dict, Any
import numpy as np
import yaml

from smartgrid_mas.config.loader import load_config
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentCriticality, AgentType
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.simulation.run_simulation import run_simulation_24h
from smartgrid_mas.simulation.run_baseline_fixed import run_fixed_audit_24h
from smartgrid_mas.simulation.eval_suite import build_summary
from smartgrid_mas.data.cyber_attacks import AttackConfig
from smartgrid_mas.data.synthetic_faults import FaultConfig


def build_mixed_agents(n: int, seed: int = 42) -> List[BaseAgent]:
    """
    Build agent pool with paper-style distribution.
    
    Paper distribution:
    - 20% generators (high criticality)
    - 30% substations (medium criticality)
    - 50% PMUs/breakers (low-medium criticality)
    
    Args:
        n: Total number of agents
        seed: Random seed for reproducibility
        
    Returns:
        List of BaseAgent instances with configured baselines/thresholds
    """
    rng = np.random.default_rng(seed)
    agents: List[BaseAgent] = []

    # Compute counts
    n_gen = int(round(0.20 * n))
    n_sub = int(round(0.30 * n))
    n_rem = n - n_gen - n_sub
    n_pmu = n_rem // 2
    n_brk = n_rem - n_pmu

    phys_dim = 3
    cyber_dim = 2

    # Criticality weights (higher for critical agents)
    # Paper: F_w = criticality weight vector
    gen_weight = 1.5
    sub_weight = 1.2
    pmu_weight = 0.8
    brk_weight = 1.0

    def make_agent(agent_id: str, agent_type: AgentType, criticality: float) -> BaseAgent:
        """Factory for BaseAgent with paper-aligned parameters."""
        return BaseAgent(
            agent_id=agent_id,
            agent_type=agent_type,
            criticality=AgentCriticality(weight=criticality),
            bx=np.ones(phys_dim),      # Baseline physical metrics
            by=np.ones(cyber_dim),      # Baseline cyber metrics
            thx=np.ones(phys_dim) * 0.1,  # Thresholds physical
            thy=np.ones(cyber_dim) * 0.1, # Thresholds cyber
        )

    # Generators (highest criticality)
    for i in range(n_gen):
        w = float(gen_weight + 0.5 * rng.random())
        agents.append(make_agent(f"G{i}", AgentType.GENERATOR, w))

    # Substations (medium criticality)
    for i in range(n_sub):
        w = float(sub_weight + 0.4 * rng.random())
        agents.append(make_agent(f"S{i}", AgentType.SUBSTATION, w))

    # PMUs (lower criticality)
    for i in range(n_pmu):
        w = float(pmu_weight + 0.3 * rng.random())
        agents.append(make_agent(f"P{i}", AgentType.PMU, w))

    # Breakers (medium-low criticality)
    for i in range(n_brk):
        w = float(brk_weight + 0.3 * rng.random())
        agents.append(make_agent(f"B{i}", AgentType.BREAKER, w))

    return agents


def export_csv(records: List[Dict[str, Any]], path: str) -> None:
    """
    Export records to CSV file.
    
    Args:
        records: List of dict records
        path: Output CSV path
    """
    try:
        import pandas as pd
    except ImportError:
        print(f"Warning: pandas not available, skipping CSV export to {path}")
        return

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(records)
    df.to_csv(path, index=False)
    print(f"[Export] {path} ({len(records)} records)")


def print_summary(summary: Dict[str, float]) -> None:
    """Print evaluation summary in paper-ready format."""
    print()
    print("=" * 70)
    print("EXPERIMENT SUMMARY")
    print("=" * 70)
    print()
    print("Attack Rate Reduction:")
    print(f"  Dynamic:  {summary.get('dynamic_mean_attack_rate', 0.0):.4f}")
    print(f"  Baseline: {summary.get('baseline_mean_attack_rate', 0.0):.4f}")
    print(f"  Reduction: {summary.get('attack_rate_reduction', 0.0):.2%}")
    print()
    print("Audit Cost Efficiency:")
    print(f"  Dynamic:  ${summary.get('dynamic_total_audit_cost', 0.0):.2f}")
    print(f"  Baseline: ${summary.get('baseline_total_audit_cost', 0.0):.2f}")
    print(f"  Savings: {summary.get('cost_efficiency', 0.0):.2%}")
    print()
    print("=" * 70)


def main():
    """
    Main experiment runner.
    
    Pipeline:
    1. Load configuration from YAML
    2. Set random seeds for reproducibility
    3. Build agent pools (dynamic + baseline)
    4. Load LSTM model
    5. Run dynamic scheduler (RL + Gradient + Constraints)
    6. Run fixed baseline (f=1)
    7. Export metrics and events to CSV
    8. Print summary statistics
    """
    import random
    import torch
    from smartgrid_mas.simulation.debug_logger import setup_debug_logging, get_logger
    
    # Setup debug logging
    setup_debug_logging()
    logger = get_logger(__name__)
    
    # --- Configuration Loading ---
    config_path = "smartgrid_mas/config/global_config.yaml"
    if not Path(config_path).exists():
        print(f"ERROR: Config not found at {config_path}")
        return

    cfg = load_config(config_path)
    print(f"[Config] Loaded from {config_path}")
    print()

    # --- Random Seed Setup ---
    seed = int(cfg["simulation"]["seed"])
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    logger.info(f"All random seeds set to {seed}")
    print(f"[Seed] Set to {seed} for reproducibility")
    print()

    # --- Agent Building ---
    n_agents = int(cfg.get("experiment", {}).get("n_agents", 100))
    print(f"[Agents] Building {n_agents} agents...")
    agents_dyn = build_mixed_agents(n_agents, seed=seed)
    agents_base = build_mixed_agents(n_agents, seed=seed)
    print(f"  Dynamic pool: {len(agents_dyn)} agents")
    print(f"  Baseline pool: {len(agents_base)} agents")
    print()

    # --- LSTM Model Loading ---
    model_path = cfg.get("experiment", {}).get("lstm_model_path", 
                                                "smartgrid_mas/data/anomaly_inputs/lstm.pt")
    input_size = 5  # phys_dim(3) + cyber_dim(2)
    print(f"[LSTM] Loading from {model_path}...")
    try:
        infer = LSTMInferencer(model_path=model_path, input_size=input_size)
        print(f"  Model loaded successfully")
    except Exception as e:
        print(f"  Warning: LSTM load failed ({e}), using mock inferencer")
        class MockLSTMInferencer(LSTMInferencer):
            def __init__(self):
                pass
            def predict_proba(self, window_feat):
                return 0.0
        infer = MockLSTMInferencer()
    print()

    # --- Attack/Fault Configuration ---
    # Demo configuration: higher rates for visibility
    attack_cfg = AttackConfig(
        fdi_bias=2.5,
        fdi_drift=0.05,
        dos_latency_increase=4.0,
        dos_integrity_drop=0.8,
        mitm_noise_std=1.0,
    )
    fault_cfg = FaultConfig(
        sag_pct=0.45,
        surge_pct=0.35,
        overcurrent_pct=0.70,
        freq_delta=1.5,
    )

    # --- Dynamic Run (RL + Gradient + Constraints + Outcome Learning) ---
    print("=" * 70)
    print("DYNAMIC RUN (RL + Gradient + Audit Events + Outcome Learning)")
    print("=" * 70)
    dyn_metrics, dyn_events = run_simulation_24h(
        agents=agents_dyn,
        lstm_infer=infer,
        timestep_minutes=int(cfg["simulation"]["timestep_minutes"]),
        cycle_hours=int(cfg["simulation"]["cycle_hours"]),
        risk_threshold=float(cfg["audit"]["risk_threshold"]),
        audit_budget_ratio=float(cfg["audit"]["audit_budget_ratio"]),
        max_audits_per_cycle=int(cfg["audit"]["max_audits_per_cycle"]),
        f_min=int(cfg["audit"]["f_min"]),
        f_max=int(cfg["audit"]["f_max"]),
        audit_cost_per_audit=1.0,
        operational_cost=100.0,
        alpha_low=0.1,
        alpha_high=0.7,
        beta=0.1,
        cluster_k=3,
        cluster_window=50,
        C_a=1.0,
        C_f=10.0,
        grad_lr=float(cfg["gradient"]["lr"]),
        # Attack/fault scenarios
        scenario_fdi_rate=0.40,
        scenario_dos_rate=0.20,
        scenario_chain_rate=0.20,
        scenario_fault_rate=0.20,
        attack_cfg=attack_cfg,
        fault_cfg=fault_cfg,
    )
    print(f"[Dynamic] Complete: {len(dyn_metrics)} timesteps, {len(dyn_events)} events")
    print()

    # --- Baseline Run (Fixed f=1) ---
    print("=" * 70)
    print("BASELINE RUN (Fixed Audit Frequency f=1)")
    print("=" * 70)
    base_metrics, base_events = run_fixed_audit_24h(
        agents=agents_base,
        lstm_infer=infer,
        fixed_f=1,
        timestep_minutes=int(cfg["simulation"]["timestep_minutes"]),
        cycle_hours=int(cfg["simulation"]["cycle_hours"]),
        cluster_k=3,
        cluster_window=50,
        alpha_low=0.1,
        alpha_high=0.7,
        beta=0.1,
        audit_cost_per_audit=1.0,
        audit_budget_ratio=float(cfg["audit"]["audit_budget_ratio"]),
        operational_cost=100.0,
        f_max=int(cfg["audit"]["f_max"]),
        max_audits_per_cycle=int(cfg["audit"]["max_audits_per_cycle"]),
        # Matching scenario for fair comparison
        scenario_fdi_rate=0.40,
        scenario_dos_rate=0.20,
        scenario_chain_rate=0.20,
        scenario_fault_rate=0.20,
        attack_cfg=attack_cfg,
        fault_cfg=fault_cfg,
    )
    print(f"[Baseline] Complete: {len(base_metrics)} timesteps, {len(base_events)} events")
    print()

    # --- CSV Exports ---
    print("=" * 70)
    print("EXPORTING RESULTS")
    print("=" * 70)
    output_dir = cfg.get("experiment", {}).get("output_dir", "logs")
    export_csv(dyn_metrics, f"{output_dir}/dynamic_metrics.csv")
    export_csv(base_metrics, f"{output_dir}/baseline_metrics.csv")
    export_csv(dyn_events, f"{output_dir}/events_dynamic.csv")
    export_csv(base_events, f"{output_dir}/events_baseline.csv")
    print()

    # --- Summary Statistics ---
    summary = build_summary(dyn_metrics, base_metrics)
    print_summary(summary)


if __name__ == "__main__":
    main()
