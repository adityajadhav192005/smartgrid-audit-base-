from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "Diagram"
OUT_DIR.mkdir(exist_ok=True)


def style_axes(ax):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.25)


def save(fig, name):
    path = OUT_DIR / name
    fig.tight_layout()
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def generate_metric_comparison():
    metrics = ["Cost Efficiency", "Audit Coverage", "Accuracy", "Risk Mitigation"]
    base = np.array([42.5, 93.8, 98.4, 87.9])
    proposed = np.array([54.83, 100.0, 99.14, 95.93])

    x = np.arange(len(metrics))
    width = 0.35

    fig, ax = plt.subplots(figsize=(10.5, 5.8))
    ax.bar(x - width / 2, base, width, label="Base Paper", color="#8b93a6")
    ax.bar(x + width / 2, proposed, width, label="Proposed System (N=100)", color="#19b5fe")
    ax.set_ylabel("Percentage (%)")
    ax.set_title("Base Paper vs Proposed System: Primary Operational Metrics")
    ax.set_xticks(x)
    ax.set_xticklabels(metrics, rotation=12, ha="right")
    ax.set_ylim(0, 110)
    style_axes(ax)
    ax.legend(frameon=False)

    for xpos, val in zip(x - width / 2, base):
        ax.text(xpos, val + 1.2, f"{val:.1f}%", ha="center", va="bottom", fontsize=9)
    for xpos, val in zip(x + width / 2, proposed):
        ax.text(xpos, val + 1.2, f"{val:.2f}%" if val != 100 else "100%", ha="center", va="bottom", fontsize=9)

    return save(fig, "basepaper_vs_project_metrics.png")


def generate_capability_matrix():
    rows = [
        "Anomaly + audit coupling",
        "Live SCADA integration",
        "Experiment/live separation",
        "Explainable live decisions",
        "Operator dashboard workflow",
        "100-agent live validation",
    ]
    base_vals = ["Yes", "No", "No", "Limited", "Limited", "No"]
    prop_vals = ["Yes", "Yes", "Yes", "Yes", "Yes", "Yes"]

    fig, ax = plt.subplots(figsize=(11.2, 4.8))
    ax.axis("off")
    table_data = [[r, b, p] for r, b, p in zip(rows, base_vals, prop_vals)]
    table = ax.table(
        cellText=table_data,
        colLabels=["Capability", "Base Paper", "Proposed System"],
        loc="center",
        cellLoc="center",
        colLoc="center",
        colWidths=[0.50, 0.20, 0.25],
    )
    table.auto_set_font_size(False)
    table.set_fontsize(11)
    table.scale(1, 1.8)

    for (row, col), cell in table.get_celld().items():
        if row == 0:
            cell.set_text_props(weight="bold", color="black")
            cell.set_facecolor("#dbe7f3")
        elif col == 0:
            cell.set_facecolor("#f7f9fc")
        else:
            text = cell.get_text().get_text()
            if text == "Yes":
                cell.set_facecolor("#d9f7df")
            elif text == "No":
                cell.set_facecolor("#fde2e1")
            else:
                cell.set_facecolor("#fff1cc")

    ax.set_title("Capability Comparison: Base Paper vs Proposed Framework", fontsize=14, pad=14)
    return save(fig, "basepaper_extension_matrix.png")


def generate_timeline():
    phases = [
        "Phase 1\nArchitecture Design",
        "Phase 2\nScoring + Audit Logic",
        "Phase 3\nRapid SCADA Integration",
        "Phase 4\nDashboard + Validation",
    ]
    y = [1, 1, 1, 1]
    x = np.arange(1, 5)

    fig, ax = plt.subplots(figsize=(10.8, 2.9))
    ax.hlines(1, 0.8, 4.2, color="#4a5568", linewidth=2)
    colors = ["#8ecae6", "#ffb703", "#219ebc", "#90be6d"]
    ax.scatter(x, y, s=900, c=colors, zorder=3, edgecolors="black", linewidths=0.8)

    for xpos, label in zip(x, phases):
        ax.text(xpos, 1.18, label, ha="center", va="bottom", fontsize=10, weight="bold")

    ax.text(1, 0.78, "Initial framework", ha="center", fontsize=9)
    ax.text(2, 0.78, "Working anomaly module", ha="center", fontsize=9)
    ax.text(3, 0.78, "Live SCADA path", ha="center", fontsize=9)
    ax.text(4, 0.78, "Operational prototype", ha="center", fontsize=9)

    ax.set_title("Development Progress of the SmartGrid AI Audit Framework", fontsize=14, pad=10)
    ax.set_xlim(0.6, 4.4)
    ax.set_ylim(0.55, 1.45)
    ax.axis("off")
    return save(fig, "development_timeline.png")


def main():
    generated = [
        generate_metric_comparison(),
        generate_capability_matrix(),
        generate_timeline(),
    ]
    for path in generated:
        print(path)


if __name__ == "__main__":
    main()
