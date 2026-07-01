"""Diagnostic: full simulation loop with real LSTM to trace per-attack typing."""
import os, sys, time
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["SMARTGRID_AUDIT_PROTECTION_WINDOW"] = "0"

from collections import defaultdict, Counter
from smartgrid_mas.run_all import build_agent_pool, ENV_CFG, LSTM_MODEL_PATH, NETWORK_LSTM_MODEL_PATH
from smartgrid_mas.environment.grid_env import GridEnvironment, GridEnvConfig
from smartgrid_mas.environment.scenario_engine import ScenarioEngine, ScenarioConfig
from smartgrid_mas.data.cyber_attacks import AttackConfig, AttackType
from smartgrid_mas.data.synthetic_faults import FaultConfig, FaultType
from smartgrid_mas.behavior_analysis.scoring_pipeline import compute_score_and_flag
from smartgrid_mas.behavior_analysis.behavior_pipeline import behavior_update
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.anomaly_detection.dual_branch import (
    build_grid_branch_window, build_network_branch_window, fuse_branch_probabilities
)

N_AGENTS = 100
agents = build_agent_pool(N_AGENTS, seed=42)

cfg = ScenarioConfig(mitm_rate=0.03, audit_protection_window=0)
scenario = ScenarioEngine(agents, cfg)
env = GridEnvironment(agents, ENV_CFG, scenario=scenario,
                      attack_cfg=AttackConfig(), fault_cfg=FaultConfig())

# Load LSTM models
print("Loading LSTM models...")
inferencer = LSTMInferencer(model_path=LSTM_MODEL_PATH)
try:
    net_inferencer = LSTMInferencer(model_path=NETWORK_LSTM_MODEL_PATH)
except Exception as e:
    print(f"Network LSTM not available: {e}")
    net_inferencer = None

window_for_lstm = getattr(inferencer, "window", None) or 24

confusion = defaultdict(Counter)
flagged_by_type = defaultdict(int)
total_by_type = defaultdict(int)

# Track prob distributions by ground truth type
probs_by_type = defaultdict(list)
scores_by_type = defaultdict(list)
triggers_by_type = defaultdict(Counter)

STEPS = 288
print(f"Running {STEPS} steps with {N_AGENTS} agents...")
for t in range(STEPS):
    obs, truth = env.step(t)
    attacks = env.last_attacks
    faults = env.last_faults

    # Batch LSTM inference
    grid_windows = []
    network_windows = []
    states = []
    for agent in agents:
        x, y = obs[agent.agent_id]
        st = agent.observe(x, y)
        w = agent.get_history_window(window=window_for_lstm)
        grid_windows.append(build_grid_branch_window(w))
        if net_inferencer is not None:
            network_windows.append(build_network_branch_window(w))
        states.append(st)

    grid_probs = inferencer.predict_proba_batch(grid_windows)
    network_probs = (
        net_inferencer.predict_proba_batch(network_windows)
        if net_inferencer is not None and network_windows
        else [0.0] * len(grid_probs)
    )
    for st, gp, np_ in zip(states, grid_probs, network_probs):
        fused = fuse_branch_probabilities(gp, np_)
        st.grid_anomaly_prob = fused.grid_prob
        st.network_intrusion_prob = fused.network_prob
        st.fusion_agreement = fused.agreement
        st.anomaly_prob = fused.fused_prob

    # Score and flag
    for agent in agents:
        if agent.last_state is None:
            continue
        compute_score_and_flag(agent, agent.last_state)

    # Collect metrics
    for agent in agents:
        aid = agent.agent_id
        st = agent.last_state

        atk = attacks.get(aid, AttackType.NONE)
        flt = faults.get(aid, FaultType.NONE)
        if flt != FaultType.NONE:
            gt_type = "FAULT"
        elif atk == AttackType.FDI:
            gt_type = "FDI"
        elif atk == AttackType.DOS:
            gt_type = "DOS"
        elif atk == AttackType.MITM:
            gt_type = "MITM"
        else:
            gt_type = "NONE"

        total_by_type[gt_type] += 1
        predicted = getattr(st, 'attack_type', 'NONE')
        flag = int(getattr(st, 'anomaly_flag', 0))
        prob = float(getattr(st, 'anomaly_prob', 0.0))
        score = float(getattr(st, 'deviation_score', 0.0))
        trigger = str(getattr(st, 'trigger_path', '?'))

        probs_by_type[gt_type].append(prob)
        scores_by_type[gt_type].append(score)

        if flag == 1:
            flagged_by_type[gt_type] += 1
            confusion[gt_type][predicted] += 1
            triggers_by_type[gt_type][trigger] += 1

    # Run behavior update
    for agent in agents:
        if agent.last_state is None:
            continue
        behavior_update(agent, agent.last_state)

    if t % 50 == 0:
        print(f"  step {t}/{STEPS}")

