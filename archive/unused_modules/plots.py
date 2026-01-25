"""
Plotting utilities for simulation results

Quick visualization of time series metrics.
"""

from __future__ import annotations
from typing import List, Dict, Any
import matplotlib.pyplot as plt


def plot_metric(records: List[Dict[str, Any]], key: str, title: str, save_path: str | None = None) -> None:
    """
    Plot a single metric over time.
    
    Args:
        records: Metrics records with 't' and target key
        key: Metric key to plot
        title: Plot title
        save_path: Optional path to save figure
    """
    xs = [r["t"] for r in records]
    ys = [r.get(key, 0.0) for r in records]
    
    plt.figure(figsize=(10, 6))
    plt.plot(xs, ys)
    plt.title(title)
    plt.xlabel("Timestep")
    plt.ylabel(key)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path)
        print(f"Saved plot to {save_path}")
    else:
        plt.show()


def plot_comparison(
    dynamic_records: List[Dict[str, Any]],
    baseline_records: List[Dict[str, Any]],
    key: str,
    title: str,
    save_path: str | None = None,
) -> None:
    """
    Plot dynamic vs baseline comparison.
    
    Args:
        dynamic_records: Dynamic scheduler metrics
        baseline_records: Baseline metrics
        key: Metric key to compare
        title: Plot title
        save_path: Optional path to save figure
    """
    xs_dyn = [r["t"] for r in dynamic_records]
    ys_dyn = [r.get(key, 0.0) for r in dynamic_records]
    
    xs_base = [r["t"] for r in baseline_records]
    ys_base = [r.get(key, 0.0) for r in baseline_records]
    
    plt.figure(figsize=(10, 6))
    plt.plot(xs_dyn, ys_dyn, label="Dynamic", linewidth=2)
    plt.plot(xs_base, ys_base, label="Baseline (Fixed)", linewidth=2, linestyle="--")
    plt.title(title)
    plt.xlabel("Timestep")
    plt.ylabel(key)
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path)
        print(f"Saved comparison plot to {save_path}")
    else:
        plt.show()
