"""
Method comparison runner.

Runs five detection methods on the same 24-hour simulation data and produces
a comparative results table. Used for the thesis comparison section.

Methods compared:
  1. Deviation-only (base paper approach)
  2. LSTM-only (probability threshold)
  3. Isolation Forest (unsupervised ML baseline)
  4. One-Class SVM (novelty detection baseline)
  5. Our full system (3-modality + 3-layer multi-detector)
"""

from __future__ import annotations

import copy
import json
import logging
import os
import sys
import time
from typing import Any, Dict, List, Tuple

import numpy as np

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentCriticality, AgentType
from smartgrid_mas.anomaly_detection.dual_branch import (
    build_grid_branch_window,
    build_network_branch_window,
    fuse_branch_probabilities,
)
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.behavior_analysis.scoring_pipeline import compute_score_and_flag
from smartgrid_mas.data.cyber_attacks import AttackConfig
from smartgrid_mas.data.synthetic_faults import FaultConfig, FaultType
from smartgrid_mas.environment.grid_env import GridEnvironment, GridEnvConfig
from smartgrid_mas.environment.scenario_engine import ScenarioConfig, ScenarioEngine
from smartgrid_mas.simulation.baseline_comparators import (
    ComparisonResult,
    DeviationOnlyDetector,
    IsolationForestDetector,
    LSTMOnlyDetector,
    OneClassSVMDetector,
)

logger = logging.getLogger(__name__)


ENV_PHYS_DIM = 3  # GridEnvironment default: V, I, f
ENV_CYBER_DIM = 4


def _build_agents(n: int = 100, seed: int = 42) -> List[BaseAgent]:
    rng = np.random.default_rng(seed)
    agents: List[BaseAgent] = []
    ratios = [
        (AgentType.GENERATOR, 0.20, 1.0),
        (AgentType.SUBSTATION, 0.30, 0.7),
        (AgentType.PMU, 0.25, 0.3),
        (AgentType.BREAKER, 0.25, 0.5),
    ]
    aid = 0
    for atype, ratio, base_w in ratios:
        count = max(1, int(n * ratio))
        if atype == AgentType.BREAKER:
            count = n - aid
        for _ in range(count):
            w = float(base_w + 0.4 * rng.random())
            agents.append(
                BaseAgent(
                    agent_id=str(aid),
                    agent_type=atype,
                    criticality=AgentCriticality(weight=w),
                    bx=np.ones(ENV_PHYS_DIM),
                    by=np.ones(ENV_CYBER_DIM),
                    thx=np.ones(ENV_PHYS_DIM) * 0.1,
                    thy=np.ones(ENV_CYBER_DIM) * 0.1,
                )
            )
            aid += 1
    return agents


def _load_lstm() -> Tuple[LSTMInferencer, LSTMInferencer | None]:
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    grid_path = os.path.join(base, "data", "anomaly_inputs", "lstm.pt")
    net_path = os.path.join(base, "data", "anomaly_inputs", "lstm_network.pt")

    grid_infer = LSTMInferencer(model_path=grid_path)
    net_infer = None
    if os.path.exists(net_path):
        try:
            net_infer = LSTMInferencer(model_path=net_path)
        except Exception:
            pass
    return grid_infer, net_infer


def _get_ground_truth(env: GridEnvironment, agent_id: str) -> int:
    if env.last_attacks:
        at = env.last_attacks.get(agent_id)
        if at is not None:
            try:
                raw = str(getattr(at, "name", getattr(at, "value", str(at)))).upper()
            except Exception:
                raw = str(at).upper()
            if raw in {"FDI", "DOS", "MITM"}:
                return 1
    if env.last_faults:
        ft = env.last_faults.get(agent_id)
        if ft is not None and ft != FaultType.NONE:
            return 1
    return 0


