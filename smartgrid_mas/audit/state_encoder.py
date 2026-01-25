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
    
    Uses bisect_right for efficient bucketing.
    """
    
    # Edges define cut points for risk bucketing
    risk_edges: Tuple[float, ...] = (0.0, 0.5, 1.0, 2.0, 5.0, 10.0)
    
    # Edges for anomaly probability bucketing
    prob_edges: Tuple[float, ...] = (0.0, 0.2, 0.4, 0.6, 0.8, 1.0)

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

    def encode(self, risk: float, anomaly_prob: float, cluster_label: int) -> Tuple[int, int, int]:
        """
        Encode state into discrete tuple suitable for Q-table indexing.
        
        Args:
            risk: Agent risk score (float)
            anomaly_prob: Anomaly probability from LSTM [0, 1]
            cluster_label: Cluster ID from K-Means
        
        Returns:
            (risk_bucket, prob_bucket, cluster_label) tuple for Q-table key
        """
        r_bucket = self.bucket(float(risk), self.risk_edges)
        p_bucket = self.bucket(float(anomaly_prob), self.prob_edges)
        c_label = int(cluster_label)
        return (r_bucket, p_bucket, c_label)
