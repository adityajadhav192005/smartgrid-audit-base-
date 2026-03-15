from __future__ import annotations

from typing import Any, Dict, List, Sequence
import numpy as np


def aggregate_vectors(client_vectors: Sequence[Sequence[float]], sample_counts: Sequence[int]) -> List[float]:
    """Basic FedAvg for 1D parameter vectors."""
    if len(client_vectors) == 0:
        raise ValueError("client_vectors cannot be empty")
    if len(client_vectors) != len(sample_counts):
        raise ValueError("sample_counts length must match client_vectors")

    arrays = [np.asarray(v, dtype=float).reshape(-1) for v in client_vectors]
    dim = arrays[0].shape[0]
    if any(a.shape[0] != dim for a in arrays):
        raise ValueError("all vectors must have same dimension")

    weights = np.asarray(sample_counts, dtype=float)
    if np.any(weights < 0) or np.sum(weights) <= 0:
        raise ValueError("sample_counts must be non-negative and sum > 0")
    weights = weights / np.sum(weights)

    stacked = np.stack(arrays, axis=0)
    agg = np.average(stacked, axis=0, weights=weights)
    return agg.tolist()


def aggregate_state_dicts(
    client_state_dicts: Sequence[Dict[str, Any]],
    sample_counts: Sequence[int],
) -> Dict[str, List[float] | float]:
    """
    Basic FedAvg for lightweight state-dicts.

    Supports scalar params and 1D list params. This is intentionally simple and
    framework-agnostic for easy integration with SCADA edge clients.
    """
    if len(client_state_dicts) == 0:
        raise ValueError("client_state_dicts cannot be empty")
    if len(client_state_dicts) != len(sample_counts):
        raise ValueError("sample_counts length must match client_state_dicts")

    keys = set(client_state_dicts[0].keys())
    for d in client_state_dicts[1:]:
        if set(d.keys()) != keys:
            raise ValueError("all client state dicts must share identical keys")

    weights = np.asarray(sample_counts, dtype=float)
    if np.any(weights < 0) or np.sum(weights) <= 0:
        raise ValueError("sample_counts must be non-negative and sum > 0")
    weights = weights / np.sum(weights)

    aggregated: Dict[str, List[float] | float] = {}
    for k in sorted(keys):
        first_val = client_state_dicts[0][k]
        if isinstance(first_val, (int, float)):
            vals = np.asarray([float(d[k]) for d in client_state_dicts], dtype=float)
            aggregated[k] = float(np.average(vals, weights=weights))
        else:
            arrs = [np.asarray(d[k], dtype=float).reshape(-1) for d in client_state_dicts]
            dim = arrs[0].shape[0]
            if any(a.shape[0] != dim for a in arrs):
                raise ValueError(f"inconsistent dimension for key '{k}'")
            stacked = np.stack(arrs, axis=0)
            aggregated[k] = np.average(stacked, axis=0, weights=weights).tolist()

    return aggregated
