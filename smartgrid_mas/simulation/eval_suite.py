from __future__ import annotations

from typing import Any, Dict, List, Tuple
import os

import numpy as np
from scipy import stats
try:
    from sklearn.cluster import KMeans as _KMeans
    from sklearn.preprocessing import StandardScaler as _StandardScaler
    KMeans = _KMeans
    StandardScaler = _StandardScaler
    _SKLEARN_AVAILABLE = True
except Exception:
    KMeans = None  # type: ignore
    StandardScaler = None  # type: ignore
    _SKLEARN_AVAILABLE = False

"""Evaluation utilities for audit coverage, attack reduction, and significance tests."""

# Env toggles
_USE_EFFECTIVE = os.environ.get("SMARTGRID_USE_EFFECTIVE_ATTACK_RATE", "1").strip() not in ("0", "false", "False")
try:
    _WARMUP_STEPS = int(os.environ.get("SMARTGRID_ATTACK_RATE_WARMUP_STEPS", "0"))
except Exception:
    _WARMUP_STEPS = 0


def audit_coverage(audit_freq_history: Dict[str, List[int]]) -> float:
    """Compute fraction of agents audited at least once.
    
    Note: This checks assigned frequencies, not actual audit executions.
    For actual execution coverage, use coverage_from_ledger().
    """
    covered = 0
    total = len(audit_freq_history)
    for series in audit_freq_history.values():
        # Check if agent was assigned audit frequency > 0 at any timestep
        if np.any(np.asarray(series) > 0):
            covered += 1
    return float(covered / total) if total else 0.0


def total_audit_cost(metrics_records: List[Dict[str, Any]]) -> float:
    """Maximum cumulative spend observed (executed cost)."""
    if not metrics_records:
        return 0.0
    spends = [r.get("total_spend", 0.0) for r in metrics_records]
    return float(np.max(spends)) if spends else 0.0


def total_intended_cost(metrics_records: List[Dict[str, Any]]) -> float:
    """Sum intended audit cost across timesteps (ledger intent)."""
    if not metrics_records:
        return 0.0
    return float(np.sum([r.get("intended_spend", 0.0) for r in metrics_records]))


def mean_attack_rate(metrics_records: List[Dict[str, Any]]) -> float:
    if not metrics_records:
        return 0.0
    start = min(max(_WARMUP_STEPS, 0), len(metrics_records))
    vals: List[float] = []
    for r in metrics_records[start:]:
        v = r.get("attack_rate_effective") if _USE_EFFECTIVE else None
        if v is None:
            v = r.get("attack_rate", 0.0)
        vals.append(float(v))
    return float(np.mean(vals)) if vals else 0.0


def mean_global_risk(metrics_records: List[Dict[str, Any]]) -> float:
    """Compute mean global risk, preferring mitigation-aware effective risk.
    
    Checks for global_risk_effective (mitigation-aware) first, falls back to
    legacy global_risk field if effective risk not available.
    """
    if not metrics_records:
        return 0.0
    # Prefer global_risk_effective (accounts for audit mitigation outcomes)
    has_effective = any("global_risk_effective" in r and r["global_risk_effective"] is not None 
                        for r in metrics_records)
    if has_effective:
        return float(np.mean([r.get("global_risk_effective", r.get("global_risk", 0.0)) 
                              for r in metrics_records]))
    # Fallback to legacy global_risk
    return float(np.mean([r.get("global_risk", 0.0) for r in metrics_records]))


def mean_global_risk_raw(metrics_records: List[Dict[str, Any]]) -> float:
    """Mean of RAW global_risk (before any audit mitigation) across records.

    Used as the 'initial' term in the paper-aligned risk mitigation formula:
        Risk Mitigation = (raw_risk - effective_risk) / raw_risk
    This is the global_risk field which equals sum(w_i * a_i) before dampening.
    """
    if not metrics_records:
        return 0.0
    return float(np.mean([r.get("global_risk", 0.0) for r in metrics_records]))


def attack_rate_reduction(dynamic_records: List[Dict[str, Any]], baseline_records: List[Dict[str, Any]]) -> float:
    baseline = mean_attack_rate(baseline_records)
    dynamic = mean_attack_rate(dynamic_records)
    if baseline == 0:
        return 0.0
    return float((baseline - dynamic) / baseline)