def run_comparison(
    n_agents: int = 100,
    cycle_hours: int = 24,
    timestep_minutes: int = 5,
    seed: int = 42,
    warmup_steps: int = 50,
) -> Dict[str, Any]:
    """Run all five methods on identical simulation data."""

    steps = int((cycle_hours * 60) / timestep_minutes)
    attack_cfg = AttackConfig(
        fdi_bias=2.5, fdi_drift=0.05,
        dos_latency_increase=4.0, dos_integrity_drop=0.8,
        mitm_noise_std=1.0,
    )
    fault_cfg = FaultConfig(
        sag_pct=0.45, surge_pct=0.35,
        overcurrent_pct=0.70, freq_delta=1.5,
    )

    # --- Build agents for the full pipeline (reused across methods) ---
    agents_full = _build_agents(n_agents, seed)
    lstm_infer, net_infer = _load_lstm()
    window_for_lstm = getattr(lstm_infer, "window", None) or 24

    scenario_full = ScenarioEngine(
        agents_full,
        ScenarioConfig(seed=seed, fdi_rate=0.10, dos_rate=0.05, mitm_rate=0.03, chain_rate=0.05, fault_rate=0.05, audit_protection_window=0),
    )
    env_full = GridEnvironment(
        agents_full, GridEnvConfig(seed=seed),
        scenario=scenario_full, attack_cfg=attack_cfg, fault_cfg=fault_cfg,
    )

    # --- Baseline detectors ---
    # Deviation threshold tuned for simulation feature scale (normalized ~1.0 baseline,
    # thx=0.1). The base paper's equivalent threshold at this scale is ~2.0.
    dev_only = DeviationOnlyDetector(threshold=2.0)
    # LSTM threshold lowered to 0.50 — the LSTM produces probabilities in [0, 0.6]
    # range on simulation data, so 0.80 would yield 0% recall (unfair comparison).
    lstm_only = LSTMOnlyDetector(prob_threshold=0.50)
    iso_forest = IsolationForestDetector(warmup=warmup_steps, contamination=0.10)
    ocsvm = OneClassSVMDetector(warmup=warmup_steps, nu=0.10)

    # --- Results accumulators ---
    results = {
        "deviation_only": ComparisonResult("Deviation-Only (Base Paper)"),
        "lstm_only": ComparisonResult("LSTM-Only"),
        "isolation_forest": ComparisonResult("Isolation Forest"),
        "one_class_svm": ComparisonResult("One-Class SVM"),
        "full_system": ComparisonResult("Our System (3-Modality + Multi-Layer)"),
    }

    # Per-agent IF/SVM instances (each agent has its own feature distribution)
    if_detectors = {a.agent_id: IsolationForestDetector(warmup=warmup_steps, contamination=0.05) for a in agents_full}
    svm_detectors = {a.agent_id: OneClassSVMDetector(warmup=warmup_steps, nu=0.05) for a in agents_full}

    print(f"Running {steps}-step comparison with {n_agents} agents...")
    t_start = time.time()

    for t in range(steps):
        if t % 50 == 0:
            elapsed = time.time() - t_start
            print(f"  Step {t}/{steps} ({elapsed:.1f}s elapsed)")

        # === Get observations from environment ===
        obs, truth = env_full.step(t)

        # === LSTM inference (shared by LSTM-only and full system) ===
        grid_windows = []
        network_windows = []
        states = []
        for a in agents_full:
            x, y = obs[a.agent_id]
            st = a.observe(x, y)
            w = a.get_history_window(window=window_for_lstm)
            grid_windows.append(build_grid_branch_window(w))
            if net_infer is not None:
                network_windows.append(build_network_branch_window(w))
            states.append(st)

        grid_probs = lstm_infer.predict_proba_batch(grid_windows)
        network_probs = (
            net_infer.predict_proba_batch(network_windows)
            if net_infer is not None and network_windows
            else [0.0] * len(grid_probs)
        )
        for st, gp, np_ in zip(states, grid_probs, network_probs):
            fused = fuse_branch_probabilities(gp, np_)
            st.grid_anomaly_prob = fused.grid_prob
            st.network_intrusion_prob = fused.network_prob
            st.fusion_agreement = fused.agreement
            st.anomaly_prob = fused.fused_prob

        # === Full system detection (3-modality + multi-layer) ===
        for a in agents_full:
            if a.last_state is None:
                continue
            compute_score_and_flag(a, a.last_state)

        # === Record results for each method ===
        is_warmup = t < warmup_steps
        for a in agents_full:
            if a.last_state is None:
                continue
            gt = _get_ground_truth(env_full, a.agent_id)
            x_phys = a.last_state.x_phys
            y_cyber = a.last_state.y_cyber

            # Method 1: Deviation-only
            dev_r = dev_only.detect(x_phys, y_cyber, a.bx, a.by, a.thx, a.thy, a.criticality.weight)
            results["deviation_only"].y_true.append(gt)
            results["deviation_only"].y_pred.append(dev_r.flag)
            results["deviation_only"].scores.append(dev_r.score)

            # Method 2: LSTM-only
            lstm_r = lstm_only.detect(float(a.last_state.anomaly_prob))
            results["lstm_only"].y_true.append(gt)
            results["lstm_only"].y_pred.append(lstm_r.flag)
            results["lstm_only"].scores.append(lstm_r.score)

            # Method 3: Isolation Forest
            if_r = if_detectors[a.agent_id].observe_and_detect(x_phys, y_cyber, is_warmup)
            results["isolation_forest"].y_true.append(gt)
            results["isolation_forest"].y_pred.append(if_r.flag)
            results["isolation_forest"].scores.append(if_r.score)

            # Method 4: One-Class SVM
            svm_r = svm_detectors[a.agent_id].observe_and_detect(x_phys, y_cyber, is_warmup)
            results["one_class_svm"].y_true.append(gt)
            results["one_class_svm"].y_pred.append(svm_r.flag)
            results["one_class_svm"].scores.append(svm_r.score)

            # Method 5: Full system
            results["full_system"].y_true.append(gt)
            results["full_system"].y_pred.append(int(a.last_state.anomaly_flag))
            results["full_system"].scores.append(float(a.last_state.deviation_score))

    elapsed = time.time() - t_start
    print(f"\nComparison complete in {elapsed:.1f}s")

    # === Threshold sweep for score-based methods ===
    # Find the threshold that maximizes accuracy for deviation-only and LSTM-only.
    # IF and SVM use their own learned boundaries (no threshold to sweep).
    def _sweep(name: str, cr: ComparisonResult, thresholds: List[float]) -> ComparisonResult:
        best_acc = -1.0
        best_cr = cr
        for thr in thresholds:
            trial = ComparisonResult(cr.method_name)
            trial.y_true = list(cr.y_true)
            trial.y_pred = [1 if s >= thr else 0 for s in cr.scores]
            trial.scores = list(cr.scores)
            if trial.accuracy > best_acc:
                best_acc = trial.accuracy
                best_cr = trial
        print(f"  {name}: best threshold sweep -> accuracy={best_acc*100:.2f}%")
        return best_cr

    dev_thresholds = [float(x) for x in np.arange(1.0, 8.0, 0.25)]
    lstm_thresholds = [float(x) for x in np.arange(0.10, 0.95, 0.05)]

    results["deviation_only"] = _sweep("Deviation-Only", results["deviation_only"], dev_thresholds)
    results["lstm_only"] = _sweep("LSTM-Only", results["lstm_only"], lstm_thresholds)

    # === Build summary table ===
    summaries = []
    for key in ["deviation_only", "lstm_only", "isolation_forest", "one_class_svm", "full_system"]:
        s = results[key].summary()
        summaries.append(s)
        print(
            f"  {s['method']:45s} | Acc {s['accuracy']:6.2f}% | FPR {s['fpr']:5.2f}% "
            f"| Recall {s['recall']:6.2f}% | Prec {s['precision']:6.2f}% "
            f"| F1 {s['f1']:6.2f}% | FNR {s['fnr']:5.2f}%"
        )

    return {
        "summaries": summaries,
        "n_agents": n_agents,
        "steps": steps,
        "cycle_hours": cycle_hours,
        "elapsed_seconds": elapsed,
        "seed": seed,
    }


def main():
    logging.basicConfig(level=logging.WARNING)
    result = run_comparison()

    # Save results
    out_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "results",
        "method_comparison.json",
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nResults saved to {out_path}")


if __name__ == "__main__":
    main()
