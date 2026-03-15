from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from smartgrid_mas.anomaly_detection.inference import LSTMInferencer


def _load_xy(df: pd.DataFrame, label_col: str | None) -> tuple[np.ndarray, np.ndarray | None, list[str]]:
    if label_col and label_col in df.columns:
        y = pd.to_numeric(df[label_col], errors="coerce").fillna(0.0).to_numpy(dtype=np.float32)
        x_df = df.drop(columns=[label_col])
    else:
        y = None
        x_df = df.copy()

    x_df = x_df.select_dtypes(include=[np.number]).copy()
    if x_df.shape[1] == 0:
        raise ValueError("No numeric features found in input file")

    x = x_df.replace([np.inf, -np.inf], np.nan).fillna(x_df.median(numeric_only=True)).to_numpy(dtype=np.float32)
    return x, y, list(x_df.columns)


def _adapt_features(x: np.ndarray, feature_names: list[str], target_dim: int) -> tuple[np.ndarray, list[str]]:
    if x.shape[1] == target_dim:
        return x, feature_names
    if x.shape[1] > target_dim:
        return x[:, :target_dim], feature_names[:target_dim]

    pad_cols = target_dim - x.shape[1]
    x_pad = np.concatenate([x, np.zeros((x.shape[0], pad_cols), dtype=np.float32)], axis=1)
    names_pad = feature_names + [f"pad_{i}" for i in range(pad_cols)]
    return x_pad, names_pad


def _build_windows(x: np.ndarray, y: np.ndarray | None, window: int) -> tuple[np.ndarray, np.ndarray | None, np.ndarray]:
    if x.shape[0] < window:
        raise ValueError(f"Need at least {window} rows, found {x.shape[0]}")

    windows = []
    labels = []
    end_idx = []
    for i in range(window - 1, x.shape[0]):
        windows.append(x[i - window + 1 : i + 1])
        end_idx.append(i)
        if y is not None:
            labels.append(float(y[i]))

    xw = np.asarray(windows, dtype=np.float32)
    yw = np.asarray(labels, dtype=np.float32) if y is not None else None
    return xw, yw, np.asarray(end_idx, dtype=np.int32)


def main() -> None:
    parser = argparse.ArgumentParser(description="Export SHAP-based explanations for LSTM anomaly predictions")
    parser.add_argument("--input", required=True, help="Path to prepared CSV/Parquet (e.g., uci_grid_stability_prepared.csv)")
    parser.add_argument("--model", default="smartgrid_mas/data/anomaly_inputs/lstm.pt", help="Path to trained LSTM checkpoint")
    parser.add_argument("--output", default="logs/audit_explanations.csv", help="Output CSV path")
    parser.add_argument("--label-col", default="stabf", help="Label column in input file")
    parser.add_argument("--window", type=int, default=24, help="Window size (overrides checkpoint window if >0)")
    parser.add_argument("--background", type=int, default=80, help="Background sample count for KernelExplainer")
    parser.add_argument("--samples", type=int, default=200, help="Number of windows to explain")
    parser.add_argument("--nsamples", type=int, default=100, help="Kernel SHAP nsamples")
    parser.add_argument("--agent-count", type=int, default=500, help="Pseudo agent_id mapping count for exported rows")
    args = parser.parse_args()

    try:
        import shap  # type: ignore[import-not-found]
    except Exception as e:
        raise RuntimeError("SHAP is required. Install with: pip install shap") from e

    inp = Path(args.input)
    if not inp.exists():
        raise FileNotFoundError(f"Input file not found: {inp}")

    if inp.suffix.lower() in {".csv", ".txt"}:
        df = pd.read_csv(inp)
    elif inp.suffix.lower() in {".parquet", ".pq"}:
        df = pd.read_parquet(inp)
    else:
        raise ValueError(f"Unsupported input format: {inp.suffix}")

    infer = LSTMInferencer(model_path=args.model)
    window = int(args.window) if int(args.window) > 0 else int(infer.window or 24)

    x, y, feat_names = _load_xy(df, args.label_col)
    x, feat_names = _adapt_features(x, feat_names, infer.input_size)
    xw, yw, end_idx = _build_windows(x, y, window)

    n_total = xw.shape[0]
    rng = np.random.default_rng(42)

    bsz = min(max(10, int(args.background)), n_total)
    bg_ids = rng.choice(n_total, size=bsz, replace=False)

    esz = min(max(1, int(args.samples)), n_total)
    explain_ids = rng.choice(n_total, size=esz, replace=False)

    xw_bg = xw[bg_ids]
    xw_explain = xw[explain_ids]
    y_explain = yw[explain_ids] if yw is not None else None
    end_explain = end_idx[explain_ids]

    fdim = xw.shape[2]

    def model_fn(x_flat: np.ndarray) -> np.ndarray:
        x_flat = np.asarray(x_flat, dtype=np.float32)
        x_3d = x_flat.reshape((-1, window, fdim))
        probs = infer.predict_proba_batch([x_3d[i] for i in range(x_3d.shape[0])])
        return np.asarray(probs, dtype=np.float64)

    bg_flat = xw_bg.reshape((xw_bg.shape[0], window * fdim))
    ex_flat = xw_explain.reshape((xw_explain.shape[0], window * fdim))

    explainer = shap.KernelExplainer(model_fn, bg_flat)
    shap_values = explainer.shap_values(ex_flat, nsamples=int(args.nsamples))

    if isinstance(shap_values, list):
        sv = np.asarray(shap_values[0], dtype=np.float64)
    else:
        sv = np.asarray(shap_values, dtype=np.float64)

    probs = np.asarray(model_fn(ex_flat), dtype=np.float64)

    rows = []
    for i in range(len(ex_flat)):
        sv_i = sv[i].reshape((window, fdim))
        per_feature = np.mean(np.abs(sv_i), axis=0)
        order = np.argsort(-per_feature)

        top = []
        for j in order[:3]:
            top.append({"feature": feat_names[j], "importance": float(per_feature[j])})

        agent_id = str(int(end_explain[i]) % max(1, int(args.agent_count)))
        row = {
            "agent_id": agent_id,
            "window_end_t": int(end_explain[i]),
            "pred_proba": float(probs[i]),
            "label": float(y_explain[i]) if y_explain is not None else np.nan,
            "shap_total_abs": float(np.sum(np.abs(sv_i))),
            "top_features_json": json.dumps(top),
            "top_feature_1": top[0]["feature"] if len(top) > 0 else None,
            "top_feature_1_value": top[0]["importance"] if len(top) > 0 else None,
            "top_feature_2": top[1]["feature"] if len(top) > 1 else None,
            "top_feature_2_value": top[1]["importance"] if len(top) > 1 else None,
            "top_feature_3": top[2]["feature"] if len(top) > 2 else None,
            "top_feature_3_value": top[2]["importance"] if len(top) > 2 else None,
        }
        rows.append(row)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(out, index=False)

    print(f"Saved SHAP explanations: {out}")
    print(f"Rows: {len(rows)} | Window: {window} | Features: {fdim}")


if __name__ == "__main__":
    main()
