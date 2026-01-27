from __future__ import annotations
from dataclasses import dataclass
from typing import Tuple
import bisect


@dataclass
class StateEncoder:
    """
    Encodes continuous state variables into discrete buckets for Q-learning.
    
    Maps:
    - agent risk_score (float) → risk bucket [0, len(risk_edges)-2]
    - anomaly_prob (0..1) → prob bucket [0, len(prob_edges)-2]
    - cluster_label (int) → cluster ID (unchanged)
    - capacity_utilization (0..2+) → capacity bucket [0, 3] (FIX #11)
    
    Uses bisect_right for efficient bucketing.
    """
    
    # Edges define cut points for risk bucketing
    risk_edges: Tuple[float, ...] = (0.0, 0.5, 1.0, 2.0, 5.0, 10.0)
    
    # Edges for anomaly probability bucketing
    prob_edges: Tuple[float, ...] = (0.0, 0.2, 0.4, 0.6, 0.8, 1.0)
    
    # Capacity utilization bucketing (FIX #11 - Architectural)
    # 0: plenty of capacity (<50%), 1: moderate (50-80%), 2: tight (80-100%), 3: over-capacity (>100%)
    capacity_edges: Tuple[float, ...] = (0.0, 0.5, 0.8, 1.0, 2.0)

    def bucket(self, x: float, edges: Tuple[float, ...]) -> int:
        """
        Find bucket index for value x given edges.
        
        bisect_right returns insertion point (index of first edge > x).
        Subtract 1 to get bucket index.
        Clamp to valid range [0, len(edges)-2].
        
        Args:
            x: Continuous value
            edges: Sorted tuple of bucket boundaries
        
        Returns:
            Bucket index
        """
        i = bisect.bisect_right(edges, x) - 1
        return max(0, min(i, len(edges) - 2))

    def encode(self, risk: float, anomaly_prob: float, cluster_label: int, capacity_utilization: float = 0.5) -> Tuple[int, int, int, int]:
        """
        Encode state into discrete tuple suitable for Q-table indexing.
        
        FIX #11: Now includes capacity utilization for constraint-aware learning.
        
        Args:
            risk: Agent risk score (float)
            anomaly_prob: Anomaly probability from LSTM [0, 1]
            cluster_label: Cluster ID from K-Means
            capacity_utilization: Current capacity usage ratio (0.0 = empty, 1.0 = full, >1.0 = over)
        
        Returns:
            (risk_bucket, prob_bucket, cluster_label, capacity_bucket) tuple for Q-table key
        """
        r_bucket = self.bucket(float(risk), self.risk_edges)
        p_bucket = self.bucket(float(anomaly_prob), self.prob_edges)
        c_label = int(cluster_label)
        cap_bucket = self.bucket(float(capacity_utilization), self.capacity_edges)
        return (r_bucket, p_bucket, c_label, cap_bucket)
