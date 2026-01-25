"""
Evaluation metrics for anomaly detection

Implements precision, recall, F1 without sklearn dependency.
"""

from __future__ import annotations
from typing import Dict
import numpy as np


def prf1(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """
    Compute precision, recall, F1 from ground truth and predictions.
    
    Args:
        y_true: Ground truth binary labels (0/1)
        y_pred: Predicted binary labels (0/1)
    
    Returns:
        Dict with precision, recall, f1, tp, fp, fn
    
    Handles edge cases where no positives exist.
    """
    yt = np.asarray(y_true).astype(int).reshape(-1)
    yp = np.asarray(y_pred).astype(int).reshape(-1)
    
    if yt.shape != yp.shape:
        raise ValueError("y_true and y_pred must have same shape")
    
    tp = int(np.sum((yt == 1) & (yp == 1)))
    fp = int(np.sum((yt == 0) & (yp == 1)))
    fn = int(np.sum((yt == 1) & (yp == 0)))
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    
    return {
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "tp": float(tp),
        "fp": float(fp),
        "fn": float(fn),
    }
