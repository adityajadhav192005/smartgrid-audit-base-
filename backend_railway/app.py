from __future__ import annotations

import hashlib
import json
import os
import shlex
import sqlite3
import subprocess
import sys
import threading
from uuid import uuid4
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field

app = FastAPI(
    title="SmartGrid Public API",
    version="1.0.0",
    description="Public backend for SmartGrid dashboard health and blockchain views.",
)

_configured_data_dir = os.environ.get("SMARTGRID_DATA_DIR", "").strip()
if _configured_data_dir:
    DATA_DIR = Path(_configured_data_dir)
else:
    DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "audit_chain.db"


class AnchorEventRequest(BaseModel):
    event_type: str = "manual_event"
    agent_id: str = "GEN-01"
    severity: str = "HIGH"
    payload: Dict[str, Any] = Field(default_factory=dict)


class VerifyPayloadRequest(BaseModel):
    payload: Dict[str, Any]
    prev_hash: str
    chain_hash: str


class RuntimeSettingsPayload(BaseModel):
    values: Dict[str, Any] = Field(default_factory=dict)
    runtime_overrides: Dict[str, Any] = Field(default_factory=dict)
    runtime_env: Dict[str, str] = Field(default_factory=dict)


class RunStartRequest(BaseModel):
    num_agents: int = Field(default=100, ge=50, le=1000)
    cycle_hours: int | None = Field(default=None, ge=1, le=24)
    ablation_mode: str = Field(default="HYBRID")
    notes: str = Field(default="")



def _security_guard(x_api_key: str | None = Header(default=None)) -> str:
    expected = os.environ.get("SMARTGRID_API_KEY", "smartgrid-dev-key")
    if x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return expected



def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn



