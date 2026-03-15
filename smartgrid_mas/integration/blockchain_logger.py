from __future__ import annotations

import os
from typing import Any, Dict, Optional

from .event_store import EventStore


_SEVERITY_ORDER = {
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
    "CRITICAL": 4,
}


class BlockchainLogger:
    def __init__(self, store: Optional[EventStore] = None) -> None:
        self.store = store or EventStore()
        self.enabled = os.environ.get("SMARTGRID_BLOCKCHAIN_ENABLED", "1").strip() not in {"0", "false", "False"}
        self.min_severity = os.environ.get("SMARTGRID_BLOCKCHAIN_MIN_SEVERITY", "HIGH").upper().strip()

    def should_anchor(self, severity: str) -> bool:
        lvl = _SEVERITY_ORDER.get(severity.upper(), 1)
        min_lvl = _SEVERITY_ORDER.get(self.min_severity, 3)
        return lvl >= min_lvl

    def anchor_event(
        self,
        *,
        event_type: str,
        agent_id: str,
        severity: str,
        payload: Dict[str, Any],
        force: bool = False,
    ) -> Dict[str, Any]:
        severity = severity.upper().strip()
        if not self.enabled:
            return {"anchored": False, "reason": "disabled"}
        if not force and not self.should_anchor(severity):
            return {"anchored": False, "reason": f"severity_below_min:{self.min_severity}"}

        stored = self.store.record_event(
            event_type=event_type,
            agent_id=agent_id,
            severity=severity,
            payload=payload,
        )
        return {
            "anchored": True,
            "event_id": stored.event_id,
            "tx_id": stored.tx_id,
            "chain_hash": stored.chain_hash,
            "prev_hash": stored.prev_hash,
            "created_at": stored.created_at,
        }

    def verify_event(self, event_id: int) -> Dict[str, Any]:
        return self.store.verify_event(event_id)

    def verify_payload(self, payload: Dict[str, Any], prev_hash: str, chain_hash: str) -> Dict[str, Any]:
        return self.store.verify_payload(payload=payload, prev_hash=prev_hash, expected_hash=chain_hash)

    def recent_events(self, limit: int = 50) -> Dict[str, Any]:
        return {
            "count": min(max(int(limit), 1), 500),
            "events": self.store.recent_events(limit=limit),
        }

    def status(self) -> Dict[str, Any]:
        stats = self.store.stats()
        stats.update(
            {
                "enabled": self.enabled,
                "min_severity": self.min_severity,
            }
        )
        return stats