def cost_efficiency(dynamic_cost: float, baseline_cost: float) -> float:
    if baseline_cost == 0:
        return 0.0
    return float((baseline_cost - dynamic_cost) / baseline_cost)


def coverage_from_ledger(ledger, total_agents: int) -> float:
    """Compute true audit coverage from ledger events."""
    return ledger.coverage(total_agents)


def prf1(y_true: List[int], y_pred: List[int]) -> Dict[str, float]:
    if not y_true or not y_pred:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}

    y_true_arr = np.asarray(y_true, dtype=int)
    y_pred_arr = np.asarray(y_pred, dtype=int)

    tp = np.sum((y_true_arr == 1) & (y_pred_arr == 1))
    fp = np.sum((y_true_arr == 0) & (y_pred_arr == 1))
    fn = np.sum((y_true_arr == 1) & (y_pred_arr == 0))

    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    f1 = float(2 * (precision * recall) / (precision + recall)) if (precision + recall) > 0 else 0.0

    return {"precision": precision, "recall": recall, "f1": f1}


def confusion_matrix(y_true: List[int], y_pred: List[int]) -> Dict[str, float]:
    if not y_true or not y_pred:
        return {"tp": 0.0, "tn": 0.0, "fp": 0.0, "fn": 0.0, "tpr": 0.0, "tnr": 0.0, "fpr": 0.0, "fnr": 0.0, "accuracy": 0.0}

    y_true_arr = np.asarray(y_true, dtype=int)
    y_pred_arr = np.asarray(y_pred, dtype=int)

    tp = np.sum((y_true_arr == 1) & (y_pred_arr == 1))
    tn = np.sum((y_true_arr == 0) & (y_pred_arr == 0))
    fp = np.sum((y_true_arr == 0) & (y_pred_arr == 1))
    fn = np.sum((y_true_arr == 1) & (y_pred_arr == 0))

    tpr = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    tnr = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    fpr = float(fp / (tn + fp)) if (tn + fp) > 0 else 0.0
    fnr = float(fn / (tp + fn)) if (tp + fn) > 0 else 0.0
    accuracy = float((tp + tn) / (tp + tn + fp + fn)) if (tp + tn + fp + fn) > 0 else 0.0

    return {
        "tp": float(tp),
        "tn": float(tn),
        "fp": float(fp),
        "fn": float(fn),
        "tpr": tpr,
        "tnr": tnr,
        "fpr": fpr,
        "fnr": fnr,
        "accuracy": accuracy,
    }


