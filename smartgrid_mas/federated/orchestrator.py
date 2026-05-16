from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from threading import Lock
from typing import Any, Dict, List

from smartgrid_mas.federated.fedavg import aggregate_state_dicts


@dataclass
class FederatedClient:
    client_id: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    last_seen: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


@dataclass
class FederatedRound:
    round_id: str
    model_name: str
    started_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    status: str = "OPEN"  # OPEN | FINALIZED
    expected_clients: List[str] = field(default_factory=list)
    updates: Dict[str, Dict[str, Any]] = field(default_factory=dict)


class FederatedCoordinator:
    """In-memory coordinator for basic FL round orchestration."""

    def __init__(self) -> None:
        self._lock = Lock()
        self.clients: Dict[str, FederatedClient] = {}
        self.rounds: Dict[str, FederatedRound] = {}
        self.global_models: Dict[str, Dict[str, Any]] = {}

    def register_client(self, client_id: str, metadata: Dict[str, Any] | None = None) -> Dict[str, Any]:
        with self._lock:
            client = FederatedClient(client_id=client_id, metadata=metadata or {})
            self.clients[client_id] = client
            return {
                "client_id": client.client_id,
                "last_seen": client.last_seen,
                "metadata": client.metadata,
            }

    def start_round(
        self,
        round_id: str,
        model_name: str,
        expected_clients: List[str] | None = None,
        base_model: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        with self._lock:
            if round_id in self.rounds and self.rounds[round_id].status == "OPEN":
                raise ValueError(f"round '{round_id}' already open")

            r = FederatedRound(
                round_id=round_id,
                model_name=model_name,
                expected_clients=expected_clients or [],
            )
            self.rounds[round_id] = r

            if base_model is not None:
                self.global_models[model_name] = base_model

            return {
                "round_id": r.round_id,
                "model_name": r.model_name,
                "status": r.status,
                "expected_clients": r.expected_clients,
                "started_at": r.started_at,
            }

    def submit_update(
        self,
        round_id: str,
        client_id: str,
        sample_count: int,
        model_state: Dict[str, Any],
    ) -> Dict[str, Any]:
        with self._lock:
            if round_id not in self.rounds:
                raise ValueError(f"unknown round '{round_id}'")
            r = self.rounds[round_id]
            if r.status != "OPEN":
                raise ValueError(f"round '{round_id}' is not open")
            if sample_count <= 0:
                raise ValueError("sample_count must be > 0")

            r.updates[client_id] = {
                "sample_count": int(sample_count),
                "model_state": model_state,
                "submitted_at": datetime.utcnow().isoformat() + "Z",
            }

            return {
                "round_id": round_id,
                "client_id": client_id,
                "received_updates": len(r.updates),
                "status": r.status,
            }

    def finalize_round(self, round_id: str) -> Dict[str, Any]:
        with self._lock:
            if round_id not in self.rounds:
                raise ValueError(f"unknown round '{round_id}'")
            r = self.rounds[round_id]
            if r.status != "OPEN":
                raise ValueError(f"round '{round_id}' already finalized")
            if not r.updates:
                raise ValueError("cannot finalize without updates")

            client_states = [u["model_state"] for u in r.updates.values()]
            sample_counts = [u["sample_count"] for u in r.updates.values()]
            aggregated = aggregate_state_dicts(client_states, sample_counts)
            self.global_models[r.model_name] = aggregated
            r.status = "FINALIZED"

            return {
                "round_id": round_id,
                "model_name": r.model_name,
                "status": r.status,
                "num_updates": len(r.updates),
                "aggregated_model": aggregated,
            }

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "clients": {
                    cid: {
                        "metadata": c.metadata,
                        "last_seen": c.last_seen,
                    }
                    for cid, c in self.clients.items()
                },
                "rounds": {
                    rid: {
                        "model_name": r.model_name,
                        "status": r.status,
                        "expected_clients": r.expected_clients,
                        "num_updates": len(r.updates),
                        "started_at": r.started_at,
                    }
                    for rid, r in self.rounds.items()
                },
                "global_models": list(self.global_models.keys()),
            }