print("\n" + "=" * 80)
print("LSTM PROBABILITY DISTRIBUTIONS BY GROUND TRUTH TYPE")
print("=" * 80)
for gt in ["NONE", "FDI", "DOS", "MITM", "FAULT"]:
    probs = probs_by_type.get(gt, [])
    if not probs:
        continue
    p = np.array(probs)
    print(f"  {gt:6s}  mean={p.mean():.4f}  std={p.std():.4f}  "
          f"min={p.min():.4f}  p25={np.percentile(p,25):.4f}  "
          f"p50={np.median(p):.4f}  p75={np.percentile(p,75):.4f}  "
          f"p95={np.percentile(p,95):.4f}  max={p.max():.4f}")

print("\n" + "=" * 80)
print("DEVIATION SCORE DISTRIBUTIONS BY GROUND TRUTH TYPE")
print("=" * 80)
for gt in ["NONE", "FDI", "DOS", "MITM", "FAULT"]:
    scores = scores_by_type.get(gt, [])
    if not scores:
        continue
    s = np.array(scores)
    print(f"  {gt:6s}  mean={s.mean():.4f}  std={s.std():.4f}  "
          f"min={s.min():.4f}  p50={np.median(s):.4f}  "
          f"p95={np.percentile(s,95):.4f}  max={s.max():.4f}")

print("\n" + "=" * 80)
print("TRIGGER PATHS FOR FLAGGED EVENTS BY TYPE")
print("=" * 80)
for gt in ["NONE", "FDI", "DOS", "MITM", "FAULT"]:
    triggers = triggers_by_type.get(gt, Counter())
    if not triggers:
        continue
    total = sum(triggers.values())
    print(f"  {gt}  (total flagged={total}):")
    for trig, count in triggers.most_common():
        print(f"    {trig:20s}  {count:5d}  ({100*count/total:5.1f}%)")

print("\n" + "=" * 80)
print("ATTACK TYPING CONFUSION (flagged events only)")
print("=" * 80)
for gt in ["NONE", "FDI", "DOS", "MITM", "FAULT"]:
    total = total_by_type.get(gt, 0)
    flagged = flagged_by_type.get(gt, 0)
    if total == 0:
        continue
    print(f"\n  Ground Truth: {gt}  (total={total}, flagged={flagged}, flag_rate={100*flagged/total:.1f}%)")
    preds = confusion.get(gt, Counter())
    for pred_type, count in preds.most_common():
        pct = 100 * count / flagged if flagged else 0
        correct = "*" if pred_type == gt else " "
        print(f"    {correct} predicted={pred_type:8s}  count={count:5d}  ({pct:5.1f}% of flagged)")

print("\n" + "=" * 80)
print("PER-TYPE TPR")
print("=" * 80)
for gt in ["FDI", "DOS", "MITM", "FAULT"]:
    total = total_by_type.get(gt, 0)
    correct = confusion.get(gt, Counter()).get(gt, 0)
    tpr = correct / total if total else 0
    print(f"  {gt:8s}  TPR={tpr:.4f}  ({correct}/{total})")

print("\nDONE")
