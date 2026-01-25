from __future__ import annotations
from typing import List, Dict
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.behavior_analysis.trend_features import build_trend_feature

def cluster_agents_trends(
    agents: List[BaseAgent],
    window: int = 50,
    k: int = 3,
    seed: int = 42,
) -> Dict[str, int]:
    """
    Cluster agents based on behavior trends using K-Means.
    
    Pipeline:
    1. Extract 4D feature vector for each agent (cumulative deviation, baselines, thresholds, slope)
    2. Standardize features (mean 0, std 1)
    3. Fit K-Means with k clusters
    4. Return mapping of agent_id -> cluster_label
    
    Args:
        agents: List of BaseAgent instances
        window: Trend analysis window (default 50 timesteps)
        k: Number of clusters (default 3)
        seed: Random seed for reproducibility (default 42)
    
    Returns:
        Dictionary mapping agent_id -> cluster_label (int in [0, k-1])
    
    Raises:
        ValueError: If k < 2 or len(agents) < k
    """
    if k < 2:
        raise ValueError("k must be >= 2")
    if len(agents) < k:
        raise ValueError(f"Need at least {k} agents to form {k} clusters.")

    feats = []
    ids = []
    for a in agents:
        ids.append(a.agent_id)
        feats.append(build_trend_feature(a, window=window))
    X = np.vstack(feats)

    # Standardize features
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    # Fit K-Means
    km = KMeans(n_clusters=k, random_state=seed, n_init="auto")
    labels = km.fit_predict(Xs)

    return {agent_id: int(lbl) for agent_id, lbl in zip(ids, labels)}

def assign_cluster_labels(agents: List[BaseAgent], labels: Dict[str, int]) -> None:
    """
    Assign cluster labels back into each agent's last_state.
    
    Args:
        agents: List of BaseAgent instances
        labels: Dictionary mapping agent_id -> cluster_label
    """
    for a in agents:
        if a.last_state is None:
            continue
        if a.agent_id in labels:
            a.last_state.cluster_label = labels[a.agent_id]
