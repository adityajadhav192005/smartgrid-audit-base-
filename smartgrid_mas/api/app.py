from __future__ import annotations

import ast
import base64
import math
import time
import threading
import uuid
import subprocess
import shlex
from datetime import datetime, timezone
from collections import defaultdict, deque
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest
import json

import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from smartgrid_mas.behavior_analysis.deviation_score import deviation_score, anomaly_flag_from_score
from smartgrid_mas.xai.explain import explain_deviation, explain_audit_decision
from smartgrid_mas.integration.scada_adapter import (
    get_scada_algorithm_config,
    normalize_scada_tags,
    scada_tags_to_score_request,
)
from smartgrid_mas.integration.live_experiment_pipeline import LiveExperimentPipeline
from smartgrid_mas.integration.ids_adapter import recommend_action_from_alert


app = FastAPI(
    title="SmartGrid MAS API",
    version="0.1.0",
    description="REST API for SCADA integration, anomaly detection, and XAI.",
)


# ---------------------------------------------------------------------------
# Security guard (API key + simple rate limit + anti-replay)
# ---------------------------------------------------------------------------
_rate_window_sec = int(os.environ.get("SMARTGRID_API_RATE_WINDOW_SEC", "60"))
_rate_limit_per_window = int(os.environ.get("SMARTGRID_API_RATE_LIMIT", "120"))
_replay_window_sec = int(os.environ.get("SMARTGRID_API_REPLAY_WINDOW_SEC", "300"))
_rate_buckets: Dict[str, deque[float]] = defaultdict(deque)
_nonce_seen: Dict[str, float] = {}


def _prune_nonce_cache(now_ts: float) -> None:
    expired = [k for k, v in _nonce_seen.items() if v <= now_ts]
    for k in expired:
        _nonce_seen.pop(k, None)


def _security_guard(
    x_api_key: str | None = Header(default=None),
    x_timestamp: str | None = Header(default=None),
    x_nonce: str | None = Header(default=None),
) -> str:
    """Security gate: API key auth + rate limiting + optional anti-replay."""
    expected = os.environ.get("SMARTGRID_API_KEY", "smartgrid-dev-key")
    if x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    now_ts = time.time()

    # Optional timestamp check (seconds since epoch) to mitigate replay.
    if x_timestamp is not None:
        try:
            req_ts = float(x_timestamp)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid X-Timestamp header: {e}")
        if abs(now_ts - req_ts) > _replay_window_sec:
            raise HTTPException(status_code=401, detail="Request timestamp outside allowed window")

    # Optional nonce check (requires timestamp or same replay window semantics).
    _prune_nonce_cache(now_ts)
    if x_nonce:
        if x_nonce in _nonce_seen:
            raise HTTPException(status_code=401, detail="Replay detected: nonce already used")
        _nonce_seen[x_nonce] = now_ts + _replay_window_sec

    # Simple in-memory per-key sliding-window rate limiting.
    bucket = _rate_buckets[expected]
    while bucket and bucket[0] <= now_ts - _rate_window_sec:
        bucket.popleft()
    if len(bucket) >= _rate_limit_per_window:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    bucket.append(now_ts)

    return expected


class ScoreRequest(BaseModel):
    agent_id: str = "unknown"
    x_phys: List[float]
    y_cyber: List[float]
    bx: List[float]
    by: List[float]
    thx: List[float]
    thy: List[float]
    criticality_weight: float = Field(default=1.0, ge=0.0)
    score_threshold: float = Field(default=1.0, gt=0.0)
    feature_names_phys: Optional[List[str]] = None
    feature_names_cyber: Optional[List[str]] = None


class BatchScoreRequest(BaseModel):
    records: List[ScoreRequest]


class ScadaTagsRequest(BaseModel):
    agent_id: str
    tags: Dict[str, float]
    criticality_weight: float = Field(default=1.0, ge=0.0)
    score_threshold: float = Field(default=1.0, gt=0.0)
    source: str = "live"


class BatchScadaTagsRequest(BaseModel):
    records: List[ScadaTagsRequest]


class IdsAlertRequest(BaseModel):
    alert: Dict[str, Any]


class RuntimeSettingsPayload(BaseModel):
    values: Dict[str, Any] = Field(default_factory=dict)
    runtime_overrides: Dict[str, Any] = Field(default_factory=dict)
    runtime_env: Dict[str, str] = Field(default_factory=dict)


live_experiment_pipeline = LiveExperimentPipeline()


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


