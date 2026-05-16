from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class StoredEvent:
    event_id: int
    created_at: str
    event_type: str
    agent_id: str
    severity: str
    payload_json: str
    chain_hash: str
    prev_hash: str
    tx_id: str


class EventStore:
    def __init__(self, db_path: Optional[str] = None) -> None:
        default_path = Path("logs") / "audit_chain.db"
        self.db_path = Path(db_path or os.environ.get("SMARTGRID_CHAIN_DB_PATH", str(default_path)))
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self.supabase_mirror_enabled = os.environ.get("SMARTGRID_SUPABASE_MIRROR_ENABLED", "0").strip() in {"1", "true", "True"}
        self.supabase_url = os.environ.get("SMARTGRID_SUPABASE_URL", "").strip().rstrip("/")
        self.supabase_service_role_key = os.environ.get("SMARTGRID_SUPABASE_SERVICE_ROLE_KEY", "").strip()
        self.supabase_table = os.environ.get("SMARTGRID_SUPABASE_TABLE", "blockchain_events").strip()
        self.last_mirror_error: Optional[str] = None
        self._init_db()

    def _supabase_ready(self) -> bool:
        return bool(self.supabase_mirror_enabled and self.supabase_url and self.supabase_service_role_key and self.supabase_table)

    def _mirror_to_supabase(self, row: Dict[str, Any]) -> None:
        if not self._supabase_ready():
            return
        endpoint = f"{self.supabase_url}/rest/v1/{self.supabase_table}"
        payload_bytes = json.dumps([row], separators=(",", ":"), default=str).encode("utf-8")
        request = urllib.request.Request(
            endpoint,
            data=payload_bytes,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "apikey": self.supabase_service_role_key,
                "Authorization": f"Bearer {self.supabase_service_role_key}",
                "Prefer": "return=minimal",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                status = int(getattr(response, "status", 0) or 0)
                if status not in (200, 201):
                    self.last_mirror_error = f"Unexpected Supabase status: {status}"
                else:
                    self.last_mirror_error = None
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else ""
            self.last_mirror_error = f"HTTPError {e.code}: {body[:300]}"
        except Exception as e:
            self.last_mirror_error = f"Mirror exception: {e}"

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS blockchain_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    chain_hash TEXT NOT NULL,
                    prev_hash TEXT NOT NULL,
                    tx_id TEXT NOT NULL,
                    anchored INTEGER NOT NULL DEFAULT 1
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS blockchain_state (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "INSERT OR IGNORE INTO blockchain_state(key, value) VALUES('last_hash', 'GENESIS')"
            )
            conn.commit()

    @staticmethod
    def canonical_json(payload: Dict[str, Any]) -> str:
        return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)

    @staticmethod
    def compute_hash(prev_hash: str, canonical_payload: str) -> str:
        digest_input = f"{prev_hash}|{canonical_payload}".encode("utf-8")
        return sha256(digest_input).hexdigest()

    def _get_last_hash(self, conn: sqlite3.Connection) -> str:
        row = conn.execute("SELECT value FROM blockchain_state WHERE key='last_hash'").fetchone()
        return str(row["value"]) if row else "GENESIS"

    def _set_last_hash(self, conn: sqlite3.Connection, value: str) -> None:
        conn.execute(
            "INSERT INTO blockchain_state(key, value) VALUES('last_hash', ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (value,),
        )

    def record_event(self, event_type: str, agent_id: str, severity: str, payload: Dict[str, Any]) -> StoredEvent:
        created_at = datetime.now(timezone.utc).isoformat()
        canonical_payload = self.canonical_json(payload)
        tx_id = f"local-{uuid.uuid4().hex[:16]}"

        with self._lock:
            with self._connect() as conn:
                prev_hash = self._get_last_hash(conn)
                chain_hash = self.compute_hash(prev_hash=prev_hash, canonical_payload=canonical_payload)

                cur = conn.execute(
                    """
                    INSERT INTO blockchain_events(
                        created_at, event_type, agent_id, severity, payload_json, chain_hash, prev_hash, tx_id, anchored
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                    """,
                    (created_at, event_type, agent_id, severity, canonical_payload, chain_hash, prev_hash, tx_id),
                )
                row_id = cur.lastrowid
                if row_id is None:
                    raise RuntimeError("Failed to persist blockchain event: missing row id")
                event_id = int(row_id)
                self._set_last_hash(conn, chain_hash)
                conn.commit()

        self._mirror_to_supabase(
            {
                "local_id": event_id,
                "created_at": created_at,
                "event_type": event_type,
                "agent_id": agent_id,
                "severity": severity,
                "payload_json": canonical_payload,
                "chain_hash": chain_hash,
                "prev_hash": prev_hash,
                "tx_id": tx_id,
                "anchored": True,
                "source": "smartgrid_mas",
            }
        )

        return StoredEvent(
            event_id=event_id,
            created_at=created_at,
            event_type=event_type,
            agent_id=agent_id,
            severity=severity,
            payload_json=canonical_payload,
            chain_hash=chain_hash,
            prev_hash=prev_hash,
            tx_id=tx_id,
        )

    def get_event(self, event_id: int) -> Optional[StoredEvent]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM blockchain_events WHERE id = ?", (event_id,)).fetchone()
            if row is None:
                return None
            return StoredEvent(
                event_id=int(row["id"]),
                created_at=str(row["created_at"]),
                event_type=str(row["event_type"]),
                agent_id=str(row["agent_id"]),
                severity=str(row["severity"]),
                payload_json=str(row["payload_json"]),
                chain_hash=str(row["chain_hash"]),
                prev_hash=str(row["prev_hash"]),
                tx_id=str(row["tx_id"]),
            )

    def recent_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        limit = max(1, min(500, int(limit)))
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM blockchain_events ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        out: List[Dict[str, Any]] = []
        for r in rows:
            out.append(
                {
                    "event_id": int(r["id"]),
                    "created_at": str(r["created_at"]),
                    "event_type": str(r["event_type"]),
                    "agent_id": str(r["agent_id"]),
                    "severity": str(r["severity"]),
                    "chain_hash": str(r["chain_hash"]),
                    "prev_hash": str(r["prev_hash"]),
                    "tx_id": str(r["tx_id"]),
                    "payload": json.loads(str(r["payload_json"])),
                }
            )
        return out

    def verify_event(self, event_id: int) -> Dict[str, Any]:
        ev = self.get_event(event_id)
        if ev is None:
            return {"event_id": event_id, "exists": False, "verified": False, "reason": "not_found"}

        recomputed = self.compute_hash(prev_hash=ev.prev_hash, canonical_payload=ev.payload_json)
        verified = recomputed == ev.chain_hash
        return {
            "event_id": ev.event_id,
            "exists": True,
            "verified": verified,
            "chain_hash": ev.chain_hash,
            "recomputed_hash": recomputed,
            "tx_id": ev.tx_id,
            "event_type": ev.event_type,
            "severity": ev.severity,
            "agent_id": ev.agent_id,
            "created_at": ev.created_at,
        }

    def verify_payload(self, payload: Dict[str, Any], prev_hash: str, expected_hash: str) -> Dict[str, Any]:
        canonical_payload = self.canonical_json(payload)
        recomputed = self.compute_hash(prev_hash=prev_hash, canonical_payload=canonical_payload)
        return {
            "verified": recomputed == expected_hash,
            "expected_hash": expected_hash,
            "recomputed_hash": recomputed,
            "prev_hash": prev_hash,
        }

    def stats(self) -> Dict[str, Any]:
        with self._connect() as conn:
            total = conn.execute("SELECT COUNT(*) AS c FROM blockchain_events").fetchone()["c"]
            last_hash = self._get_last_hash(conn)
        return {
            "db_path": str(self.db_path),
            "total_events": int(total),
            "last_hash": str(last_hash),
            "supabase_mirror_enabled": bool(self.supabase_mirror_enabled),
            "supabase_table": self.supabase_table,
            "supabase_mirror_ready": self._supabase_ready(),
            "last_mirror_error": self.last_mirror_error,
        }
