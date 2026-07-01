"""Diagnostic: trace scoring pipeline with real LSTM + behavior_update to find typing gap."""
import os, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["SMARTGRID_AUDIT_PROTECTION_WINDOW"] = "0"

from collections import defaultdict, Counter
from smartgrid_mas.run_all import build_agent_pool, ENV_CFG
from smartgrid_mas.environment.grid_env import GridEnvironment, GridEnvConfig
from smartgrid_mas.environment.scenario_engine import ScenarioEngine, ScenarioConfig
from smartgrid_mas.data.cyber_attacks import AttackConfig, AttackType
from smartgrid_mas.data.synthetic_faults import FaultConfig, FaultType
from smartgrid_mas.behavior_analysis.scoring_pipeline import compute_score_and_flag
from smartgrid_mas.behavior_analysis.behavior_pipeline import behavior_update
from smartgrid_mas.detection.multilayer_detection import (
    cusum_fdi_detector, network_dos_detector, integrity_mitm_detector
)

N_AGENTS = 100
agents = build_agent_pool(N_AGENTS, seed=42)

cfg = ScenarioConfig(mitm_rate=0.03, audit_protection_window=0)
scenario = ScenarioEngine(agents, cfg)
env = GridEnvironment(agents, ENV_CFG, scenario=scenario,
                      attack_cfg=AttackConfig(), fault_cfg=FaultConfig())

confusion = defaultdict(Counter)
flagged_by_type = defaultdict(int)
total_by_type = defaultdict(int)
typed_correctly = defaultdict(int)

# Track a few specific agents to see what's happening
trace_agents = set()
trace_log = []

STEPS = 288
for t in range(STEPS):
    obs, truth = env.step(t)
    attacks = env.last_attacks
    faults = env.last_faults

    for agent in agents:
        aid = agent.agent_id
        x_phys, y_cyber = obs[aid]
        st = agent.observe(x_phys, y_cyber)

        # Use fixed prob like diagnostic_typing.py to isolate behavior_update effect
        st.anomaly_prob = 0.85
        st = compute_score_and_flag(agent, st)
        agent.last_state = st

        # NOW run behavior_update (this is the key difference from diagnostic_typing.py)
        behavior_update(agent, st)

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

        if flag == 1:
            flagged_by_type[gt_type] += 1
            confusion[gt_type][predicted] += 1

        # Trace first few FDI/DOS/MITM agents
        if gt_type in ("FDI", "DOS", "MITM") and aid not in trace_agents and len(trace_agents) < 6:
            trace_agents.add(aid)

        if aid in trace_agents and t < 50:
            eff_thx = np.maximum(agent.thx, 1e-6)
            layer_c1 = cusum_fdi_detector(agent.x_history, agent.bx, scale=eff_thx)
            layer_c2 = network_dos_detector(y_cyber, agent.by)
            layer_c3 = integrity_mitm_detector(y_cyber, agent.by, y_history=agent.y_history)
            trace_log.append(
                f"t={t:3d} agent={aid:4s} gt={gt_type:5s} flag={flag} pred={predicted:6s} "
                f"bx={agent.bx[:2]} by={agent.by[:2]} "
                f"thx={agent.thx[:2]} thy={agent.thy[:2]} "
                f"C1={layer_c1.fired}({layer_c1.label}) C2={layer_c2.fired}({layer_c2.label}) C3={layer_c3.fired}({layer_c3.label}) "
                f"trigger={getattr(st, 'trigger_path', '?')}"
            )

print("=" * 80)
print("WITH BEHAVIOR_UPDATE (fixed prob=0.85)")
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

print("\n" + "=" * 80)
print("AGENT TRACE (first 50 steps)")
print("=" * 80)
for line in trace_log[:100]:
    print(f"  {line}")

print("\nDONE")