class RapidScadaLiveClient:
    def __init__(self) -> None:
        self.enabled = _env_bool("SMARTGRID_SCADA_LIVE_ENABLED", True)
        self.source_url = os.environ.get("SMARTGRID_SCADA_SOURCE_URL", "").strip()
        self.agent_id = os.environ.get("SMARTGRID_SCADA_AGENT_ID", "GEN-01").strip() or "GEN-01"
        self.poll_sec = max(1.0, float(os.environ.get("SMARTGRID_SCADA_POLL_SEC", "5")))
        self.timeout_sec = max(1.0, float(os.environ.get("SMARTGRID_SCADA_HTTP_TIMEOUT_SEC", "4")))
        self.criticality_weight = float(os.environ.get("SMARTGRID_SCADA_CRITICALITY_WEIGHT", "1.0"))
        self.score_threshold = float(os.environ.get("SMARTGRID_SCADA_SCORE_THRESHOLD", "3.0"))
        self.connected_grace_sec = max(
            self.poll_sec * 3.0,
            float(os.environ.get("SMARTGRID_SCADA_CONNECTED_GRACE_SEC", "60")),
        )

        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()

        self.last_attempt_ts: float | None = None
        self.last_success_ts: float | None = None
        self.consecutive_failures: int = 0
        self.last_error: str | None = None
        self.last_tags: Dict[str, float] = {}
        self.last_score: Dict[str, Any] | None = None
        self.agent_snapshots: Dict[str, Dict[str, Any]] = {}

    def ingest_snapshot(
        self,
        agent_id: str,
        tags: Dict[str, float],
        score: Dict[str, Any],
        source: str = "live",
        criticality_weight: float | None = None,
        score_threshold: float | None = None,
        update_primary: bool = False,
    ) -> None:
        with self._lock:
            now = time.time()
            normalized_agent_id = str(agent_id).strip() or self.agent_id
            self.agent_snapshots[normalized_agent_id] = {
                "agent_id": normalized_agent_id,
                "tags": dict(tags),
                "score": dict(score),
                "source": str(source or "live"),
                "criticality_weight": criticality_weight,
                "score_threshold": score_threshold,
                "last_update_utc": self._as_iso(now),
            }
            if update_primary:
                self.last_tags = dict(tags)
                self.last_score = dict(score)
                self.last_success_ts = now
                self.last_attempt_ts = now
                self.consecutive_failures = 0
                self.last_error = None

    def configured(self) -> bool:
        return bool(self.enabled and self.source_url)

    def _as_iso(self, ts: float | None) -> str | None:
        if ts is None:
            return None
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

    def _build_request_url(self) -> str:
        ts_ms = int(time.time() * 1000)
        parsed = urlparse.urlparse(self.source_url)
        query = dict(urlparse.parse_qsl(parsed.query, keep_blank_values=True))
        query["_ts"] = str(ts_ms)
        new_query = urlparse.urlencode(query)
        return urlparse.urlunparse(parsed._replace(query=new_query))

    def _extract_tags(self, payload: Any) -> Dict[str, float]:
        if not isinstance(payload, dict):
            raise ValueError("Rapid SCADA response must be a JSON object")

        # Accept either {"tags": {...}} or direct tag map
        candidate = payload.get("tags") if isinstance(payload.get("tags"), dict) else payload
        if not isinstance(candidate, dict):
            raise ValueError("Rapid SCADA response must contain a tag dictionary")

        tags: Dict[str, float] = {}
        for key, val in candidate.items():
            try:
                tags[str(key)] = float(val)
            except Exception:
                continue

        if not tags:
            raise ValueError("Rapid SCADA response contains no numeric tags")
        return tags

    def _fetch_tags(self) -> Dict[str, float]:
        url = self._build_request_url()
        user_agent = os.environ.get("SMARTGRID_SCADA_USER_AGENT", "smartgrid-mas-scada-poller/1.0")
        req = urlrequest.Request(
            url,
            headers={
                "Accept": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
                "User-Agent": user_agent,
                "bypass-tunnel-reminder": "1",
            },
        )
        with urlrequest.urlopen(req, timeout=self.timeout_sec) as resp:
            data = resp.read()
            payload = json.loads(data.decode("utf-8"))
        return self._extract_tags(payload)

    def poll_once(self) -> None:
        now = time.time()
        with self._lock:
            self.last_attempt_ts = now

        try:
            tags = normalize_scada_tags(self._fetch_tags())
            req_dict = scada_tags_to_score_request(
                agent_id=self.agent_id,
                tags=tags,
                criticality_weight=self.criticality_weight,
                score_threshold=self.score_threshold,
            )
            req = ScoreRequest(**req_dict)
            score = _score_core(req, anchor_event=False)
            self.ingest_snapshot(
                agent_id=self.agent_id,
                tags=tags,
                score=score,
                source="live",
                criticality_weight=self.criticality_weight,
                score_threshold=self.score_threshold,
                update_primary=True,
            )
        except (urlerror.URLError, TimeoutError, ValueError, json.JSONDecodeError) as e:
            with self._lock:
                self.consecutive_failures += 1
                self.last_error = str(e)

    def _run_loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.poll_once()
            except Exception as exc:  # noqa: BLE001
                with self._lock:
                    self.consecutive_failures += 1
                    self.last_error = f"Unhandled: {exc}"
            self._stop.wait(self.poll_sec)

    def start(self) -> None:
        if not self.configured() or self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run_loop, name="rapid-scada-live", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        if self._thread is None:
            return
        self._stop.set()
        self._thread.join(timeout=2.0)
        self._thread = None

    def status(self) -> Dict[str, Any]:
        with self._lock:
            now = time.time()
            max_age = self.connected_grace_sec
            newest_agent_ts = None
            for snapshot in self.agent_snapshots.values():
                ts_text = snapshot.get("last_update_utc")
                if not ts_text:
                    continue
                try:
                    parsed_ts = datetime.fromisoformat(str(ts_text)).timestamp()
                except Exception:
                    continue
                if newest_agent_ts is None or parsed_ts > newest_agent_ts:
                    newest_agent_ts = parsed_ts

            primary_recent = self.last_success_ts is not None and (now - self.last_success_ts) <= max_age
            any_agent_recent = newest_agent_ts is not None and (now - newest_agent_ts) <= max_age
            connected = primary_recent or any_agent_recent
            freshest_ts = self.last_success_ts
            if newest_agent_ts is not None and (freshest_ts is None or newest_agent_ts > freshest_ts):
                freshest_ts = newest_agent_ts
            age_sec = (now - freshest_ts) if freshest_ts is not None else None
            return {
                "enabled": self.enabled,
                "configured": bool(self.source_url),
                "source_url": self.source_url,
                "agent_id": self.agent_id,
                "poll_sec": self.poll_sec,
                "timeout_sec": self.timeout_sec,
                "connected_grace_sec": max_age,
                "connected": connected,
                "last_attempt_utc": self._as_iso(self.last_attempt_ts),
                "last_success_utc": self._as_iso(self.last_success_ts),
                "last_agent_update_utc": self._as_iso(newest_agent_ts),
                "data_age_sec": age_sec,
                "consecutive_failures": self.consecutive_failures,
                "last_error": self.last_error,
            }

    def snapshot(self) -> Dict[str, Any]:
        connection = self.status()
        with self._lock:
            tags = dict(self.last_tags)
            score = dict(self.last_score) if isinstance(self.last_score, dict) else None
            agent_scores = [
                dict(snapshot)
                for _, snapshot in sorted(self.agent_snapshots.items(), key=lambda item: item[0])
            ]
        return {
            "connection": connection,
            "live_tags": tags,
            "live_score": score,
            "agent_scores": agent_scores,
            "config": get_scada_algorithm_config(score_threshold=self.score_threshold),
            "experiment_pipeline": live_experiment_pipeline.status(),
            "server_time_utc": datetime.now(tz=timezone.utc).isoformat(),
        }


rapid_scada_live = RapidScadaLiveClient()
SCADA_PRIMARY_AGENT_ID = os.environ.get("SMARTGRID_SCADA_PRIMARY_AGENT_ID", "GEN-01").strip() or "GEN-01"

_runtime_settings_lock = threading.Lock()


def _runtime_settings_path() -> Path:
    env_path = os.environ.get("SMARTGRID_RUNTIME_SETTINGS_PATH", "").strip()
    if env_path:
        return Path(env_path)
    return Path("logs") / "runtime_settings.json"


def _load_runtime_settings() -> Dict[str, Any]:
    path = _runtime_settings_path()
    if not path.exists():
        return {
            "status": "ok",
            "values": {},
            "runtime_overrides": {},
            "runtime_env": {},
            "updated_at": None,
            "storage": "json",
            "path": str(path),
        }

    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        "status": "ok",
        "values": payload.get("values", {}),
        "runtime_overrides": payload.get("runtime_overrides", {}),
        "runtime_env": payload.get("runtime_env", {}),
        "updated_at": payload.get("updated_at"),
        "storage": "json",
        "path": str(path),
    }


