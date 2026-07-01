"""Diagnostic: compare binary truth vs per-attack truth to find the 282 vs 18808 gap."""
import os, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["SMARTGRID_AUDIT_PROTECTION_WINDOW"] = "0"

from collections import Counter
from smartgrid_mas.run_all import build_agent_pool, ENV_CFG
from smartgrid_mas.environment.grid_env import GridEnvironment, GridEnvConfig
from smartgrid_mas.environment.scenario_engine import ScenarioEngine, ScenarioConfig
from smartgrid_mas.data.cyber_attacks import AttackConfig, AttackType
from smartgrid_mas.data.synthetic_faults import FaultConfig, FaultType

N_AGENTS = 200
agents = build_agent_pool(N_AGENTS, seed=42)

cfg = ScenarioConfig(mitm_rate=0.03, audit_protection_window=0)
scenario = ScenarioEngine(agents, cfg)
env = GridEnvironment(agents, ENV_CFG, scenario=scenario,
                      attack_cfg=AttackConfig(), fault_cfg=FaultConfig())

binary_pos = 0
binary_neg = 0
per_attack_counts = Counter()
mismatch_examples = []

STEPS = 288
for t in range(STEPS):
    obs, truth = env.step(t)
    attacks = env.last_attacks
    faults = env.last_faults

    for a in agents:
        aid = a.agent_id
        gt_binary = 1 if truth.get(aid, 0) else 0

        # Per-attack type (same logic as run_simulation.py)
        atk_type = "NONE"
        if attacks:
            at = attacks.get(aid)
            if at is not None:
                try:
                    raw = str(getattr(at, "name", getattr(at, "value", str(at)))).upper()
                except Exception:
                    raw = str(at).upper()
                if raw in {"FDI", "DOS", "MITM"}:
                    atk_type = raw

        has_fault = bool(
            faults
            and faults.get(aid)
            and faults.get(aid) != FaultType.NONE
        )
        if atk_type == "NONE" and has_fault:
            atk_type = "FAULT"

        if gt_binary == 1:
            binary_pos += 1
        else:
            binary_neg += 1

        per_attack_counts[atk_type] += 1

        # Check for mismatch: binary says 0 but per-attack says not NONE
        if gt_binary == 0 and atk_type != "NONE":
            if len(mismatch_examples) < 10:
                atk_val = attacks.get(aid) if attacks else None
                flt_val = faults.get(aid) if faults else None
                mismatch_examples.append(
                    f"t={t} agent={aid} binary=0 type={atk_type} "
                    f"atk={atk_val} flt={flt_val} truth_val={truth.get(aid, 'MISSING')}"
                )

        # Also check reverse: binary says 1 but per-attack says NONE
        if gt_binary == 1 and atk_type == "NONE":
            if len(mismatch_examples) < 20:
                atk_val = attacks.get(aid) if attacks else None
                flt_val = faults.get(aid) if faults else None
                mismatch_examples.append(
                    f"t={t} agent={aid} binary=1 type=NONE "
                    f"atk={atk_val} flt={flt_val} truth_val={truth.get(aid, 'MISSING')}"
                )

total = binary_pos + binary_neg
print(f"Total events: {total}")
print(f"Binary positive (truth=1): {binary_pos}")
print(f"Binary negative (truth=0): {binary_neg}")
print(f"\nPer-attack type counts:")
for k, v in sorted(per_attack_counts.items()):
    print(f"  {k}: {v}")
per_attack_pos = sum(v for k, v in per_attack_counts.items() if k != "NONE")
print(f"  Total non-NONE: {per_attack_pos}")

print(f"\nMismatch examples ({len(mismatch_examples)}):")
for ex in mismatch_examples:
    print(f"  {ex}")
