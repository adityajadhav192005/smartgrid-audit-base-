from __future__ import annotations

import argparse
import csv
import itertools
import json
import os
import subprocess
import sys
from pathlib import Path


def _parse_float_list(raw: str) -> list[float]:
    return [float(x.strip()) for x in raw.split(",") if x.strip()]


def _summary_path(log_root: Path, n_agents: int) -> Path:
    return log_root / f"N{n_agents}" / "summary.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Sweep detection thresholds and hybrid weights for F1 tuning.")
    parser.add_argument("--n-agents", type=int, default=100)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--score-thresholds", default="2.55,2.70,2.85,3.00")
    parser.add_argument("--prob-thresholds", default="0.90,0.93,0.95")
    parser.add_argument("--prob-weights", default="0.50,0.55,0.60")
    parser.add_argument("--detector-sensitivities", default="1.02,1.05")
    parser.add_argument("--persist-bonuses", default="0.10,0.14")
    parser.add_argument("--output", default="logs/f1_sweep_results.csv")
    args = parser.parse_args()

    score_thresholds = _parse_float_list(args.score_thresholds)
    prob_thresholds = _parse_float_list(args.prob_thresholds)
    prob_weights = _parse_float_list(args.prob_weights)
    detector_sensitivities = _parse_float_list(args.detector_sensitivities)
    persist_bonuses = _parse_float_list(args.persist_bonuses)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    log_root = Path("logs")

    rows: list[dict[str, float | int | str]] = []

    grid = itertools.product(
        score_thresholds,
        prob_thresholds,
        prob_weights,
        detector_sensitivities,
        persist_bonuses,
    )

    for idx, (score_th, prob_th, w_prob, sensitivity, persist_bonus) in enumerate(grid, start=1):
        w_dev = max(0.0, 1.0 - w_prob)
        env = os.environ.copy()
        env["SMARTGRID_NUM_AGENTS"] = str(args.n_agents)
        env["SMARTGRID_SEEDS"] = str(args.seed)
        env["SMARTGRID_SCORE_THRESHOLD"] = str(score_th)
        env["SMARTGRID_ANOMALY_PROB_THRESHOLD"] = str(prob_th)
        env["SMARTGRID_HYBRID_W_DEV"] = f"{w_dev:.4f}"
        env["SMARTGRID_HYBRID_W_PROB"] = f"{w_prob:.4f}"
        env["SMARTGRID_DETECTION_SENSITIVITY"] = str(sensitivity)
        env["SMARTGRID_DETECTION_PERSISTENCE_BONUS"] = str(persist_bonus)

        print(
            f"[{idx}] score={score_th:.2f} prob={prob_th:.2f} "
            f"w_dev={w_dev:.2f} w_prob={w_prob:.2f} sens={sensitivity:.2f} persist={persist_bonus:.2f}"
        )
        subprocess.run([sys.executable, "-m", "smartgrid_mas.run_all"], env=env, check=True)

        summary_path = _summary_path(log_root, args.n_agents)
        if not summary_path.exists():
            raise FileNotFoundError(f"Expected summary file not found: {summary_path}")

        with summary_path.open("r", encoding="utf-8") as fh:
            summary = json.load(fh)

        row = {
            "score_threshold": score_th,
            "prob_threshold": prob_th,
            "w_dev": w_dev,
            "w_prob": w_prob,
            "detector_sensitivity": sensitivity,
            "persistence_bonus": persist_bonus,
            "f1": float(summary.get("f1", 0.0)),
            "recall": float(summary.get("recall", 0.0)),
            "precision": float(summary.get("precision", 0.0)),
            "accuracy": float(summary.get("accuracy", 0.0)),
            "risk_mitigation": float(summary.get("risk_mitigation", 0.0)),
            "cost_efficiency": float(summary.get("cost_efficiency", 0.0)),
        }
        rows.append(row)

    rows.sort(key=lambda item: (float(item["f1"]), float(item["recall"]), float(item["precision"])), reverse=True)

    with output_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "score_threshold",
                "prob_threshold",
                "w_dev",
                "w_prob",
                "detector_sensitivity",
                "persistence_bonus",
                "f1",
                "recall",
                "precision",
                "accuracy",
                "risk_mitigation",
                "cost_efficiency",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    print("\nTop 5 settings by F1")
    for rank, row in enumerate(rows[:5], start=1):
        print(
            f"{rank}. f1={row['f1']:.4f} recall={row['recall']:.4f} precision={row['precision']:.4f} "
            f"score={row['score_threshold']:.2f} prob={row['prob_threshold']:.2f} "
            f"w_prob={row['w_prob']:.2f} sens={row['detector_sensitivity']:.2f} "
            f"persist={row['persistence_bonus']:.2f}"
        )
    print(f"\nSaved sweep results to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
