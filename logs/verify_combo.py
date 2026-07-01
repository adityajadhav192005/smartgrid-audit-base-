"""Verify combo (CUSUM gate + corroboration) across multiple seeds."""
import os, sys
os.environ["SMARTGRID_AUDIT_PROTECTION_WINDOW"] = "0"
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from collections import Counter
from smartgrid_mas.run_all import build_agent_pool, LSTM_MODEL_PATH, NETWORK_LSTM_MODEL_PATH
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.simulation.run_simulation import run_simulation_24h

lstm_infer = LSTMInferencer(model_path=LSTM_MODEL_PATH)
try:
    net_infer = LSTMInferencer(model_path=NETWORK_LSTM_MODEL_PATH)
except Exception:
    net_infer = None

for seed in (42, 43, 44):
    agents = build_agent_pool(200, seed=seed)
    result = run_simulation_24h(
        agents=agents,
        lstm_infer=lstm_infer,
        network_lstm_infer=net_infer,
        audit_protection_window=0,
    )
    events, audit_events, y_true, y_pred, y_pred_types, y_true_types = result[:6]

    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    recall = tp / (tp + fn) if tp + fn else 0
    prec = tp / (tp + fp) if tp + fp else 0
    fpr = fp / (fp + tn) if fp + tn else 0

    true_counts = Counter(y_true_types)
    per_tpr = {}
    for at in ("FDI", "DOS", "MITM", "FAULT"):
        tp_a = sum(1 for t, p in zip(y_true_types, y_pred_types) if t == at and p == at)
        per_tpr[at] = tp_a / true_counts[at] if true_counts.get(at) else 0

    print(f"seed={seed}  Rec={recall:.4f}  Prec={prec:.4f}  FPR={fpr:.4f}  "
          f"FDI={per_tpr['FDI']:.4f}  DOS={per_tpr['DOS']:.4f}  "
          f"MITM={per_tpr['MITM']:.4f}  FAULT={per_tpr['FAULT']:.4f}")