def per_attack_confusion(y_true_types: List[str], y_pred_input) -> Dict[str, Dict[str, float]]:
    """
    Calculate per-attack type metrics (TPR, TNR, FPR, FNR, accuracy).
    
    Args:
        y_true_types: List of true attack types (ground truth)
        y_pred_input: Either list of attack type strings OR list of binary flags (0/1)
                      - If strings: matches by attack type (TP = correct type prediction)
                      - If ints: legacy binary (TP = detected any anomaly, ignoring type)
    
    Returns:
        Dict mapping attack type -> {'tpr', 'tnr', 'fpr', 'fnr', 'accuracy'}
    """
    types = ["FDI", "DOS", "MITM", "CHAIN", "FAULT", "NONE"]
    out: Dict[str, Dict[str, float]] = {}
    if not y_true_types or not y_pred_input or len(y_true_types) != len(y_pred_input):
        for t in types:
            out[t] = {"tpr": 0.0, "tnr": 0.0, "fpr": 0.0, "fnr": 0.0, "accuracy": 0.0}
        return out

    def _norm_label(v: Any) -> str:
        s = str(v).strip().upper()
        if s in {"DOS", "DO-S", "DENIAL_OF_SERVICE", "DENIAL-OF-SERVICE"}:
            return "DOS"
        return s

    y_types = np.asarray([_norm_label(v) for v in y_true_types], dtype=object)
    
    # Detect input type: list of strings (attack types) vs list of ints (binary flags)
    is_type_prediction = isinstance(y_pred_input[0], str) if y_pred_input else False
    
    if is_type_prediction:
        # Attack type predictions: y_pred is list of predicted attack types
        y_pred_arr = np.asarray([_norm_label(v) for v in y_pred_input], dtype=object)
        
        for t in types:
            y_true_bin = (y_types == t).astype(int)
            y_pred_bin = (y_pred_arr == t).astype(int)

            tp = int(np.sum((y_true_bin == 1) & (y_pred_bin == 1)))
            tn = int(np.sum((y_true_bin == 0) & (y_pred_bin == 0)))
            fp = int(np.sum((y_true_bin == 0) & (y_pred_bin == 1)))
            fn = int(np.sum((y_true_bin == 1) & (y_pred_bin == 0)))

            tpr = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
            tnr = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
            fpr = float(fp / (tn + fp)) if (tn + fp) > 0 else 0.0
            fnr = float(fn / (tp + fn)) if (tp + fn) > 0 else 0.0
            accuracy = float((tp + tn) / (tp + tn + fp + fn)) if (tp + tn + fp + fn) > 0 else 0.0

            out[t] = {
                "tpr": tpr,
                "tnr": tnr,
                "fpr": fpr,
                "fnr": fnr,
                "accuracy": accuracy,
                "support": int(np.sum(y_true_bin)),
                "predicted_support": int(np.sum(y_pred_bin)),
            }
    else:
        # Binary flag predictions: legacy behavior (y_pred is 0/1 flags)
        y_pred_arr = np.asarray(y_pred_input, dtype=int)
        
        for t in types:
            y_true_bin = (y_types == t).astype(int)
            y_pred_bin = y_pred_arr

            tp = int(np.sum((y_true_bin == 1) & (y_pred_bin == 1)))
            tn = int(np.sum((y_true_bin == 0) & (y_pred_bin == 0)))
            fp = int(np.sum((y_true_bin == 0) & (y_pred_bin == 1)))
            fn = int(np.sum((y_true_bin == 1) & (y_pred_bin == 0)))

            tpr = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
            accuracy = float((tp + tn) / (tp + tn + fp + fn)) if (tp + tn + fp + fn) > 0 else 0.0
            tnr = 0.0 if (tn + fp) == 0 else float(tn / (tn + fp))
            fpr = 0.0 if (tn + fp) == 0 else float(fp / (tn + fp))
            fnr = 0.0 if (tp + fn) == 0 else float(fn / (tp + fn))

            out[t] = {
                "tpr": tpr,
                "tnr": tnr,
                "fpr": fpr,
                "fnr": fnr,
                "accuracy": accuracy,
                "support": int(np.sum(y_true_bin)),
                "predicted_support": int(np.sum(y_pred_bin)),
            }

    return out


def summarize_attack_typing(y_true_types: List[str], y_pred_types: List[str]) -> Dict[str, float]:
    """
    Summarize attack typing separately from binary anomaly detection.

    Evaluates class attribution only on true non-NONE attack/fault samples.
    """
    if not y_true_types or not y_pred_types or len(y_true_types) != len(y_pred_types):
        return {
            "positive_support": 0.0,
            "typing_accuracy": 0.0,
            "macro_tpr": 0.0,
            "macro_fpr": 0.0,
            "classes_with_support": 0.0,
        }

    metrics = per_attack_confusion(y_true_types, y_pred_types)
    positive_mask = [str(v).strip().upper() != "NONE" for v in y_true_types]
    positive_support = int(sum(positive_mask))
    if positive_support > 0:
        correct = 0
        for truth, pred in zip(y_true_types, y_pred_types):
            truth_norm = str(truth).strip().upper()
            pred_norm = str(pred).strip().upper()
            if truth_norm != "NONE" and truth_norm == pred_norm:
                correct += 1
        typing_accuracy = float(correct / positive_support)
    else:
        typing_accuracy = 0.0

    supported_classes = []
    for label, vals in metrics.items():
        if label == "NONE":
            continue
        if int(vals.get("support", 0)) > 0:
            supported_classes.append(label)

    if supported_classes:
        macro_tpr = float(np.mean([metrics[label].get("tpr", 0.0) for label in supported_classes]))
        macro_fpr = float(np.mean([metrics[label].get("fpr", 0.0) for label in supported_classes]))
    else:
        macro_tpr = 0.0
        macro_fpr = 0.0

    return {
        "positive_support": float(positive_support),
        "typing_accuracy": typing_accuracy,
        "macro_tpr": macro_tpr,
        "macro_fpr": macro_fpr,
        "classes_with_support": float(len(supported_classes)),
    }


