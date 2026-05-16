"""Basic federated learning utilities (FedAvg)."""

from .fedavg import aggregate_vectors, aggregate_state_dicts
from .orchestrator import FederatedCoordinator

__all__ = ["aggregate_vectors", "aggregate_state_dicts", "FederatedCoordinator"]
