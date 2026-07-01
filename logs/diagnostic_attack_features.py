"""Diagnostic: capture what detectors see for each ground-truth attack type."""
import os, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["SMARTGRID_AUDIT_PROTECTION_WINDOW"] = "0"

from collections import defaultdict
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentType, AgentCriticality
from smartgrid_mas.environment.grid_env import GridEnvironment, GridEnvConfig
from smartgrid_mas.environment.scenario_engine import ScenarioEngine, ScenarioConfig
from smartgrid_mas.data.cyber_attacks import AttackConfig, AttackType
from smartgrid_mas.data.synthetic_faults import FaultConfig
from smartgrid_mas.detection.multilayer_detection import (
    network_dos_detector, integrity_mitm_detector, cusum_fdi_detector
)

np.random.seed(42)

N_AGENTS = 100
ENV_CFG = GridEnvConfig(seed=42)

agent_types_dist = (
    [AgentType.GENERATOR] * 20
    + [AgentType.SUBSTATION] * 30
    + [AgentType.PMU] * 25
    + [AgentType.BREAKER] * 25
)
agents = []
for i, at in enumerate(agent_types_dist[:N_AGENTS]):
    _by = np.array([ENV_CFG.base_latency_ms, ENV_CFG.base_packet_loss,
                     ENV_CFG.base_integrity, ENV_CFG.base_comm_freq_hz])
    _thy = np.array([ENV_CFG.base_latency_ms * 0.15, max(0.005, ENV_CFG.base_packet_loss * 3.0),
                      0.02, ENV_CFG.base_comm_freq_hz * 0.10])
    a = BaseAgent(
        agent_id=str(i), agent_type=at,
        criticality=AgentCriticality(weight=1.0),
        bx=np.ones(ENV_CFG.phys_dim) * 1.0,
        by=_by,
        thx=np.ones(ENV_CFG.phys_dim) * 0.15,
        thy=_thy,
    )
    agents.append(a)

cfg = ScenarioConfig(mitm_rate=0.03, audit_protection_window=0)
scenario = ScenarioEngine(agents, cfg)
attack_cfg = AttackConfig()
fault_cfg = FaultConfig()
env = GridEnvironment(agents, ENV_CFG, scenario=scenario, attack_cfg=attack_cfg, fault_cfg=fault_cfg)

features_by_type = defaultdict(list)
dos_detector_results = defaultdict(list)
mitm_detector_results = defaultdict(list)
fdi_detector_results = defaultdict(list)

STEPS = 100
for t in range(STEPS):
    obs, truth = env.step(t)
    attacks = env.last_attacks

    for agent in agents:
        aid = agent.agent_id
        atk = attacks.get(aid, AttackType.NONE)
        attack_type = atk.name if hasattr(atk, 'name') else str(atk)

        x_phys, y_cyber = obs[aid]

        agent.observe(x_phys, y_cyber)

        by = agent.by
        thy = agent.thy

        latency_ratio = float(y_cyber[0]) / max(1e-3, float(by[0]))
        packet_loss = float(y_cyber[1])
        base_integrity = max(1e-3, float(by[2]))
        integrity_drop = max(0.0, (base_integrity - float(y_cyber[2])) / base_integrity)
        base_cf = max(1e-3, float(by[3]))
        comm_drop = max(0.0, 1.0 - float(y_cyber[3]) / base_cf)

        cyber_norm = np.abs(y_cyber - by) / np.maximum(thy, 1e-6)
        phys_norm = np.abs(x_phys - agent.bx) / np.maximum(agent.thx, 1e-6)

        features_by_type[attack_type].append({
            "latency_ratio": latency_ratio,
            "packet_loss": packet_loss,
            "integrity_drop": integrity_drop,
            "comm_drop": comm_drop,
            "cyber_norm_latency": float(cyber_norm[0]),
            "cyber_norm_pktloss": float(cyber_norm[1]),
            "cyber_norm_integrity": float(cyber_norm[2]),
            "cyber_norm_comm": float(cyber_norm[3]),
            "phys_peak": float(np.max(phys_norm)),
            "cyber_peak": float(np.max(cyber_norm)),
        })

        dos_result = network_dos_detector(y_cyber, by)
        mitm_result = integrity_mitm_detector(y_cyber, by, y_history=agent.y_history)
        fdi_result = cusum_fdi_detector(agent.x_history, agent.bx, scale=agent.thx)

        dos_detector_results[attack_type].append({
            "fired": dos_result.fired,
            "confidence": dos_result.confidence,
            "reason": dos_result.reason,
        })
        mitm_detector_results[attack_type].append({
            "fired": mitm_result.fired,
            "confidence": mitm_result.confidence,
            "reason": mitm_result.reason,
        })
        fdi_detector_results[attack_type].append({
            "fired": fdi_result.fired,
            "confidence": fdi_result.confidence,
            "reason": fdi_result.reason,
        })