def _chain_hash(event_type: str, agent_id: str, severity: str, timestamp: str, payload: Dict[str, Any], prev_hash: str) -> str:
    canonical = json.dumps(
        {
            "event_type": event_type,
            "agent_id": agent_id,
            "severity": severity,
            "timestamp": timestamp,
            "payload": payload,
            "prev_hash": prev_hash,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()



def _init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chain_events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                severity TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                payload TEXT NOT NULL,
                prev_hash TEXT NOT NULL,
                chain_hash TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS runtime_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                values_json TEXT NOT NULL,
                overrides_json TEXT NOT NULL,
                env_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS run_jobs (
                run_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                requested_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                params_json TEXT NOT NULL,
                summary_json TEXT,
                log_path TEXT,
                error_text TEXT,
                exit_code INTEGER
            )
            """
        )
        conn.commit()

        count = conn.execute("SELECT COUNT(*) AS c FROM chain_events").fetchone()["c"]
        if count == 0:
            prev_hash = "0" * 64
            seeds = [
                ("audit_decision", "GEN-04", "HIGH", {"deviation_score": 1.34, "anomaly_flag": 1}),
                ("anomaly_detected", "SUB-07", "MEDIUM", {"deviation_score": 0.92, "anomaly_flag": 0}),
                ("audit_decision", "BRK-12", "CRITICAL", {"deviation_score": 2.15, "anomaly_flag": 1}),
            ]
            for event_type, agent_id, severity, payload in seeds:
                timestamp = datetime.now(timezone.utc).isoformat()
                chain_hash = _chain_hash(event_type, agent_id, severity, timestamp, payload, prev_hash)
                conn.execute(
                    """
                    INSERT INTO chain_events (event_type, agent_id, severity, timestamp, payload, prev_hash, chain_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (event_type, agent_id, severity, timestamp, json.dumps(payload), prev_hash, chain_hash),
                )
                prev_hash = chain_hash
            conn.commit()

        settings_count = conn.execute("SELECT COUNT(*) AS c FROM runtime_settings WHERE id = 1").fetchone()["c"]
        if settings_count == 0:
            now_iso = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """
                INSERT INTO runtime_settings (id, values_json, overrides_json, env_json, updated_at)
                VALUES (1, ?, ?, ?, ?)
                """,
                (json.dumps({}), json.dumps({}), json.dumps({}), now_iso),
            )
            conn.commit()


def _to_run_response(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "run_id": row["run_id"],
        "status": row["status"],
        "requested_at": row["requested_at"],
        "started_at": row["started_at"],
        "finished_at": row["finished_at"],
        "params": json.loads(row["params_json"]) if row["params_json"] else {},
        "summary": json.loads(row["summary_json"]) if row["summary_json"] else None,
        "log_path": row["log_path"],
        "error": row["error_text"],
        "exit_code": row["exit_code"],
    }


def _execute_run(run_id: str) -> None:
    with _connect() as conn:
        row = conn.execute("SELECT params_json FROM run_jobs WHERE run_id = ?", (run_id,)).fetchone()
        if row is None:
            return
        params = json.loads(row["params_json"])
        started_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "UPDATE run_jobs SET status = ?, started_at = ? WHERE run_id = ?",
            ("running", started_at, run_id),
        )
        conn.commit()

    num_agents = int(params.get("num_agents", 100))
    cycle_hours = params.get("cycle_hours")
    ablation_mode = str(params.get("ablation_mode", "HYBRID")).upper()

    run_logs_dir = DATA_DIR / "run_logs"
    run_logs_dir.mkdir(parents=True, exist_ok=True)
    run_log_path = run_logs_dir / f"{run_id}.log"

    env = os.environ.copy()
    env["SMARTGRID_NUM_AGENTS"] = str(num_agents)
    env["SMARTGRID_SEEDS"] = env.get("SMARTGRID_SEEDS", "42")
    env["SMARTGRID_ABLATION"] = ablation_mode
    if cycle_hours is not None:
        env["SMARTGRID_CYCLE_HOURS"] = str(cycle_hours)

    workdir = Path(os.environ.get("SMARTGRID_WORKDIR", str(Path(__file__).resolve().parents[1])))
    run_cmd_raw = os.environ.get("SMARTGRID_RUN_COMMAND", "{python} -m smartgrid_mas.run_all")
    run_cmd = run_cmd_raw.replace("{python}", sys.executable)
    cmd = shlex.split(run_cmd)

    with run_log_path.open("w", encoding="utf-8") as log_file:
        completed = subprocess.run(
            cmd,
            cwd=str(workdir),
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
        )

    summary_path = workdir / "logs" / f"N{num_agents}" / "summary.json"
    summary_obj: Dict[str, Any] | None = None
    error_text: str | None = None

    if completed.returncode == 0 and summary_path.exists():
        try:
            summary_obj = json.loads(summary_path.read_text(encoding="utf-8"))
        except Exception as exc:
            error_text = f"Run completed but summary parse failed: {exc}"

    if completed.returncode != 0:
        error_text = f"Run command failed (exit={completed.returncode}). Check logs tail endpoint."
    elif not summary_obj and not error_text:
        error_text = f"Run completed but summary file not found at {summary_path}"

    finished_at = datetime.now(timezone.utc).isoformat()
    final_status = "completed" if completed.returncode == 0 and summary_obj else "failed"

    with _connect() as conn:
        conn.execute(
            """
            UPDATE run_jobs
            SET status = ?, finished_at = ?, summary_json = ?, log_path = ?, error_text = ?, exit_code = ?
            WHERE run_id = ?
            """,
            (
                final_status,
                finished_at,
                json.dumps(summary_obj, separators=(",", ":")) if summary_obj else None,
                str(run_log_path),
                error_text,
                int(completed.returncode),
                run_id,
            ),
        )
        conn.commit()


@app.on_event("startup")
def on_startup() -> None:
    _init_db()


