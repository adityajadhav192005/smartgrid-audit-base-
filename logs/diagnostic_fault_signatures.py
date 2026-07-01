"""Trace fault residuals to understand detector tuning."""
import os, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["SMARTGRID_AUDIT_PROTECTION_WINDOW"] = "0"

from collections import defaultdict
from smartgrid_mas.run_all import build_agent_pool, ENV_CFG
from smartgrid_mas.environment.grid_env import GridEnvironment
from smartgrid_mas.environment.scenario_engine import ScenarioEngine, ScenarioConfig
from smartgrid_mas.data.cyber_attacks import AttackConfig, AttackType
from smartgrid_mas.data.synthetic_faults import FaultConfig, FaultType

agents = build_agent_pool(100, seed=42)
cfg = ScenarioConfig(mitm_rate=0.03, audit_protection_window=0)
scenario = ScenarioEngine(agents, cfg)
env = GridEnvironment(agents, ENV_CFG, scenario=scenario,
                      attack_cfg=AttackConfig(), fault_cfg=FaultConfig())

by_type = defaultdict(list)
for t in range(288):
    obs, truth = env.step(t)
    for a in agents:
        x, y = obs[a.agent_id]
        atk = env.last_attacks.get(a.agent_id, AttackType.NONE)
        flt = env.last_faults.get(a.agent_id, FaultType.NONE)
        if flt != FaultType.NONE:
            gt = f"FAULT_{flt.name}"
        elif atk == AttackType.FDI:
            gt = "FDI"
        else:
            continue
        residual = x - a.bx
        z = residual / np.maximum(a.thx, 1e-6)
        by_type[gt].append((z[0], z[1], z[2]))

for gt, samples in sorted(by_type.items()):
    arr = np.array(samples)
    print(f"{gt}  n={len(arr)}")
    print(f"  z[0]: mean={arr[:,0].mean():+.2f} p50={np.median(arr[:,0]):+.2f} p10={np.percentile(arr[:,0],10):+.2f} p90={np.percentile(arr[:,0],90):+.2f}")
    print(f"  z[1]: mean={arr[:,1].mean():+.2f} p50={np.median(arr[:,1]):+.2f} p10={np.percentile(arr[:,1],10):+.2f} p90={np.percentile(arr[:,1],90):+.2f}")
    print(f"  z[2]: mean={arr[:,2].mean():+.2f} p50={np.median(arr[:,2]):+.2f} p10={np.percentile(arr[:,2],10):+.2f} p90={np.percentile(arr[:,2],90):+.2f}")
