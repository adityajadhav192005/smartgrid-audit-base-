"""Diagnostic: run full simulation and check per-attack TPR directly."""
import os, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["SMARTGRID_AUDIT_PROTECTION_WINDOW"] = "0"

from collections import Counter
from smartgrid_mas.run_all import build_agent_pool, ENV_CFG, LSTM_MODEL_PATH, NETWORK_LSTM_MODEL_PATH
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.simulation.run_simulation import run_simulation_24h

N_AGENTS = 200
agents = build_agent_pool(N_AGENTS, seed=42)

print("Loading LSTM models...")
lstm_infer = LSTMInferencer(model_path=LSTM_MODEL_PATH)
try:
    net_infer = LSTMInferencer(model_path=NETWORK_LSTM_MODEL_PATH)
except Exception:
    net_infer = None

print(f"Running simulation with {N_AGENTS} agents...")
result = run_simulation_24h(
    agents=agents,
    lstm_infer=lstm_infer,
    network_lstm_infer=net_infer,
    audit_protection_window=0,
)

# Unpack - result is a tuple
# (events, audit_events, y_true, y_pred, y_pred_types, y_true_types, ...)
events, audit_events, y_true, y_pred, y_pred_types, y_true_types = result[:6]

# Binary metrics
tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)

print(f"\nBinary: tp={tp} fp={fp} fn={fn} tn={tn}  total={tp+fp+fn+tn}")
print(f"  Binary positives (tp+fn)={tp+fn}")
print(f"  Recall={tp/(tp+fn) if tp+fn else 0:.4f}")
print(f"  Precision={tp/(tp+fp) if tp+fp else 0:.4f}")

# Per-attack type counts
print(f"\ny_true_types distribution:")
true_counts = Counter(y_true_types)
for k, v in sorted(true_counts.items()):
    print(f"  {k}: {v}")
per_attack_pos = sum(v for k, v in true_counts.items() if k != "NONE")
print(f"  Total non-NONE: {per_attack_pos}")

print(f"\ny_pred_types distribution:")
pred_counts = Counter(y_pred_types)
for k, v in sorted(pred_counts.items()):
    print(f"  {k}: {v}")

# Per-type TPR (one-vs-rest)
print(f"\nPer-type TPR:")
for attack_type in ["FDI", "DOS", "MITM", "FAULT"]:
    tp_type = sum(1 for t, p in zip(y_true_types, y_pred_types)
                  if t == attack_type and p == attack_type)
    total_type = true_counts.get(attack_type, 0)
    tpr = tp_type / total_type if total_type else 0
    pred_when_true = Counter(p for t, p in zip(y_true_types, y_pred_types)
                             if t == attack_type)
    print(f"  {attack_type}: TPR={tpr:.4f} ({tp_type}/{total_type})")
    print(f"    predicted as: {dict(pred_when_true.most_common())}")