@app.get("/")
def root() -> Dict[str, str]:
    return {"service": "smartgrid-public-api", "status": "ok"}


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/blockchain/status")
def blockchain_status(_: str = Depends(_security_guard)) -> Dict[str, Any]:
    with _connect() as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM chain_events").fetchone()["c"]
        row = conn.execute("SELECT chain_hash FROM chain_events ORDER BY event_id DESC LIMIT 1").fetchone()
    return {
        "db_path": str(DB_PATH.name),
        "total_events": int(total),
        "last_hash": row["chain_hash"] if row else "",
        "supabase_mirror_enabled": False,
        "supabase_table": "blockchain_events",
        "supabase_mirror_ready": False,
        "last_mirror_error": None,
        "enabled": True,
        "min_severity": "HIGH",
        "chain_ok": True,
        "backend": "railway-fastapi",
        "latest_hash": row["chain_hash"] if row else "",
    }


@app.get("/v1/blockchain/events")
def blockchain_events(
    limit: int = Query(default=50, ge=1, le=500),
    _: str = Depends(_security_guard),
) -> Dict[str, Any]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT event_id, event_type, agent_id, severity, timestamp, payload, prev_hash, chain_hash
            FROM chain_events
            ORDER BY event_id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    events: List[Dict[str, Any]] = []
    for row in rows:
        events.append(
            {
                "event_id": int(row["event_id"]),
                "event_type": row["event_type"],
                "agent_id": row["agent_id"],
                "severity": row["severity"],
                "timestamp": row["timestamp"],
                "payload": json.loads(row["payload"]),
                "prev_hash": row["prev_hash"],
                "chain_hash": row["chain_hash"],
            }
        )
    return {"events": events}