print("=" * 80)
print("FEATURE DISTRIBUTIONS BY GROUND-TRUTH ATTACK TYPE")
print("=" * 80)

for atype in ["NONE", "FDI", "DOS", "MITM"]:
    feats = features_by_type.get(atype, [])
    if not feats:
        continue

    print(f"\n{'='*70}")
    print(f"  {atype}  (n={len(feats)} events)")
    print(f"{'='*70}")

    for key in ["latency_ratio", "packet_loss", "integrity_drop", "comm_drop",
                 "cyber_norm_latency", "cyber_norm_pktloss", "cyber_norm_integrity",
                 "cyber_norm_comm", "phys_peak", "cyber_peak"]:
        vals = [f[key] for f in feats]
        print(f"  {key:25s}  mean={np.mean(vals):8.4f}  std={np.std(vals):8.4f}  "
              f"min={np.min(vals):8.4f}  p50={np.median(vals):8.4f}  "
              f"p95={np.percentile(vals, 95):8.4f}  max={np.max(vals):8.4f}")

    dos_fires = [d["fired"] for d in dos_detector_results.get(atype, [])]
    mitm_fires = [d["fired"] for d in mitm_detector_results.get(atype, [])]
    fdi_fires = [d["fired"] for d in fdi_detector_results.get(atype, [])]
    dos_rate = sum(dos_fires) / len(dos_fires) * 100 if dos_fires else 0
    mitm_rate = sum(mitm_fires) / len(mitm_fires) * 100 if mitm_fires else 0
    fdi_rate = sum(fdi_fires) / len(fdi_fires) * 100 if fdi_fires else 0
    print(f"  {'DoS detector fire rate':25s}  {dos_rate:.1f}%")
    print(f"  {'MITM detector fire rate':25s}  {mitm_rate:.1f}%")
    print(f"  {'FDI detector fire rate':25s}  {fdi_rate:.1f}%")

    # Show some example reasons
    dos_reasons = [d["reason"] for d in dos_detector_results.get(atype, []) if d["fired"]]
    mitm_reasons = [d["reason"] for d in mitm_detector_results.get(atype, []) if d["fired"]]
    fdi_reasons = [d["reason"] for d in fdi_detector_results.get(atype, []) if d["fired"]]
    if dos_reasons:
        print(f"  {'DoS example reason':25s}  {dos_reasons[0]}")
    if mitm_reasons:
        print(f"  {'MITM example reason':25s}  {mitm_reasons[0]}")
    if fdi_reasons:
        print(f"  {'FDI example reason':25s}  {fdi_reasons[0]}")

print("\n" + "=" * 80)
print("CROSS-FIRE ANALYSIS: Which detector fires for which attack type?")
print("=" * 80)
for atype in ["NONE", "FDI", "DOS", "MITM"]:
    n = len(dos_detector_results.get(atype, []))
    if n == 0:
        continue
    dos_f = sum(1 for d in dos_detector_results[atype] if d["fired"])
    mitm_f = sum(1 for d in mitm_detector_results[atype] if d["fired"])
    fdi_f = sum(1 for d in fdi_detector_results[atype] if d["fired"])
    both_dm = sum(1 for d, m in zip(dos_detector_results[atype], mitm_detector_results[atype]) if d["fired"] and m["fired"])
    none_f = sum(1 for d, m, f in zip(dos_detector_results[atype], mitm_detector_results[atype], fdi_detector_results[atype])
                 if not d["fired"] and not m["fired"] and not f["fired"])
    print(f"  {atype:6s} (n={n:5d}): DoS={dos_f:4d}({100*dos_f/n:5.1f}%)  MITM={mitm_f:4d}({100*mitm_f/n:5.1f}%)  "
          f"FDI={fdi_f:4d}({100*fdi_f/n:5.1f}%)  Both_D+M={both_dm:4d}  None={none_f:4d}({100*none_f/n:5.1f}%)")

print("\n\nDONE")