def _save_runtime_settings(payload: RuntimeSettingsPayload) -> Dict[str, Any]:
    path = _runtime_settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    now_iso = _utc_now_iso()
    data = {
        "values": payload.values,
        "runtime_overrides": payload.runtime_overrides,
        "runtime_env": payload.runtime_env,
        "updated_at": now_iso,
    }
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return {
        "status": "ok",
        "updated_at": now_iso,
        "storage": "json",
        "path": str(path),
    }


class RunStartRequest(BaseModel):
    num_agents: int = Field(default=100, ge=1, le=5000)
    cycle_hours: int = Field(default=1, ge=1, le=24)
    episodes: int = Field(default=200, ge=1, le=10000)
    ablation_mode: str = "HYBRID"
    optimization_profile: str = "ROBUST"
    attack_profile: str = "FDI,DoS"
    notes: str = ""
    fdi_rate: Optional[float] = None
    dos_rate: Optional[float] = None
    chain_rate: Optional[float] = None
    lambda_audit: Optional[float] = None
    lambda_attack: Optional[float] = None
    attack_rates: Optional[Dict[str, float]] = None


_runs_lock = threading.Lock()
_runs: Dict[str, Dict[str, Any]] = {}
_run_logs: Dict[str, List[str]] = {}


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _append_run_log(run_id: str, line: str) -> None:
    with _runs_lock:
        logs = _run_logs.setdefault(run_id, [])
        logs.append(f"[{_utc_now_iso()}] {line}")


def _repo_workdir() -> Path:
    configured = os.environ.get("SMARTGRID_WORKDIR", "").strip()
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[2]