@app.post("/v1/blockchain/events")
def anchor_event(payload: AnchorEventRequest, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    with _connect() as conn:
        prev_row = conn.execute("SELECT chain_hash FROM chain_events ORDER BY event_id DESC LIMIT 1").fetchone()
        prev_hash = prev_row["chain_hash"] if prev_row else "0" * 64
        timestamp = datetime.now(timezone.utc).isoformat()
        chain_hash = _chain_hash(
            payload.event_type,
            payload.agent_id,
            payload.severity,
            timestamp,
            payload.payload,
            prev_hash,
        )
        cur = conn.execute(
            """
            INSERT INTO chain_events (event_type, agent_id, severity, timestamp, payload, prev_hash, chain_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.event_type,
                payload.agent_id,
                payload.severity,
                timestamp,
                json.dumps(payload.payload),
                prev_hash,
                chain_hash,
            ),
        )
        conn.commit()

    return {
        "event_id": int(cur.lastrowid or 0),
        "event_type": payload.event_type,
        "agent_id": payload.agent_id,
        "severity": payload.severity,
        "timestamp": timestamp,
        "payload": payload.payload,
        "prev_hash": prev_hash,
        "chain_hash": chain_hash,
    }


@app.get("/v1/blockchain/events/{event_id}/verify")
def verify_event(event_id: int, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT event_type, agent_id, severity, timestamp, payload, prev_hash, chain_hash
            FROM chain_events WHERE event_id = ?
            """,
            (event_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Event not found")

    payload = json.loads(row["payload"])
    computed = _chain_hash(
        row["event_type"],
        row["agent_id"],
        row["severity"],
        row["timestamp"],
        payload,
        row["prev_hash"],
    )
    return {"event_id": event_id, "verified": computed == row["chain_hash"], "computed_hash": computed}


@app.post("/v1/blockchain/verify-payload")
def verify_payload(payload: VerifyPayloadRequest, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    computed = _chain_hash(
        event_type=payload.payload.get("event_type", "manual_event"),
        agent_id=payload.payload.get("agent_id", "unknown"),
        severity=payload.payload.get("severity", "LOW"),
        timestamp=payload.payload.get("timestamp", ""),
        payload=payload.payload,
        prev_hash=payload.prev_hash,
    )
    return {"verified": computed == payload.chain_hash, "computed_hash": computed}


@app.get("/v1/settings/runtime")
def get_runtime_settings(_: str = Depends(_security_guard)) -> Dict[str, Any]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT values_json, overrides_json, env_json, updated_at
            FROM runtime_settings
            WHERE id = 1
            """
        ).fetchone()

    if row is None:
        return {
            "status": "ok",
            "values": {},
            "runtime_overrides": {},
            "runtime_env": {},
            "updated_at": None,
            "storage": "sqlite",
            "db_path": str(DB_PATH),
        }

    return {
        "status": "ok",
        "values": json.loads(row["values_json"]),
        "runtime_overrides": json.loads(row["overrides_json"]),
        "runtime_env": json.loads(row["env_json"]),
        "updated_at": row["updated_at"],
        "storage": "sqlite",
        "db_path": str(DB_PATH),
    }


@app.post("/v1/settings/runtime")
def save_runtime_settings(payload: RuntimeSettingsPayload, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO runtime_settings (id, values_json, overrides_json, env_json, updated_at)
            VALUES (1, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                values_json = excluded.values_json,
                overrides_json = excluded.overrides_json,
                env_json = excluded.env_json,
                updated_at = excluded.updated_at
            """,
            (
                json.dumps(payload.values, separators=(",", ":")),
                json.dumps(payload.runtime_overrides, separators=(",", ":")),
                json.dumps(payload.runtime_env, separators=(",", ":")),
                now_iso,
            ),
        )
        conn.commit()

    return {
        "status": "ok",
        "updated_at": now_iso,
        "storage": "sqlite",
        "db_path": str(DB_PATH),
    }


@app.post("/v1/runs/start")
def start_run(payload: RunStartRequest, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    run_id = f"run_{uuid4().hex[:12]}"
    requested_at = datetime.now(timezone.utc).isoformat()
    params = {
        "num_agents": payload.num_agents,
        "cycle_hours": payload.cycle_hours,
        "ablation_mode": payload.ablation_mode.upper(),
        "notes": payload.notes,
    }

    with _connect() as conn:
        active = conn.execute(
            "SELECT COUNT(*) AS c FROM run_jobs WHERE status IN ('queued', 'running')"
        ).fetchone()["c"]
        if active:
            raise HTTPException(status_code=409, detail="Another run is already active")

        conn.execute(
            """
            INSERT INTO run_jobs (run_id, status, requested_at, params_json)
            VALUES (?, ?, ?, ?)
            """,
            (run_id, "queued", requested_at, json.dumps(params, separators=(",", ":"))),
        )
        conn.commit()

    threading.Thread(target=_execute_run, args=(run_id,), daemon=True).start()
    return {"status": "ok", "run_id": run_id, "requested_at": requested_at, "params": params}


@app.get("/v1/runs")
def list_runs(limit: int = Query(default=10, ge=1, le=100), _: str = Depends(_security_guard)) -> Dict[str, Any]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM run_jobs ORDER BY requested_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return {"runs": [_to_run_response(row) for row in rows]}


@app.get("/v1/runs/latest")
def latest_run(_: str = Depends(_security_guard)) -> Dict[str, Any]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM run_jobs ORDER BY requested_at DESC LIMIT 1").fetchone()
    return {"run": _to_run_response(row) if row else None}


@app.get("/v1/runs/{run_id}")
def get_run(run_id: str, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM run_jobs WHERE run_id = ?", (run_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"run": _to_run_response(row)}


@app.get("/v1/runs/{run_id}/logs")
def get_run_logs(run_id: str, tail: int = Query(default=80, ge=10, le=500), _: str = Depends(_security_guard)) -> Dict[str, Any]:
    with _connect() as conn:
        row = conn.execute("SELECT log_path FROM run_jobs WHERE run_id = ?", (run_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Run not found")

    log_path = row["log_path"]
    if not log_path:
        return {"run_id": run_id, "lines": [], "detail": "Log not available yet"}

    path = Path(log_path)
    if not path.exists():
        return {"run_id": run_id, "lines": [], "detail": f"Log path not found: {log_path}"}

    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return {"run_id": run_id, "lines": lines[-tail:]}
