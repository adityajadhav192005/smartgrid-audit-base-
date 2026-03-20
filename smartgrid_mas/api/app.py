from __future__ import annotations

import time
import threading
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
from smartgrid_mas.federated.fedavg import aggregate_vectors, aggregate_state_dicts
from smartgrid_mas.federated.orchestrator import FederatedCoordinator
from smartgrid_mas.integration.scada_adapter import scada_tags_to_score_request
from smartgrid_mas.integration.ids_adapter import recommend_action_from_alert
from smartgrid_mas.integration.blockchain_logger import BlockchainLogger


app = FastAPI(
    title="SmartGrid MAS API",
    version="0.1.0",
    description="Basic REST API for SCADA integration, XAI, and federated aggregation.",
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


class FederatedVectorRequest(BaseModel):
    client_vectors: List[List[float]]
    sample_counts: List[int]


class FederatedStateRequest(BaseModel):
    client_state_dicts: List[Dict[str, Any]]
    sample_counts: List[int]


class ScadaTagsRequest(BaseModel):
    agent_id: str
    tags: Dict[str, float]
    criticality_weight: float = Field(default=1.0, ge=0.0)
    score_threshold: float = Field(default=1.0, gt=0.0)


class IdsAlertRequest(BaseModel):
    alert: Dict[str, Any]


class FederatedRegisterRequest(BaseModel):
    client_id: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FederatedStartRoundRequest(BaseModel):
    round_id: str
    model_name: str = "anomaly_detector"
    expected_clients: List[str] = Field(default_factory=list)
    base_model: Optional[Dict[str, Any]] = None


class FederatedSubmitUpdateRequest(BaseModel):
    round_id: str
    client_id: str
    sample_count: int = Field(gt=0)
    model_state: Dict[str, Any]


class FederatedFinalizeRoundRequest(BaseModel):
    round_id: str


class BlockchainAnchorRequest(BaseModel):
    event_type: str = "manual_event"
    agent_id: str
    severity: str = "HIGH"
    payload: Dict[str, Any] = Field(default_factory=dict)
    force: bool = False


class BlockchainVerifyPayloadRequest(BaseModel):
    payload: Dict[str, Any]
    prev_hash: str
    chain_hash: str


coordinator = FederatedCoordinator()
blockchain_logger = BlockchainLogger()


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


class RapidScadaLiveClient:
    def __init__(self) -> None:
        self.enabled = _env_bool("SMARTGRID_SCADA_LIVE_ENABLED", False)
        self.source_url = os.environ.get("SMARTGRID_SCADA_SOURCE_URL", "").strip()
        self.agent_id = os.environ.get("SMARTGRID_SCADA_AGENT_ID", "rapidscada-agent").strip() or "rapidscada-agent"
        self.poll_sec = max(1.0, float(os.environ.get("SMARTGRID_SCADA_POLL_SEC", "5")))
        self.timeout_sec = max(1.0, float(os.environ.get("SMARTGRID_SCADA_HTTP_TIMEOUT_SEC", "4")))
        self.criticality_weight = float(os.environ.get("SMARTGRID_SCADA_CRITICALITY_WEIGHT", "1.0"))
        self.score_threshold = float(os.environ.get("SMARTGRID_SCADA_SCORE_THRESHOLD", "1.0"))

        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()

        self.last_attempt_ts: float | None = None
        self.last_success_ts: float | None = None
        self.consecutive_failures: int = 0
        self.last_error: str | None = None
        self.last_tags: Dict[str, float] = {}
        self.last_score: Dict[str, Any] | None = None

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
            tags = self._fetch_tags()
            req_dict = scada_tags_to_score_request(
                agent_id=self.agent_id,
                tags=tags,
                criticality_weight=self.criticality_weight,
                score_threshold=self.score_threshold,
            )
            req = ScoreRequest(**req_dict)
            score = _score_core(req, anchor_event=False)
            with self._lock:
                self.last_tags = tags
                self.last_score = score
                self.last_success_ts = time.time()
                self.consecutive_failures = 0
                self.last_error = None
        except (urlerror.URLError, TimeoutError, ValueError, json.JSONDecodeError) as e:
            with self._lock:
                self.consecutive_failures += 1
                self.last_error = str(e)

    def _run_loop(self) -> None:
        while not self._stop.is_set():
            self.poll_once()
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
            max_age = self.poll_sec * 3.0
            connected = self.last_success_ts is not None and (now - self.last_success_ts) <= max_age
            age_sec = (now - self.last_success_ts) if self.last_success_ts is not None else None
            return {
                "enabled": self.enabled,
                "configured": bool(self.source_url),
                "source_url": self.source_url,
                "agent_id": self.agent_id,
                "poll_sec": self.poll_sec,
                "timeout_sec": self.timeout_sec,
                "connected": connected,
                "last_attempt_utc": self._as_iso(self.last_attempt_ts),
                "last_success_utc": self._as_iso(self.last_success_ts),
                "data_age_sec": age_sec,
                "consecutive_failures": self.consecutive_failures,
                "last_error": self.last_error,
            }

    def snapshot(self) -> Dict[str, Any]:
        connection = self.status()
        with self._lock:
            tags = dict(self.last_tags)
            score = dict(self.last_score) if isinstance(self.last_score, dict) else None
        return {
            "connection": connection,
            "live_tags": tags,
            "live_score": score,
            "server_time_utc": datetime.now(tz=timezone.utc).isoformat(),
        }


rapid_scada_live = RapidScadaLiveClient()


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


def _score_core(payload: ScoreRequest, anchor_event: bool = True) -> Dict[str, Any]:
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
    if anchor_event:
        anchor_payload = {
            "agent_id": payload.agent_id,
            "deviation_score": float(score),
            "anomaly_flag": int(flag),
            "risk_score": float(score),
            "decision": action,
            "score_threshold": float(payload.score_threshold),
            "criticality_weight": float(payload.criticality_weight),
            "xai_decision": decision_xai,
        }
        ledger_meta = blockchain_logger.anchor_event(
            event_type="audit_decision",
            agent_id=payload.agent_id,
            severity=severity,
            payload=anchor_payload,
        )
        result["ledger"] = ledger_meta
    return result


@app.on_event("startup")
def startup_event() -> None:
    rapid_scada_live.start()


@app.on_event("shutdown")
def shutdown_event() -> None:
    rapid_scada_live.stop()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/db/health")
def db_health(_: str = Depends(_security_guard)) -> Dict[str, Any]:
    return blockchain_logger.status()


@app.get("/v1/blockchain/status")
def blockchain_status(_: str = Depends(_security_guard)) -> Dict[str, Any]:
    return blockchain_logger.status()


@app.get("/v1/blockchain/events")
def blockchain_events(limit: int = 50, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    return blockchain_logger.recent_events(limit=limit)


@app.get("/v1/blockchain/events/{event_id}/verify")
def blockchain_verify_event(event_id: int, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    out = blockchain_logger.verify_event(event_id)
    if not out.get("exists", False):
        raise HTTPException(status_code=404, detail=f"Event id {event_id} not found")
    return out


@app.post("/v1/blockchain/verify-payload")
def blockchain_verify_payload(payload: BlockchainVerifyPayloadRequest, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    return blockchain_logger.verify_payload(
        payload=payload.payload,
        prev_hash=payload.prev_hash,
        chain_hash=payload.chain_hash,
    )


@app.post("/v1/blockchain/anchor")
def blockchain_anchor(payload: BlockchainAnchorRequest, _: str = Depends(_security_guard)) -> Dict[str, Any]:
    return blockchain_logger.anchor_event(
        event_type=payload.event_type,
        agent_id=payload.agent_id,
        severity=payload.severity,
        payload=payload.payload,
        force=payload.force,
    )


@app.get("/grid/status")
def grid_status() -> Dict[str, Any]:
    """Dashboard-friendly endpoint with core run status metrics."""
    server_time_utc = datetime.now(tz=timezone.utc).isoformat()
    live_snapshot = rapid_scada_live.snapshot()

    try:
        summary_path = _latest_summary_path()
        summary = pd.read_json(summary_path, typ="series")
        return {
            "source": str(summary_path),
            "server_time_utc": server_time_utc,
            "n_agents": int(summary.get("n_agents", 0)),
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
            "rapid_scada": live_snapshot,
        }
    except Exception as e:
        # Keep endpoint live even when summary is missing; return live SCADA state + error context.
        return {
            "source": None,
            "server_time_utc": server_time_utc,
            "summary_error": str(e),
            "rapid_scada": live_snapshot,
        }


@app.get("/v1/scada/live")
def scada_live(_: str = Depends(_security_guard)) -> Dict[str, Any]:
    return rapid_scada_live.snapshot()


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
        req_dict = scada_tags_to_score_request(
            agent_id=payload.agent_id,
            tags=payload.tags,
            criticality_weight=payload.criticality_weight,
            score_threshold=payload.score_threshold,
        )
        req = ScoreRequest(**req_dict)
        return {
            "normalized_request": req_dict,
            "result": _score_core(req),
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


@app.post("/v1/federated/aggregate/vector")
def fedavg_vector(payload: FederatedVectorRequest, _: str = Depends(_security_guard)) -> Dict:
    try:
        agg = aggregate_vectors(payload.client_vectors, payload.sample_counts)
        return {"aggregated_vector": agg, "num_clients": len(payload.client_vectors)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/v1/federated/aggregate/state")
def fedavg_state(payload: FederatedStateRequest, _: str = Depends(_security_guard)) -> Dict:
    try:
        agg = aggregate_state_dicts(payload.client_state_dicts, payload.sample_counts)
        return {"aggregated_state": agg, "num_clients": len(payload.client_state_dicts)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/v1/federated/clients/register")
def federated_register_client(
    payload: FederatedRegisterRequest,
    _: str = Depends(_security_guard),
) -> Dict:
    try:
        return coordinator.register_client(payload.client_id, payload.metadata)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/v1/federated/rounds/start")
def federated_start_round(
    payload: FederatedStartRoundRequest,
    _: str = Depends(_security_guard),
) -> Dict:
    try:
        return coordinator.start_round(
            round_id=payload.round_id,
            model_name=payload.model_name,
            expected_clients=payload.expected_clients,
            base_model=payload.base_model,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/v1/federated/rounds/submit")
def federated_submit_update(
    payload: FederatedSubmitUpdateRequest,
    _: str = Depends(_security_guard),
) -> Dict:
    try:
        return coordinator.submit_update(
            round_id=payload.round_id,
            client_id=payload.client_id,
            sample_count=payload.sample_count,
            model_state=payload.model_state,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/v1/federated/rounds/finalize")
def federated_finalize_round(
    payload: FederatedFinalizeRoundRequest,
    _: str = Depends(_security_guard),
) -> Dict:
    try:
        return coordinator.finalize_round(payload.round_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/v1/federated/status")
def federated_status(_: str = Depends(_security_guard)) -> Dict:
    return coordinator.get_status()