def _resolve_summary_path(workdir: Path, num_agents: int) -> Optional[Path]:
    direct = workdir / "logs" / f"N{num_agents}" / "summary.json"
    if direct.exists():
        return direct

    candidates = sorted((workdir / "logs").glob("**/summary.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if candidates:
        return candidates[0]
    return None


def _build_run_command() -> tuple[List[str], str]:
    default_cmd = [str(Path(os.sys.executable)), "-m", "smartgrid_mas.run_all"]
    cmd_template = os.environ.get("SMARTGRID_RUN_COMMAND", "{python} -m smartgrid_mas.run_all").strip()
    if not cmd_template:
        display = subprocess.list2cmdline(default_cmd) if os.name == "nt" else " ".join(default_cmd)
        return default_cmd, display

    if "{python}" in cmd_template:
        sentinel = "__SMARTGRID_PYTHON_EXEC__"
        templ = cmd_template.replace("{python}", sentinel)
        parts = shlex.split(templ, posix=(os.name != "nt"))
        cmd = [str(Path(os.sys.executable)) if p == sentinel else p.replace(sentinel, str(Path(os.sys.executable))) for p in parts]
    else:
        cmd = shlex.split(cmd_template, posix=(os.name != "nt"))

    if not cmd:
        cmd = default_cmd

    display = subprocess.list2cmdline(cmd) if os.name == "nt" else " ".join(cmd)
    return cmd, display


def _simulate_run_lifecycle(run_id: str) -> None:
    try:
        with _runs_lock:
            record = _runs.get(run_id)
            if not record:
                return
            params = dict(record.get("params", {}))

        num_agents = int(params.get("num_agents", 100))
        cycle_hours = int(params.get("cycle_hours", 24))
        episodes = int(params.get("episodes", 200))
        ablation_mode = str(params.get("ablation_mode", "HYBRID")).upper()
        optimization_profile = str(params.get("optimization_profile", "ROBUST")).upper()
        if optimization_profile not in {"ROBUST", "BALANCED", "COST"}:
            optimization_profile = "ROBUST"
        fdi_rate = float(params.get("fdi_rate", 0.10))
        dos_rate = float(params.get("dos_rate", 0.05))
        chain_rate = float(params.get("chain_rate", 0.20))
        lambda_audit = params.get("lambda_audit")
        lambda_attack = params.get("lambda_attack")

        derived_seed = (sum(ord(ch) for ch in run_id) % 100000) + 1
        seeds_env = os.environ.get("SMARTGRID_SEEDS", "").strip() or str(derived_seed)

        with _runs_lock:
            if run_id in _runs:
                _runs[run_id]["status"] = "running"
                _runs[run_id]["updated_at"] = _utc_now_iso()

        _append_run_log(run_id, "Run accepted by scheduler")
        _append_run_log(run_id, f"Config: N={num_agents}, episodes={episodes}, mode={ablation_mode}, profile={optimization_profile}, cycle_hours={cycle_hours}")
        _append_run_log(run_id, f"Attack rates: fdi={fdi_rate:.4f}, dos={dos_rate:.4f}, chain={chain_rate:.4f}")
        if lambda_audit is not None or lambda_attack is not None:
            _append_run_log(run_id, f"Reward weights: lambda_audit={lambda_audit}, lambda_attack={lambda_attack}")
        _append_run_log(run_id, f"Seed(s): {seeds_env}")

        workdir = _repo_workdir()
        env = os.environ.copy()
        env["SMARTGRID_NUM_AGENTS"] = str(num_agents)
        env["SMARTGRID_CYCLE_HOURS"] = str(cycle_hours)
        env["SMARTGRID_ABLATION"] = ablation_mode
        env["SMARTGRID_OPTIMIZATION_PROFILE"] = optimization_profile
        env["SMARTGRID_FDI_RATE"] = str(fdi_rate)
        env["SMARTGRID_DOS_RATE"] = str(dos_rate)
        env["SMARTGRID_CHAIN_RATE"] = str(chain_rate)
        env["SMARTGRID_SEEDS"] = seeds_env
        if lambda_audit is not None:
            env["SMARTGRID_RW_AUDIT"] = str(float(lambda_audit))
        if lambda_attack is not None:
            env["SMARTGRID_RW_ATTACK"] = str(float(lambda_attack))

        cmd, display_cmd = _build_run_command()

        _append_run_log(run_id, f"Launching: {display_cmd}")

        process = subprocess.Popen(
            cmd,
            cwd=str(workdir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        if process.stdout is not None:
            for line in process.stdout:
                cleaned = line.rstrip()
                if cleaned:
                    _append_run_log(run_id, cleaned)

        return_code = process.wait()
        if return_code != 0:
            raise RuntimeError(f"run_all exited with code {return_code}")

        summary_path = _resolve_summary_path(workdir, num_agents)
        if summary_path is None or not summary_path.exists():
            raise FileNotFoundError("Run finished but summary.json was not produced")

        summary = json.loads(summary_path.read_text(encoding="utf-8"))

        with _runs_lock:
            if run_id in _runs:
                _runs[run_id]["summary"] = summary
                _runs[run_id]["status"] = "completed"
                _runs[run_id]["finished_at"] = _utc_now_iso()
                _runs[run_id]["updated_at"] = _utc_now_iso()

        _append_run_log(run_id, f"Summary loaded from: {summary_path}")
        _append_run_log(run_id, "Run completed successfully")
    except Exception as exc:
        with _runs_lock:
            if run_id in _runs:
                _runs[run_id]["status"] = "failed"
                _runs[run_id]["error"] = str(exc)
                _runs[run_id]["finished_at"] = _utc_now_iso()
                _runs[run_id]["updated_at"] = _utc_now_iso()
        _append_run_log(run_id, f"Run failed: {exc}")


def _severity_from_score(score: float, threshold: float) -> str:
    if threshold <= 0:
        return "LOW"
    ratio = float(score) / float(threshold)
    if ratio >= 2.0:
        return "CRITICAL"
    if ratio >= 1.0:
        return "HIGH"
    if ratio >= 0.7:
        return "MEDIUM"
    return "LOW"


def _latest_summary_path() -> Path:
    env_path = os.environ.get("SMARTGRID_SUMMARY_PATH", "").strip()
    if env_path:
        p = Path(env_path)
        if p.exists():
            return p

    candidates = sorted(Path("logs").glob("**/summary.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise FileNotFoundError("No summary.json found under logs/")
    return candidates[0]


def _latest_run_record() -> Dict[str, Any] | None:
    with _runs_lock:
        if not _runs:
            return None
        return sorted(_runs.values(), key=lambda item: item.get("started_at") or "", reverse=True)[0]


def _map_numeric_agent_id(raw_agent_id: Any) -> str:
    try:
        seq = int(raw_agent_id) + 1
    except Exception:
        return str(raw_agent_id)
    if seq <= 20:
        return f"GEN-{seq:02d}"
    if seq <= 50:
        return f"SUB-{seq:02d}"
    if seq <= 75:
        return f"PMU-{seq:02d}"
    return f"BRK-{seq:02d}"


def _parse_maybe_literal(value: Any) -> Dict[str, Any] | List[Any]:
    if isinstance(value, (dict, list)):
        return value
    if value is None:
        return {}
    text = str(value).strip()
    if not text:
        return {}
    try:
        parsed = ast.literal_eval(text)
        if isinstance(parsed, (dict, list)):
            return parsed
    except Exception:
        pass
    return {}


def _latest_experiment_artifacts() -> tuple[Path, Dict[str, Any], Path | None, pd.DataFrame | None]:
    summary_path = _latest_summary_path()
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    events_path = summary_path.with_name("events_dynamic.csv")
    if not events_path.exists():
        return summary_path, summary, None, None
    # Limit to last 5000 rows to avoid reading the full 40MB+ file on every call
    total = sum(1 for _ in open(events_path, encoding="utf-8")) - 1  # exclude header
    skip = max(0, total - 5000)
    df = pd.read_csv(events_path, skiprows=range(1, skip + 1) if skip > 0 else None)
    return summary_path, summary, events_path, df


def _build_experiment_telemetry() -> Dict[str, Any]:
    summary_path, summary, events_path, events_df = _latest_experiment_artifacts()
    threshold = float(((summary.get("config") or {}).get("risk_threshold", 0.5)) if isinstance(summary.get("config"), dict) else 0.5)

    trend: List[Dict[str, Any]] = []
    events: List[Dict[str, Any]] = []
    agents: List[Dict[str, Any]] = []

    if events_df is not None and not events_df.empty:
        df = events_df.copy()
        if "t" in df.columns:
            grouped = df.groupby("t", sort=True)
            for step, frame in grouped:
                risk_scores = []
                anomaly_count = 0
                attack_count = 0
                audit_count = 0
                for _, row in frame.iterrows():
                    xai_decision = _parse_maybe_literal(row.get("xai_decision"))
                    risk_score = float(xai_decision.get("risk_score", 0.0) or 0.0) if isinstance(xai_decision, dict) else 0.0
                    risk_scores.append(risk_score)
                    if risk_score > threshold:
                        anomaly_count += 1
                    if str(row.get("severity_level", "")).upper() == "CRITICAL":
                        attack_count += 1
                    if str(row.get("audit_success", "")).lower() == "true":
                        audit_count += 1
                trend.append({
                    "time": f"T{int(step):02d}" if pd.notna(step) else "T00",
                    "anomalyScore": float(sum(risk_scores) / len(risk_scores)) if risk_scores else 0.0,
                    "riskScore": float(sum(risk_scores) / len(risk_scores)) if risk_scores else 0.0,
                    "auditCount": int(audit_count),
                    "attackCount": int(attack_count),
                    "anomalyCount": int(anomaly_count),
                })

        latest_rows = df.sort_values(by=["t"] if "t" in df.columns else df.index.tolist()[:1]).groupby("agent_id", as_index=False).tail(1)
        for _, row in latest_rows.iterrows():
            xai_decision = _parse_maybe_literal(row.get("xai_decision"))
            xai_physical = _parse_maybe_literal(row.get("xai_top_physical"))
            xai_cyber = _parse_maybe_literal(row.get("xai_top_cyber"))
            risk_score = float(xai_decision.get("risk_score", 0.0) or 0.0) if isinstance(xai_decision, dict) else 0.0
            severity = str(row.get("severity_level", "LOW") or "LOW").upper()
            agent_id = _map_numeric_agent_id(row.get("agent_id"))
            agent_type = "Generator" if agent_id.startswith("GEN-") else "Substation" if agent_id.startswith("SUB-") else "PMU" if agent_id.startswith("PMU-") else "Breaker"
            audit_success = str(row.get("audit_success", "")).lower() == "true"
            agents.append({
                "id": agent_id,
                "type": agent_type,
                "anomalyScore": risk_score,
                "riskScore": risk_score,
                "attack": str(row.get("action", "NO_ANOMALY")),
                "auditCount": 1 if audit_success else 0,
                "severity": severity,
                "scoreThreshold": threshold,
                "xai": {
                    "physical": {"top_features": xai_physical if isinstance(xai_physical, list) else []},
                    "cyber": {"top_features": xai_cyber if isinstance(xai_cyber, list) else []},
                    "decision": xai_decision if isinstance(xai_decision, dict) else {},
                },
                "source": "experiment",
                "criticalityWeight": 1.0 if agent_type == "Generator" else 0.7 if agent_type == "Substation" else 0.3 if agent_type == "PMU" else 0.5,
            })

        latest_event_rows = df.tail(30)
        for index, row in latest_event_rows.iterrows():
            xai_decision = _parse_maybe_literal(row.get("xai_decision"))
            risk_score = float(xai_decision.get("risk_score", 0.0) or 0.0) if isinstance(xai_decision, dict) else 0.0
            agent_id = _map_numeric_agent_id(row.get("agent_id"))
            severity = str(row.get("severity_level", "LOW") or "LOW").lower()
            action = str(row.get("action", "EVENT"))
            events.append({
                "id": f"exp-{index}",
                "ts": f"T{int(row.get('t', 0)):02d}" if pd.notna(row.get("t", 0)) else "T00",
                "type": action.upper(),
                "severity": severity,
                "msg": f"{agent_id} - experiment - score {risk_score:.3f} - action {action}",
            })

    agents = sorted(agents, key=lambda item: float(item.get("riskScore", 0.0)), reverse=True)
    top_agents = agents[:8]
    counts = {
        "healthy": len([a for a in agents if float(a["riskScore"]) < threshold * 0.7]),
        "suspect": len([a for a in agents if threshold * 0.7 <= float(a["riskScore"]) < threshold]),
        "anomalous": len([a for a in agents if threshold <= float(a["riskScore"]) < threshold * 2]),
        "attacked": len([a for a in agents if float(a["riskScore"]) >= threshold * 2]),
        "underAudit": len([a for a in agents if int(a["auditCount"]) > 0 and threshold <= float(a["riskScore"]) < threshold * 2]),
    }
    attack_distribution: Dict[str, int] = defaultdict(int)
    for event in events:
        attack_distribution[str(event["type"])] += 1

    per_attack_raw = summary.get("per_attack_metrics") or {}
    per_attack_metrics: Dict[str, Any] = {}
    if isinstance(per_attack_raw, dict):
        for key, value in per_attack_raw.items():
            if not isinstance(value, dict):
                continue
            per_attack_metrics[str(key).upper()] = {
                "tpr": float(value.get("tpr", 0.0) or 0.0),
                "tnr": float(value.get("tnr", 0.0) or 0.0),
                "fpr": float(value.get("fpr", 0.0) or 0.0),
                "fnr": float(value.get("fnr", 0.0) or 0.0),
                "accuracy": float(value.get("accuracy", 0.0) or 0.0),
                "support": int(value.get("support", 0) or 0),
                "predictedSupport": int(value.get("predicted_support", 0) or 0),
            }

    statistical_tests_raw = summary.get("statistical_tests") or {}
    statistical_tests: Dict[str, Any] = {}
    if isinstance(statistical_tests_raw, dict):
        for key, value in statistical_tests_raw.items():
            if not isinstance(value, dict):
                continue
            p_val = value.get("p_value")
            try:
                p_val_num = float(p_val) if p_val is not None else None
                if p_val_num is not None and (math.isnan(p_val_num) or math.isinf(p_val_num)):
                    p_val_num = None
            except Exception:
                p_val_num = None
            statistical_tests[str(key)] = {
                "pValue": p_val_num,
                "test": str(value.get("test", "unknown")),
                "significant": bool(value.get("significant", False)),
            }

    attack_typing_metrics_raw = summary.get("attack_typing_metrics") or {}
    attack_typing = {
        "typingAccuracy": float(attack_typing_metrics_raw.get("typing_accuracy", 0.0) or 0.0) if isinstance(attack_typing_metrics_raw, dict) else 0.0,
        "macroTpr": float(attack_typing_metrics_raw.get("macro_tpr", 0.0) or 0.0) if isinstance(attack_typing_metrics_raw, dict) else 0.0,
        "macroFpr": float(attack_typing_metrics_raw.get("macro_fpr", 0.0) or 0.0) if isinstance(attack_typing_metrics_raw, dict) else 0.0,
        "positiveSupport": int(attack_typing_metrics_raw.get("positive_support", 0) or 0) if isinstance(attack_typing_metrics_raw, dict) else 0,
    }

    severity_level_distribution_raw = summary.get("severity_level_distribution") or {}
    severity_level_distribution = {
        str(k).upper(): int(v or 0)
        for k, v in (severity_level_distribution_raw.items() if isinstance(severity_level_distribution_raw, dict) else [])
    }

    # Build attack type distribution from per_attack_metrics support (real attack family counts)
    attack_family_distribution: List[Dict[str, Any]] = []
    for key, value in per_attack_metrics.items():
        if key == "NONE":
            continue
        attack_family_distribution.append({
            "name": key,
            "support": int(value.get("support", 0) or 0),
            "detected": int(value.get("predictedSupport", 0) or 0),
            "tpr": float(value.get("tpr", 0.0) or 0.0),
            "fnr": float(value.get("fnr", 0.0) or 0.0),
        })

    # Audit frequency by agent type from agents list
    audit_by_type: Dict[str, Dict[str, float]] = {}
    for agent in agents:
        atype = str(agent.get("type", "Unknown"))
        bucket = audit_by_type.setdefault(atype, {"count": 0.0, "audits": 0.0, "criticality": 0.0, "risk": 0.0})
        bucket["count"] += 1.0
        bucket["audits"] += float(agent.get("auditCount", 0) or 0)
        bucket["criticality"] += float(agent.get("criticalityWeight", 0.0) or 0.0)
        bucket["risk"] += float(agent.get("riskScore", 0.0) or 0.0)
    audit_frequency_by_type = []
    for atype, vals in audit_by_type.items():
        n = max(1.0, vals["count"])
        audit_frequency_by_type.append({
            "agentType": atype,
            "count": int(vals["count"]),
            "meanAuditCount": float(vals["audits"] / n),
            "meanCriticality": float(vals["criticality"] / n),
            "meanRisk": float(vals["risk"] / n),
        })

    convergence = {
        "rlIterations": int(summary.get("rl_iterations", 0) or 0),
        "rlConverged": bool(summary.get("rl_converged", False)),
        "rlEpsilonFinal": float(summary.get("rl_epsilon_final", 0.0) or 0.0),
        "gradientIterations": int(summary.get("gradient_iterations", 0) or 0),
        "gradientConverged": bool(summary.get("gradient_converged", False)),
    }

    optimization_profile = str(summary.get("optimization_profile", "ROBUST") or os.environ.get("SMARTGRID_OPTIMIZATION_PROFILE", "ROBUST")).upper()
    ablation_mode = str(summary.get("ablation_mode", "HYBRID") or os.environ.get("SMARTGRID_ABLATION", "HYBRID")).upper()

    return {
        "source": str(summary_path),
        "events_source": str(events_path) if events_path else None,
        "summary": {
            "totalAgents": int(summary.get("n_agents", summary.get("total_agents", 0)) or 0),
            "detectionAccuracy": float(summary.get("accuracy", 0.0) or 0.0),
            "riskMitigation": float(summary.get("risk_mitigation", 0.0) or 0.0),
            "costEfficiency": float(summary.get("cost_efficiency", 0.0) or 0.0),
            "auditCoverage": float(summary.get("coverage_cycle_dynamic", 0.0) or 0.0),
            "precision": float(summary.get("precision", 0.0) or 0.0),
            "recall": float(summary.get("recall", 0.0) or 0.0),
            "f1": float(summary.get("f1", 0.0) or 0.0),
            "fpr": float(summary.get("fpr", 0.0) or 0.0),
            "fnr": float(summary.get("fnr", 0.0) or 0.0),
            "tpr": float(summary.get("tpr", 0.0) or 0.0),
            "tnr": float(summary.get("tnr", 0.0) or 0.0),
            "tp": int(summary.get("tp", 0) or 0),
            "fp": int(summary.get("fp", 0) or 0),
            "fn": int(summary.get("fn", 0) or 0),
            "tn": int(summary.get("tn", 0) or 0),
            "attackRateDynamic": float(summary.get("attack_rate_dyn", summary.get("dynamic_mean_attack_rate", 0.0)) or 0.0),
            "attackRateBaseline": float(summary.get("attack_rate_base", summary.get("baseline_mean_attack_rate", 0.0)) or 0.0),
            "attackRateReduction": float(summary.get("attack_rate_reduction", 0.0) or 0.0),
            "costAdjustedMitigation": float(summary.get("cost_adjusted_mitigation", 0.0) or 0.0),
            "auditsPerMitigationPoint": float(summary.get("audits_per_mitigation_point", 0.0) or 0.0),
            "riskReducedPerCost": float(summary.get("risk_reduced_per_cost", 0.0) or 0.0),
            "crossLayerStability": float((summary.get("cross_layer_stability") or {}).get("index", 0.0) if isinstance(summary.get("cross_layer_stability"), dict) else 0.0),
            "runId": _build_live_verification(summary=pd.Series(summary), summary_path=summary_path).get("run_id"),
            "status": _build_live_verification(summary=pd.Series(summary), summary_path=summary_path).get("status"),
            "scoreThreshold": threshold,
            "perAttackMetrics": per_attack_metrics,
            "statisticalTests": statistical_tests,
            "attackTyping": attack_typing,
            "severityLevelDistribution": severity_level_distribution,
            "convergence": convergence,
            "optimizationProfile": optimization_profile,
            "ablationMode": ablation_mode,
            "attackFamilyDistribution": attack_family_distribution,
            "auditFrequencyByType": audit_frequency_by_type,
        },
        "trend": trend[-24:],
        "events": list(reversed(events[-20:])),
        "agents": agents,
        "topAgents": top_agents,
        "statusCounts": counts,
        "attackTypeDistribution": [{"name": k, "value": v} for k, v in attack_distribution.items()],
        "health": {
            "crossLayerStability": float((summary.get("cross_layer_stability") or {}).get("index", 0.0) if isinstance(summary.get("cross_layer_stability"), dict) else 0.0),
            "attackResistance": max(0.0, min(1.0, 1.0 - float(summary.get("dynamic_mean_attack_rate", 0.0) or 0.0))),
            "risk": float(summary.get("mean_global_risk_dynamic", 0.0) or 0.0),
            "anomaly": float(summary.get("avg_severity_score", 0.0) or 0.0),
        },
    }


def _build_live_verification(summary: pd.Series | None = None, summary_path: Path | None = None) -> Dict[str, Any]:
    run = _latest_run_record()
    summary_dict: Dict[str, Any] = {}
    if summary is not None:
        try:
            summary_dict = summary.to_dict() if hasattr(summary, "to_dict") else dict(summary)
        except Exception:
            summary_dict = {}

    attacks_detected = int(summary_dict.get("total_detected", summary_dict.get("anomaly_count", 0)) or 0)
    attacks_resolved = int(summary_dict.get("resolved_attacks", summary_dict.get("attacks_resolved", 0)) or 0)
    risk_mitigation = float(summary_dict.get("risk_mitigation", 0.0) or 0.0)
    total_agents = int(summary_dict.get("n_agents", summary_dict.get("total_agents", 0)) or 0)

    if run:
        run_summary = run.get("summary") or {}
        attacks_detected = int(
            run_summary.get("total_detected", run_summary.get("anomaly_count", attacks_detected)) or attacks_detected
        )
        attacks_resolved = int(
            run_summary.get("resolved_attacks", run_summary.get("attacks_resolved", attacks_resolved)) or attacks_resolved
        )
        risk_mitigation = float(run_summary.get("risk_mitigation", risk_mitigation) or risk_mitigation)
        total_agents = int(run_summary.get("total_agents", run_summary.get("n_agents", total_agents)) or total_agents)

    fallback_run_id = None
    fallback_updated_at = None
    if summary_path and summary_path.exists():
        try:
            fallback_run_id = f"SUMMARY-{summary_path.parent.name.upper()}"
            fallback_updated_at = datetime.fromtimestamp(summary_path.stat().st_mtime, tz=timezone.utc).isoformat()
        except Exception:
            fallback_run_id = None
            fallback_updated_at = None

    return {
        "run_id": (run or {}).get("run_id") or fallback_run_id,
        "status": str((run or {}).get("status") or ("completed" if summary_path else "live")),
        "attacks_detected": attacks_detected,
        "attacks_resolved": attacks_resolved,
        "risk_mitigation": risk_mitigation,
        "total_agents": total_agents,
        "source": str(summary_path) if summary_path else None,
        "updated_at": (run or {}).get("updated_at") or fallback_updated_at,
    }


def _explanations_path() -> Path:
    env_path = os.environ.get("SMARTGRID_EXPLANATIONS_PATH", "").strip()
    if env_path:
        p = Path(env_path)
        if p.exists():
            return p

    default_p = Path("logs") / "audit_explanations.csv"
    if default_p.exists():
        return default_p
    raise FileNotFoundError("No explanations CSV found. Set SMARTGRID_EXPLANATIONS_PATH or generate logs/audit_explanations.csv")


def _score_core(payload: ScoreRequest, anchor_event: bool = False) -> Dict[str, Any]:
    score = deviation_score(
        x_phys=np.asarray(payload.x_phys, dtype=float),
        bx=np.asarray(payload.bx, dtype=float),
        thx=np.asarray(payload.thx, dtype=float),
        y_cyber=np.asarray(payload.y_cyber, dtype=float),
        by=np.asarray(payload.by, dtype=float),
        thy=np.asarray(payload.thy, dtype=float),
        w_i=float(payload.criticality_weight),
    )
    flag = anomaly_flag_from_score(score, threshold=payload.score_threshold)

    xai_phys = explain_deviation(
        obs=payload.x_phys,
        base=payload.bx,
        th=payload.thx,
        feature_names=payload.feature_names_phys,
    )
    xai_cyber = explain_deviation(
        obs=payload.y_cyber,
        base=payload.by,
        th=payload.thy,
        feature_names=payload.feature_names_cyber,
    )

    action = "INCREASE_AUDIT" if flag == 1 else "MAINTAIN_AUDIT"
    decision_xai = explain_audit_decision(
        risk_score=float(score),
        risk_threshold=float(payload.score_threshold),
        action=action,
    )

    result = {
        "agent_id": payload.agent_id,
        "deviation_score": float(score),
        "anomaly_flag": int(flag),
        "risk_score": float(score),
        "decision": action,
        "xai": {
            "physical": xai_phys,
            "cyber": xai_cyber,
            "decision": decision_xai,
        },
    }

    severity = _severity_from_score(float(score), float(payload.score_threshold))
    result["severity"] = severity
    return result


def _process_scada_tags_payload(payload: ScadaTagsRequest) -> Dict[str, Any]:
    results = _process_scada_tags_batch_payload(BatchScadaTagsRequest(records=[payload]))
    if not results:
        raise ValueError("No SCADA results produced")
    return results[0]


def _process_scada_tags_batch_payload(payload: BatchScadaTagsRequest) -> List[Dict[str, Any]]:
    prepared_records: List[Dict[str, Any]] = []
    for record in payload.records:
        normalized_tags = normalize_scada_tags(record.tags)
        req_dict = scada_tags_to_score_request(
            agent_id=record.agent_id,
            tags=normalized_tags,
            criticality_weight=record.criticality_weight,
            score_threshold=record.score_threshold,
        )
        prepared_records.append(
            {
                "payload": record,
                "normalized_tags": normalized_tags,
                "normalized_request": req_dict,
            }
        )

    experiment_results: Dict[str, Dict[str, Any]] = {}
    if live_experiment_pipeline.enabled:
        experiment_results = live_experiment_pipeline.process_batch(
            [item["normalized_request"] for item in prepared_records]
        )

    outputs: List[Dict[str, Any]] = []
    for item in prepared_records:
        record = item["payload"]
        normalized_tags = item["normalized_tags"]
        req_dict = item["normalized_request"]
        req = ScoreRequest(**req_dict)

        result = experiment_results.get(record.agent_id)
        if result is None:
            result = _score_core(req, anchor_event=False)

        is_primary_agent = str(record.agent_id).strip().upper() == SCADA_PRIMARY_AGENT_ID.upper()
        payload_source = str(getattr(record, "source", "live") or "live").strip().lower()
        rapid_scada_live.ingest_snapshot(
            agent_id=record.agent_id,
            tags=normalized_tags,
            score=result,
            source=payload_source,
            criticality_weight=record.criticality_weight,
            score_threshold=record.score_threshold,
            update_primary=is_primary_agent,
        )

        outputs.append(
            {
                "normalized_request": req_dict,
                "normalized_tags": normalized_tags,
                "result": result,
            }
        )

    return outputs


def _process_scada_tags_payload_legacy(payload: ScadaTagsRequest) -> Dict[str, Any]:
    normalized_tags = normalize_scada_tags(payload.tags)
    req_dict = scada_tags_to_score_request(
        agent_id=payload.agent_id,
        tags=normalized_tags,
        criticality_weight=payload.criticality_weight,
        score_threshold=payload.score_threshold,
    )
    req = ScoreRequest(**req_dict)
    result = _score_core(req, anchor_event=False)
    is_primary_agent = str(payload.agent_id).strip().upper() == SCADA_PRIMARY_AGENT_ID.upper()
    payload_source = str(getattr(payload, "source", "live") or "live").strip().lower()
    rapid_scada_live.ingest_snapshot(
        agent_id=payload.agent_id,
        tags=normalized_tags,
        score=result,
        source=payload_source,
        criticality_weight=payload.criticality_weight,
        score_threshold=payload.score_threshold,
        update_primary=is_primary_agent,
    )
    return {
        "normalized_request": req_dict,
        "normalized_tags": normalized_tags,
        "result": result,
    }


@app.on_event("startup")
def startup_event() -> None:
    rapid_scada_live.start()


@app.on_event("shutdown")
def shutdown_event() -> None:
    rapid_scada_live.stop()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}



@app.get("/grid/status")
def grid_status() -> Dict[str, Any]:
    """Dashboard-friendly endpoint with core run status metrics."""
    server_time_utc = datetime.now(tz=timezone.utc).isoformat()
    live_snapshot = rapid_scada_live.snapshot()

    try:
        summary_path = _latest_summary_path()
        summary = pd.read_json(summary_path, typ="series")
        live_verification = _build_live_verification(summary=summary, summary_path=summary_path)
        return {
            "source": str(summary_path),
            "server_time_utc": server_time_utc,
            "n_agents": 100,
            "risk_threshold": float(summary.get("config", {}).get("risk_threshold", 0.0)) if isinstance(summary.get("config", {}), dict) else None,
            "global_risk": float(summary.get("mean_global_risk_dynamic", 0.0)),
            "attack_rate": float(summary.get("dynamic_mean_attack_rate", 0.0)),
            "cost_efficiency": float(summary.get("cost_efficiency", 0.0)),
            "risk_mitigation": float(summary.get("risk_mitigation", 0.0)),
            "coverage": float(summary.get("coverage_cycle_dynamic", 0.0)),
            "precision": float(summary.get("precision", 0.0)),
            "recall": float(summary.get("recall", 0.0)),
            "f1": float(summary.get("f1", 0.0)),
            "avg_end_to_end_delay_ms": float(summary.get("avg_end_to_end_delay_ms", 0.0)),
            "live_verification": live_verification,
            "rapid_scada": live_snapshot,
        }
    except Exception as e:
        # Keep endpoint live even when summary is missing; return live SCADA state + error context.
        return {
            "source": None,
            "server_time_utc": server_time_utc,
            "n_agents": 100,
            "summary_error": str(e),
            "live_verification": _build_live_verification(),
            "rapid_scada": live_snapshot,
        }


@app.get("/experiment/telemetry")
def experiment_telemetry() -> Dict[str, Any]:
    try:
        return _build_experiment_telemetry()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build experiment telemetry: {e}")


@app.get("/v1/scada/live")
def scada_live(_: str = Depends(_security_guard)) -> Dict[str, Any]:
    return rapid_scada_live.snapshot()


@app.get("/v1/settings/runtime")
def get_runtime_settings(_: str = Depends(_security_guard)) -> Dict[str, Any]:
    try:
        with _runtime_settings_lock:
            return _load_runtime_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load runtime settings: {e}")


@app.post("/v1/settings/runtime")
def save_runtime_settings(payload: RuntimeSettingsPayload, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    try:
        with _runtime_settings_lock:
            return _save_runtime_settings(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to persist runtime settings: {e}")


@app.post("/v1/scada/live/refresh")
def scada_live_refresh(_: str = Depends(_security_guard)) -> Dict[str, Any]:
    rapid_scada_live.poll_once()
    return rapid_scada_live.snapshot()


@app.get("/audit/explain/{agent_id}")
def audit_explain(agent_id: str, top_k: int = 5) -> Dict[str, Any]:
    """Return latest explanation rows for a given agent_id from SHAP export CSV."""
    try:
        csv_path = _explanations_path()
        df = pd.read_csv(csv_path)
        if "agent_id" not in df.columns:
            raise ValueError("explanations CSV missing required column: agent_id")

        df_agent = df[df["agent_id"].astype(str) == str(agent_id)]
        if df_agent.empty:
            return {
                "agent_id": str(agent_id),
                "source": str(csv_path),
                "count": 0,
                "results": [],
            }

        sort_cols = [c for c in ["window_end_t", "pred_proba", "shap_total_abs"] if c in df_agent.columns]
        if sort_cols:
            df_agent = df_agent.sort_values(by=sort_cols, ascending=False)

        k = max(1, int(top_k))
        out = df_agent.head(k).to_dict(orient="records")
        return {
            "agent_id": str(agent_id),
            "source": str(csv_path),
            "count": len(out),
            "results": out,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load explanations: {e}")


@app.post("/v1/scada/score")
def scada_score(payload: ScoreRequest, _: str = Depends(_security_guard)) -> Dict:
    try:
        return _score_core(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/v1/scada/score/batch")
def scada_score_batch(payload: BatchScoreRequest, _: str = Depends(_security_guard)) -> Dict:
    outputs = []
    for rec in payload.records:
        outputs.append(_score_core(rec))
    return {"count": len(outputs), "results": outputs}


@app.post("/v1/scada/ingest/tags")
def scada_ingest_tags(payload: ScadaTagsRequest, _: str = Depends(_security_guard)) -> Dict:
    """Ingest raw SCADA tags, normalize, then run score + XAI."""
    try:
        return _process_scada_tags_payload(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/v1/scada/ingest/tags/batch")
def scada_ingest_tags_batch(payload: BatchScadaTagsRequest, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    """Ingest a full SCADA grid snapshot in one request to avoid per-agent rate limiting."""
    try:
        results = _process_scada_tags_batch_payload(payload)
        return {
            "count": len(results),
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/v1/ids/alert")
def ids_alert(payload: IdsAlertRequest, _: str = Depends(_security_guard)) -> Dict:
    """Accept IDS/IPS alert and return recommended MAS response action."""
    try:
        return recommend_action_from_alert(payload.alert)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



@app.post("/v1/runs/start")
def runs_start(payload: RunStartRequest, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    run_id = f"RUN-{datetime.now(tz=timezone.utc).strftime('%Y%m%d-%H%M%S')}-{str(uuid.uuid4())[:6].upper()}"
    rates = payload.attack_rates or {}
    record: Dict[str, Any] = {
        "run_id": run_id,
        "status": "queued",
        "started_at": _utc_now_iso(),
        "finished_at": None,
        "updated_at": _utc_now_iso(),
        "params": {
            "num_agents": int(payload.num_agents),
            "cycle_hours": int(payload.cycle_hours),
            "episodes": int(payload.episodes),
            "ablation_mode": payload.ablation_mode,
            "optimization_profile": payload.optimization_profile,
            "attack_profile": payload.attack_profile,
            "fdi_rate": float(payload.fdi_rate if payload.fdi_rate is not None else rates.get("fdi_rate", 0.10)),
            "dos_rate": float(payload.dos_rate if payload.dos_rate is not None else rates.get("dos_rate", 0.05)),
            "chain_rate": float(payload.chain_rate if payload.chain_rate is not None else rates.get("chain_rate", 0.20)),
            "lambda_audit": float(payload.lambda_audit) if payload.lambda_audit is not None else None,
            "lambda_attack": float(payload.lambda_attack) if payload.lambda_attack is not None else None,
            "notes": payload.notes,
        },
        "summary": None,
        "error": None,
    }
    with _runs_lock:
        _runs[run_id] = record
        _run_logs[run_id] = []

    thread = threading.Thread(target=_simulate_run_lifecycle, args=(run_id,), daemon=True)
    thread.start()
    return {"status": "ok", "run_id": run_id}


@app.get("/v1/runs")
def runs_list(limit: int = 10, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    lim = max(1, min(200, int(limit)))
    with _runs_lock:
        rows = sorted(_runs.values(), key=lambda item: item.get("started_at") or "", reverse=True)
        return {"runs": rows[:lim]}


@app.get("/v1/runs/latest")
def runs_latest(_: str = Depends(_security_guard)) -> Dict[str, Any]:
    with _runs_lock:
        if _runs:
            row = sorted(_runs.values(), key=lambda item: item.get("started_at") or "", reverse=True)[0]
            return {"run": row}

    try:
        summary_path = _latest_summary_path()
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        verification = _build_live_verification(summary=summary, summary_path=summary_path)
        return {
            "run": {
                "run_id": verification.get("run_id"),
                "status": verification.get("status", "completed"),
                "updated_at": verification.get("updated_at"),
                "finished_at": verification.get("updated_at"),
                "summary": summary,
            }
        }
    except Exception:
        return {"run": None}


@app.get("/v1/runs/{run_id}")
def runs_get(run_id: str, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    with _runs_lock:
        row = _runs.get(run_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return {"run": row}


@app.get("/v1/runs/{run_id}/logs")
def runs_logs(run_id: str, tail: int = 40, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    n_tail = max(1, min(500, int(tail)))
    with _runs_lock:
        lines = list(_run_logs.get(run_id, []))
    return {"run_id": run_id, "lines": lines[-n_tail:]}


@app.post("/v1/screenshot/save")
def screenshot_save(payload: Dict[str, Any], _: str = Depends(_security_guard)) -> Dict[str, Any]:
    """Save a base64-encoded PNG screenshot to knowledge/figures/."""
    filename = str(payload.get("filename", "screenshot.png"))
    data_url = str(payload.get("data", ""))
    if not filename or not data_url:
        raise HTTPException(status_code=400, detail="filename and data required")
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    img_bytes = base64.b64decode(data_url)
    import re
    if not re.match(r"^[a-zA-Z0-9_\-]+\.(png|jpg|jpeg)$", filename):
        raise HTTPException(status_code=400, detail="Invalid filename")
    figures_dir = Path("knowledge") / "figures"
    figures_dir.mkdir(parents=True, exist_ok=True)
    out_path = figures_dir / filename
    out_path.write_bytes(img_bytes)
    return {"saved": str(out_path), "bytes": len(img_bytes)}


# ---- Method Comparison endpoint ----

@app.get("/v1/comparison/results")
def comparison_results(_: str = Depends(_security_guard)) -> Dict[str, Any]:
    """Return cached method comparison results (or empty if not yet run)."""
    results_path = Path("smartgrid_mas") / "results" / "method_comparison.json"
    if not results_path.exists():
        return {"status": "not_run", "summaries": []}
    with open(results_path) as f:
        data = json.load(f)
    return {"status": "complete", **data}