def compute_statistical_significance(
    dynamic_records: List[Dict[str, Any]],
    baseline_records: List[Dict[str, Any]],
    y_true_dyn: List[int] | None = None,
    y_pred_dyn: List[int] | None = None,
) -> Dict[str, Any]:
    results: Dict[str, Any] = {}

    attack_rate_dyn = np.array([r.get("attack_rate", 0.0) for r in dynamic_records])
    attack_rate_base = np.array([r.get("attack_rate", 0.0) for r in baseline_records])
    if len(attack_rate_dyn) > 1 and len(attack_rate_base) > 1:
        try:
            res = stats.ttest_rel(attack_rate_base, attack_rate_dyn)
            p_val = float(getattr(res, "pvalue", res[1] if isinstance(res, tuple) else res))  # type: ignore[arg-type]
            test_used = "paired_t_test"
        except Exception:
            try:
                res = stats.wilcoxon(attack_rate_base, attack_rate_dyn)
                p_val = float(getattr(res, "pvalue", res[1] if isinstance(res, tuple) else res))  # type: ignore[arg-type]
                test_used = "wilcoxon_signed_rank"
            except Exception:
                p_val = 1.0
                test_used = "paired_t_test"
        results["attack_rate_reduction"] = {
            "p_value": float(p_val),
            "test": test_used,
            "significant": bool(p_val < 0.05),
        }

    spend_dyn = np.array([r.get("total_spend", 0.0) for r in dynamic_records])
    spend_base = np.array([r.get("total_spend", 0.0) for r in baseline_records])
    if len(spend_dyn) > 1 and len(spend_base) > 1:
        try:
            res = stats.ttest_rel(spend_base, spend_dyn)
            p_val = float(getattr(res, "pvalue", res[1] if isinstance(res, tuple) else res))  # type: ignore[arg-type]
            test_used = "paired_t_test"
        except Exception:
            try:
                res = stats.wilcoxon(spend_base, spend_dyn)
                p_val = float(getattr(res, "pvalue", res[1] if isinstance(res, tuple) else res))  # type: ignore[arg-type]
                test_used = "wilcoxon_signed_rank"
            except Exception:
                p_val = 1.0
                test_used = "paired_t_test"
        results["cost_efficiency"] = {
            "p_value": float(p_val),
            "test": test_used,
            "significant": bool(p_val < 0.05),
        }

    if y_true_dyn is not None and y_pred_dyn is not None:
        try:
            prf1_dyn = prf1(y_true_dyn, y_pred_dyn)
            f1_dyn = prf1_dyn.get("f1", 0.0)
            y_pred_base = [1] * len(y_true_dyn)
            prf1_base = prf1(y_true_dyn, y_pred_base)
            f1_base = prf1_base.get("f1", 0.0)
            results["f1_score"] = {
                "p_value": 1.0,
                "test": "not_enough_samples",
                "significant": False,
                "dynamic_f1": f1_dyn,
                "baseline_f1": f1_base,
            }
        except Exception:
            results["f1_score"] = {
                "p_value": 1.0,
                "test": "not_enough_samples",
                "significant": False,
            }

    return results


