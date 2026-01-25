"""
Comparison runner: Dynamic vs Fixed-audit baseline

Runs both schedulers and compares performance metrics.
Paper-grade evaluation output.
"""

import os
import numpy as np

from smartgrid_mas.simulation.main import build_agents
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.simulation.run_simulation import run_simulation_24h
from smartgrid_mas.simulation.run_baseline_fixed import run_fixed_audit_24h
from smartgrid_mas.simulation.eval_suite import build_summary
from smartgrid_mas.simulation.export import export_records_csv
from smartgrid_mas.data.cyber_attacks import AttackConfig
from smartgrid_mas.data.synthetic_faults import FaultConfig


if __name__ == "__main__":
    print("=" * 70)
    print("STEP 12: Evaluation Suite - Dynamic vs Baseline Comparison")
    print("=" * 70)
    print()
    
    # Build separate agent sets for fair comparison
    n_agents = 50
    print(f"Building {n_agents} agents for dynamic run...")
    agents_dyn = build_agents(n_agents)
    
    print(f"Building {n_agents} agents for baseline run...")
    agents_base = build_agents(n_agents)
    
    # Load LSTM
    model_path = "smartgrid_mas/data/anomaly_inputs/lstm.pt"
    print(f"Loading LSTM model: {model_path}")
    infer = LSTMInferencer(model_path=model_path, input_size=5)
    
    # Use same demo configs for fair comparison
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
    
    print()
    print("Running DYNAMIC scheduler (RL + Gradient + Constraints)...")
    dyn_metrics, dyn_events = run_simulation_24h(
        agents_dyn,
        infer,
        scenario_fdi_rate=0.40,
        scenario_dos_rate=0.20,
        scenario_chain_rate=0.20,
        scenario_fault_rate=0.20,
        attack_cfg=demo_attack_cfg,
        fault_cfg=demo_fault_cfg,
    )
    print(f"  Dynamic run complete: {len(dyn_metrics)} timesteps, {len(dyn_events)} events")
    
    print()
    print("Running BASELINE scheduler (Fixed audit frequency = 1)...")
    base_metrics, base_events = run_fixed_audit_24h(
        agents_base,
        infer,
        fixed_f=1,
        scenario_fdi_rate=0.40,
        scenario_dos_rate=0.20,
        scenario_chain_rate=0.20,
        scenario_fault_rate=0.20,
        attack_cfg=demo_attack_cfg,
        fault_cfg=demo_fault_cfg,
    )
    print(f"  Baseline run complete: {len(base_metrics)} timesteps, {len(base_events)} events")
    
    print()
    print("=" * 70)
    print("EVALUATION SUMMARY")
    print("=" * 70)
    
    summary = build_summary(dyn_metrics, base_metrics)
    
    print()
    print("Attack Rate:")
    print(f"  Dynamic:  {summary['dynamic_mean_attack_rate']:.4f}")
    print(f"  Baseline: {summary['baseline_mean_attack_rate']:.4f}")
    print(f"  Reduction: {summary['attack_rate_reduction']*100:.2f}%")
    
    print()
    print("Audit Cost:")
    print(f"  Dynamic:  ${summary['dynamic_total_audit_cost']:.2f}")
    print(f"  Baseline: ${summary['baseline_total_audit_cost']:.2f}")
    print(f"  Efficiency: {summary['cost_efficiency']*100:.2f}% cost savings")
    
    print()
    print("=" * 70)
    print("EXPORTING RESULTS")
    print("=" * 70)
    
    # Create logs directory if needed
    os.makedirs("logs", exist_ok=True)
    
    export_records_csv(dyn_metrics, "logs/dynamic_metrics.csv")
    export_records_csv(base_metrics, "logs/baseline_metrics.csv")
    export_records_csv(dyn_events, "logs/dynamic_events.csv")
    export_records_csv(base_events, "logs/baseline_events.csv")
    
    print()
    print("Evaluation complete!")
    print("Results saved to logs/ directory")
    print()
