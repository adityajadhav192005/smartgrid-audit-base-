"""Capture one real instance of each attack type with full detection trace,
for the worked attack-vs-base-paper test case in the report.

For each of FDI, DoS, MITM, FAULT this records:
  - the injected observation (x_phys, y_cyber)
  - the deviation score (what the base-paper deviation-only scorer sees)
  - whether deviation-only alone would flag at its threshold
  - our pipeline output: flag, attack_type, confidence, which Layer C fired
Nothing is fabricated; every value comes from a real run.
"""
import os, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["SMARTGRID_AUDIT_PROTECTION_WINDOW"] = "0"

from smartgrid_mas.run_all import build_agent_pool, ENV_CFG, LSTM_MODEL_PATH, NETWORK_LSTM_MODEL_PATH
from smartgrid_mas.environment.grid_env import GridEnvironment
from smartgrid_mas.environment.scenario_engine import ScenarioEngine, ScenarioConfig
from smartgrid_mas.data.cyber_attacks import AttackConfig, AttackType
from smartgrid_mas.data.synthetic_faults import FaultConfig, FaultType
from smartgrid_mas.behavior_analysis.scoring_pipeline import compute_score_and_flag
from smartgrid_mas.behavior_analysis.behavior_pipeline import behavior_update
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.anomaly_detection.dual_branch import (
    build_grid_branch_window, build_network_branch_window, fuse_branch_probabilities
)
from smartgrid_mas.detection.multilayer_detection import (
    cusum_fdi_detector, network_dos_detector, integrity_mitm_detector, fault_signature_detector
)

agents = build_agent_pool(100, seed=42)
scenario = ScenarioEngine(agents, ScenarioConfig(mitm_rate=0.03, audit_protection_window=0))
env = GridEnvironment(agents, ENV_CFG, scenario=scenario, attack_cfg=AttackConfig(), fault_cfg=FaultConfig())

inferencer = LSTMInferencer(model_path=LSTM_MODEL_PATH)
try:
    net_inferencer = LSTMInferencer(model_path=NETWORK_LSTM_MODEL_PATH)
except Exception:
    net_inferencer = None
window_for_lstm = getattr(inferencer, "window", None) or 24

# Base-paper deviation-only threshold (same score scale as our deviation score).
DEV_ONLY_THRESHOLD = 3.60

captured = {}
want = {"FDI", "DOS", "MITM", "FAULT"}

for t in range(288):
    obs, truth = env.step(t)
    attacks, faults = env.last_attacks, env.last_faults

    grid_windows, network_windows, states = [], [], []
    for a in agents:
        x, y = obs[a.agent_id]
        st = a.observe(x, y)
        w = a.get_history_window(window=window_for_lstm)
        grid_windows.append(build_grid_branch_window(w))
        if net_inferencer is not None:
            network_windows.append(build_network_branch_window(w))
        states.append(st)
    gprobs = inferencer.predict_proba_batch(grid_windows)
    nprobs = (net_inferencer.predict_proba_batch(network_windows)
              if net_inferencer is not None and network_windows else [0.0]*len(gprobs))
    for st, gp, npb in zip(states, gprobs, nprobs):
        fused = fuse_branch_probabilities(gp, npb)
        st.grid_anomaly_prob = fused.grid_prob
        st.network_intrusion_prob = fused.network_prob
        st.fusion_agreement = fused.agreement
        st.anomaly_prob = fused.fused_prob

    for a in agents:
        if a.last_state is None:
            continue
        compute_score_and_flag(a, a.last_state)

    # Only start capturing after warmup so histories are populated
    if t > 40:
        for a in agents:
            aid = a.agent_id
            st = a.last_state
            atk = attacks.get(aid, AttackType.NONE)
            flt = faults.get(aid, FaultType.NONE)
            if flt != FaultType.NONE:
                gt = "FAULT"
            elif atk == AttackType.FDI:
                gt = "FDI"
            elif atk == AttackType.DOS:
                gt = "DOS"
            elif atk == AttackType.MITM:
                gt = "MITM"
            else:
                continue
            if gt not in want or gt in captured:
                continue
            pred = getattr(st, "attack_type", "NONE")
            if pred != gt:  # capture a correctly-typed instance for the worked example
                continue
            eff_thx = np.maximum(a.thx, 1e-6)
            c1 = cusum_fdi_detector(a.x_history, a.bx, scale=eff_thx)
            c2 = network_dos_detector(st.y_cyber, a.by)
            c3 = integrity_mitm_detector(st.y_cyber, a.by, y_history=a.y_history)
            c4 = fault_signature_detector(st.x_phys, a.bx, y_cyber=st.y_cyber, baseline_y=a.by, scale=eff_thx)
            fired = []
            if c1.fired: fired.append(f"C1/FDI({c1.confidence:.2f})")
            if c2.fired: fired.append(f"C2/DoS({c2.confidence:.2f})")
            if c3.fired: fired.append(f"C3/MITM({c3.confidence:.2f})")
            if c4.fired: fired.append(f"C4/FAULT({c4.confidence:.2f})")
            captured[gt] = {
                "t": t, "agent": aid, "type": a.agent_type.name,
                "x": np.round(st.x_phys, 3).tolist(),
                "y": np.round(st.y_cyber, 3).tolist(),
                "bx": np.round(a.bx, 3).tolist(),
                "by": np.round(a.by, 3).tolist(),
                "dev_score": round(float(getattr(st, "deviation_score", 0.0)), 2),
                "dev_only_flag": int(float(getattr(st, "deviation_score", 0.0)) >= DEV_ONLY_THRESHOLD),
                "our_flag": int(getattr(st, "anomaly_flag", 0)),
                "our_type": pred,
                "our_conf": round(float(getattr(st, "attack_type_confidence", 0.0)), 2),
                "fired": ", ".join(fired) if fired else "(typed via fallback)",
                "anomaly_prob": round(float(getattr(st, "anomaly_prob", 0.0)), 3),
            }

    for a in agents:
        if a.last_state is not None:
            behavior_update(a, a.last_state)

    if want <= set(captured.keys()):
        break

print(f"DEV_ONLY_THRESHOLD = {DEV_ONLY_THRESHOLD}")
for gt in ["FDI", "DOS", "MITM", "FAULT"]:
    c = captured.get(gt)
    if not c:
        print(f"\n{gt}: NOT CAPTURED")
        continue
    print(f"\n=== {gt} ===")
    for k, v in c.items():
        print(f"  {k}: {v}")