def _extract_series(records: List[Dict[str, Any]]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Helper to extract attack_rate, mean_deviation, global_risk series."""
    if not records:
        return np.array([]), np.array([]), np.array([])
    attack_truth = np.array([r.get("attack_rate_truth") for r in records], dtype=float)
    attack_flag = np.array([r.get("attack_rate_flagged", 0.0) for r in records], dtype=float)
    attack = np.where(np.isnan(attack_truth), attack_flag, attack_truth)
    mean_dev = np.array([r.get("mean_deviation", 0.0) for r in records], dtype=float)
    risk = np.array([r.get("global_risk", 0.0) for r in records], dtype=float)
    return attack, mean_dev, risk


def cross_layer_stability(metrics_records: List[Dict[str, Any]], z_limit: float = 1.0) -> Dict[str, Any]:
    """
    Cross-Layer Stability Index (CLSI): proportion of timesteps where both
    attack rate (cyber) and mean deviation (physical) stay within ±z_limit
    standard deviations of their respective means.

    Returns a dict with index in [0,1], correlation between layers, and counts.
    """
    attack, mean_dev, _ = _extract_series(metrics_records)
    n = int(attack.size)
    if n < 2:
        return {"index": 0.0, "stable_steps": 0, "total_steps": n, "corr": None, "z_limit": z_limit}

    def _z(x: np.ndarray) -> np.ndarray:
        mu, sd = float(np.mean(x)), float(np.std(x))
        if sd <= 1e-12:
            return np.zeros_like(x)
        return (x - mu) / sd

    z_attack = _z(attack)
    z_dev = _z(mean_dev)
    stable_mask = (np.abs(z_attack) <= z_limit) & (np.abs(z_dev) <= z_limit)
    stable_steps = int(np.sum(stable_mask))
    idx = float(stable_steps / n)
    try:
        corr = float(np.corrcoef(attack, mean_dev)[0, 1])
    except Exception:
        corr = None
    return {"index": idx, "stable_steps": stable_steps, "total_steps": n, "corr": corr, "z_limit": z_limit}


def deviation_trend_and_clusters(
    metrics_records: List[Dict[str, Any]],
    k: int = 3,
) -> Dict[str, Any]:
    """
    Analyze deviation trend and optionally cluster timesteps into regimes using K-Means
    on features [mean_deviation, attack_rate, global_risk]. Returns cumulative deviation,
    slope, and cluster summary (if feasible).
    """
    attack, mean_dev, risk = _extract_series(metrics_records)
    n = int(mean_dev.size)
    if n == 0:
        return {
            "cumulative_deviation": 0.0,
            "deviation_slope": 0.0,
            "clusters": {"enabled": False, "reason": "no_records"},
        }

    cumulative_dev = float(np.sum(mean_dev))
    # Linear regression slope over time
    t = np.arange(n, dtype=float)
    t_mean, y_mean = float(np.mean(t)), float(np.mean(mean_dev))
    num = float(np.sum((t - t_mean) * (mean_dev - y_mean)))
    den = float(np.sum((t - t_mean) ** 2))
    slope = float(num / den) if den > 0 else 0.0

    clusters: Dict[str, Any] = {"enabled": False}
    if _SKLEARN_AVAILABLE and n >= max(5, k) and k >= 2:
        try:
            # Local imports to avoid type-checker complaints when sklearn is missing
            from sklearn.preprocessing import StandardScaler as _SS
            from sklearn.cluster import KMeans as _KM
            X = np.column_stack([mean_dev, attack, risk]).astype(float)
            scaler = _SS()
            Xs = scaler.fit_transform(X)
            km = _KM(n_clusters=k, n_init="auto", random_state=42)
            labels = km.fit_predict(Xs)
            centers = km.cluster_centers_.tolist()
            counts = {int(lbl): int(np.sum(labels == lbl)) for lbl in range(k)}
            clusters = {
                "enabled": True,
                "k": int(k),
                "counts": counts,
                "centers": centers,
            }
        except Exception as e:
            clusters = {"enabled": False, "reason": f"clustering_failed: {e}"}
    else:
        if not _SKLEARN_AVAILABLE:
            clusters = {"enabled": False, "reason": "sklearn_unavailable"}
        else:
            clusters = {"enabled": False, "reason": "insufficient_timesteps"}

    return {
        "cumulative_deviation": cumulative_dev,
        "deviation_slope": slope,
        "clusters": clusters,
    }


def build_summary(
    dynamic_records: List[Dict[str, Any]],
    baseline_records: List[Dict[str, Any]],
    y_true_dyn: List[int] | None = None,
    y_pred_dyn: List[int] | None = None,
    y_pred_types_dyn: List[str] | None = None,
    y_true_types_dyn: List[str] | None = None,
    initial_risk: float = 0.0,
    final_risk: float = 0.0,
    failure_cost_coeff: float = 10.0,
) -> Dict[str, Any]:
    dyn_cost_audit = total_audit_cost(dynamic_records)
    base_cost_audit = total_audit_cost(baseline_records)
    dyn_intended_cost = total_intended_cost(dynamic_records)
    base_intended_cost = total_intended_cost(baseline_records)

    mean_risk_dyn = mean_global_risk(dynamic_records)
    mean_risk_base = mean_global_risk(baseline_records)
    # Paper-aligned risk mitigation formula (Section 5.4.3):
    #   Risk Mitigation = (Initial Risk Score - Final Risk Score) / Initial Risk Score
    # "Initial" = raw (unmitigated) risk per step = global_risk = sum(w_i * a_i)
    # "Final"   = effective (post-audit/response) risk per step = global_risk_effective
    # This measures: how much does the response mechanism reduce raw risk within the dynamic run?
    mean_risk_raw_dyn = mean_global_risk_raw(dynamic_records)
    mean_risk_eff_dyn = mean_risk_dyn  # already uses global_risk_effective
    # FIX: Cost efficiency uses only audit cost (not failure cost)
    dyn_total_cost = dyn_cost_audit
    base_total_cost = base_cost_audit
    risk_mitigation_flag = 0.0
    if mean_risk_raw_dyn > 0:
        risk_mitigation_flag = float((mean_risk_raw_dyn - mean_risk_eff_dyn) / mean_risk_raw_dyn)

    # Paper-faithful FPR-invariant risk mitigation (truth-based):
    #   Numerator = ground-truth attack risk that audits/mitigation neutralised
    #   Denominator = total ground-truth attack risk over the run
    # This isolates "what fraction of REAL attack potential did the response
    # mechanism mitigate" and is invariant to false-positive count changes.
    truth_risk_series = [
        float(r.get("truth_weighted_risk", 0.0) or 0.0) for r in dynamic_records
    ]
    truth_cleared_series = [
        float(r.get("truth_risk_cleared", 0.0) or 0.0) for r in dynamic_records
    ]
    mean_truth_risk = float(np.mean(truth_risk_series)) if truth_risk_series else 0.0
    mean_truth_cleared = float(np.mean(truth_cleared_series)) if truth_cleared_series else 0.0
    risk_mitigation_truth = 0.0
    if mean_truth_risk > 0:
        risk_mitigation_truth = float(mean_truth_cleared / mean_truth_risk)
        risk_mitigation_truth = max(0.0, min(1.0, risk_mitigation_truth))

    risk_mitigation = risk_mitigation_flag

    risk_reduced_per_cost = 0.0
    if dyn_total_cost > 0:
        risk_reduced_per_cost = float((mean_risk_base - mean_risk_dyn) / dyn_total_cost)

    # ---- Cost-Adjusted Mitigation (Gemini #4) ----
    # The "commercial superiority" KPI: how much risk did we mitigate per
    # audit-dollar spent? Higher is better. Useful to argue against a paper
    # that achieves similar mitigation at much higher audit cost.
    # Formula: risk_mitigation (0..1) / executed_audit_cost ($) per total agents
    # Normalised so the ratio is interpretable across grid sizes.
    cost_adjusted_mitigation = 0.0
    audits_per_mitigation_point = 0.0
    if dyn_total_cost > 0:
        cost_adjusted_mitigation = float(risk_mitigation * 1000.0 / dyn_total_cost)
        if risk_mitigation > 0:
            audits_per_mitigation_point = float(dyn_total_cost / (risk_mitigation * 100.0))

    coverage_cycle_dyn = dynamic_records[-1].get("coverage", 0.0) if dynamic_records else 0.0
    coverage_cycle_base = baseline_records[-1].get("coverage", 0.0) if baseline_records else 0.0

    summary: Dict[str, Any] = {
        "dynamic_mean_attack_rate": mean_attack_rate(dynamic_records),
        "baseline_mean_attack_rate": mean_attack_rate(baseline_records),
        "attack_rate_reduction": attack_rate_reduction(dynamic_records, baseline_records),
        "dynamic_total_audit_cost": dyn_cost_audit,
        "baseline_total_audit_cost": base_cost_audit,
        "dynamic_intended_audit_cost": dyn_intended_cost,
        "baseline_intended_audit_cost": base_intended_cost,
        "executed_cost_dynamic": dyn_cost_audit,
        "executed_cost_baseline": base_cost_audit,
        "cost_efficiency": cost_efficiency(dyn_cost_audit, base_cost_audit),
        "mean_global_risk_dynamic": mean_risk_dyn,
        "mean_global_risk_raw_dynamic": mean_risk_raw_dyn,
        "mean_global_risk_baseline": mean_risk_base,
        "risk_mitigation": risk_mitigation,
        "risk_mitigation_flag_based": risk_mitigation_flag,
        "risk_mitigation_truth_based": risk_mitigation_truth,
        "mean_truth_weighted_risk": mean_truth_risk,
        "risk_reduced_per_cost": risk_reduced_per_cost,
        "cost_adjusted_mitigation": cost_adjusted_mitigation,
        "audits_per_mitigation_point": audits_per_mitigation_point,
        "initial_risk": initial_risk,
        "final_risk": final_risk,
        "coverage_cycle_dynamic": coverage_cycle_dyn,
        "coverage_cycle_baseline": coverage_cycle_base,
    }

    if y_true_dyn is not None and y_pred_dyn is not None:
        prf1_metrics = prf1(y_true_dyn, y_pred_dyn)
        summary.update(prf1_metrics)
        summary.update(confusion_matrix(y_true_dyn, y_pred_dyn))
        summary["anomaly_detection_metrics"] = {
            "precision": float(summary.get("precision", 0.0)),
            "recall": float(summary.get("recall", 0.0)),
            "f1": float(summary.get("f1", 0.0)),
            "fpr": float(summary.get("fpr", 0.0)),
            "fn": float(summary.get("fn", 0.0)),
            "fp": float(summary.get("fp", 0.0)),
        }
        if y_true_types_dyn is not None and y_pred_types_dyn is not None:
            summary["per_attack_metrics"] = per_attack_confusion(y_true_types_dyn, y_pred_types_dyn)
            summary["attack_typing_metrics"] = summarize_attack_typing(y_true_types_dyn, y_pred_types_dyn)
    else:
        summary.update({"precision": 0.0, "recall": 0.0, "f1": 0.0})
        summary.update({"tpr": 0.0, "tnr": 0.0, "fpr": 0.0, "fnr": 0.0, "accuracy": 0.0})
        summary["anomaly_detection_metrics"] = {
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0,
            "fpr": 0.0,
            "fn": 0.0,
            "fp": 0.0,
        }
        if y_true_types_dyn is not None and y_pred_types_dyn is not None:
            summary["per_attack_metrics"] = per_attack_confusion(y_true_types_dyn, y_pred_types_dyn)
            summary["attack_typing_metrics"] = summarize_attack_typing(y_true_types_dyn, y_pred_types_dyn)
        elif y_true_types_dyn is not None:
            summary["per_attack_metrics"] = per_attack_confusion(y_true_types_dyn, ["NONE"] * len(y_true_types_dyn))
            summary["attack_typing_metrics"] = summarize_attack_typing(y_true_types_dyn, ["NONE"] * len(y_true_types_dyn))
        else:
            summary["attack_typing_metrics"] = {
                "positive_support": 0.0,
                "typing_accuracy": 0.0,
                "macro_tpr": 0.0,
                "macro_fpr": 0.0,
                "classes_with_support": 0.0,
            }

    summary["statistical_tests"] = compute_statistical_significance(
        dynamic_records, baseline_records, y_true_dyn, y_pred_dyn
    )

    # Cross-layer stability metric (cyber-physical coupling)
    summary["cross_layer_stability"] = cross_layer_stability(dynamic_records)
    # Deviation trend and clustering diagnostics
    summary["deviation_trend"] = deviation_trend_and_clusters(dynamic_records, k=3)

    return summary
