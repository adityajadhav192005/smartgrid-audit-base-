from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any, Dict, List

import numpy as np

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentCriticality, AgentType
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.anomaly_detection.dual_branch import (
    build_grid_branch_window,
    build_network_branch_window,
    fuse_branch_probabilities,
)
from smartgrid_mas.audit.audit_scheduler_rl import QLearningAuditScheduler
from smartgrid_mas.audit.gradient_step import GradientTracker
from smartgrid_mas.audit.hybrid_scheduler import hybrid_audit_schedule
from smartgrid_mas.behavior_analysis.behavior_pipeline import behavior_update
from smartgrid_mas.behavior_analysis.scoring_pipeline import compute_score_and_flag
from smartgrid_mas.behavior_analysis.trend_clustering import assign_cluster_labels, cluster_agents_trends
from smartgrid_mas.response.response_controller import response_step
from smartgrid_mas.xai.explain import explain_audit_decision, explain_deviation


PHYS_FEATURE_NAMES = ["voltage", "frequency", "current", "power", "response_time"]
CYBER_FEATURE_NAMES = ["latency", "packet_loss", "integrity", "comm_freq"]
DEFAULT_LIVE_LSTM_PATH = Path("smartgrid_mas") / "data" / "anomaly_inputs" / "lstm_live_scada.pt"
DEFAULT_NETWORK_LSTM_PATH = Path("smartgrid_mas") / "data" / "anomaly_inputs" / "lstm_network.pt"


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except Exception:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except Exception:
        return default


def _agent_type_from_id(agent_id: str) -> AgentType:
    normalized = str(agent_id).strip().upper()
    if normalized.startswith("GEN-"):
        return AgentType.GENERATOR
    if normalized.startswith("SUB-"):
        return AgentType.SUBSTATION
    if normalized.startswith("PMU-"):
        return AgentType.PMU
    if normalized.startswith("BRK-"):
        return AgentType.BREAKER
    return AgentType.SECURITY


def _feature_names(request: Dict[str, Any], fallback: List[str]) -> List[str]:
    values = request.get("feature_names_phys" if fallback is PHYS_FEATURE_NAMES else "feature_names_cyber")
    if isinstance(values, list) and values:
        return [str(v) for v in values]
    target_len = len(request.get("x_phys" if fallback is PHYS_FEATURE_NAMES else "y_cyber", []))
    return fallback[:target_len] if target_len > 0 else list(fallback)


class LiveExperimentPipeline:
    def __init__(self) -> None:
        self.enabled = _env_bool("SMARTGRID_SCADA_USE_EXPERIMENT_PIPELINE", True)
        self.history_window = max(1, _env_int("SMARTGRID_LIVE_HISTORY_WINDOW", 24))
        self.cluster_window = max(3, _env_int("SMARTGRID_LIVE_CLUSTER_WINDOW", 12))
        self.cluster_k = max(2, _env_int("SMARTGRID_LIVE_CLUSTER_K", 3))
        self.cluster_period = max(1, _env_int("SMARTGRID_LIVE_CLUSTER_PERIOD", 1))
        self.risk_threshold = _env_float("SMARTGRID_LIVE_RISK_THRESHOLD", 0.5)
        self.f_min = max(0, _env_int("SMARTGRID_LIVE_F_MIN", 0))
        self.f_max = max(self.f_min, _env_int("SMARTGRID_LIVE_F_MAX", 5))
        self.max_audits_per_cycle = max(1, _env_int("SMARTGRID_LIVE_MAX_AUDITS_PER_CYCLE", 10))
        self.audit_cost_per_audit = _env_float("SMARTGRID_LIVE_AUDIT_COST", 1.0)
        self.operational_cost = _env_float("SMARTGRID_LIVE_OPERATIONAL_COST", 100.0)
        self.budget_ratio = _env_float("SMARTGRID_LIVE_AUDIT_BUDGET_RATIO", 0.10)
        self.min_coverage_pct = _env_float("SMARTGRID_LIVE_MIN_COVERAGE_PCT", 0.0)
        self.C_a = _env_float("SMARTGRID_LIVE_GRADIENT_CA", 1.0)
        self.C_f = _env_float("SMARTGRID_LIVE_GRADIENT_CF", 10.0)
        self.grad_lr = _env_float("SMARTGRID_LIVE_GRADIENT_LR", 0.01)
        self.response_window = max(1, _env_int("SMARTGRID_LIVE_RESPONSE_WINDOW", 20))
        self.ablation_mode = str(os.environ.get("SMARTGRID_LIVE_ABLATION_MODE", "HYBRID")).strip().upper() or "HYBRID"

        self._lock = threading.Lock()
        self._agents: Dict[str, BaseAgent] = {}
        self._step_count = 0
        self._last_scheduler_actions: Dict[str, int] = {}
        self._last_scheduler_rewards: Dict[str, float] = {}
        self._scheduler = QLearningAuditScheduler(gamma=0.9, alpha=0.1)
        self._gradient_tracker = GradientTracker()
        configured_model_path = os.environ.get("SMARTGRID_LIVE_LSTM_MODEL_PATH", "").strip()
        self._lstm_model_path = configured_model_path or str(DEFAULT_LIVE_LSTM_PATH)
        configured_network_model_path = os.environ.get("SMARTGRID_LIVE_NETWORK_LSTM_MODEL_PATH", "").strip()
        self._network_lstm_model_path = configured_network_model_path or str(DEFAULT_NETWORK_LSTM_PATH)
        self._lstm_error: str | None = None
        self._network_lstm_error: str | None = None
        self._lstm = self._load_lstm()
        self._network_lstm = self._load_network_lstm()

    def _load_lstm(self) -> LSTMInferencer | None:
        if not self._lstm_model_path:
            return None

        model_path = Path(self._lstm_model_path)
        if not model_path.exists():
            self._lstm_error = f"LSTM checkpoint not found: {model_path}"
            return None

        try:
            self._lstm_error = None
            return LSTMInferencer(model_path=str(model_path))
        except Exception as exc:
            self._lstm_error = str(exc)
            return None

    def _load_network_lstm(self) -> LSTMInferencer | None:
        model_path = Path(self._network_lstm_model_path)
        if not model_path.exists():
            self._network_lstm_error = f"Network LSTM checkpoint not found: {model_path}"
            return None
        try:
            self._network_lstm_error = None
            return LSTMInferencer(model_path=str(model_path))
        except Exception as exc:
            self._network_lstm_error = str(exc)
            return None

    def _ensure_lstm_loaded(self) -> None:
        if self._lstm is not None:
            if self._network_lstm is not None:
                return
        self._lstm = self._load_lstm()
        if self._network_lstm is None:
            self._network_lstm = self._load_network_lstm()

    def status(self) -> Dict[str, Any]:
        with self._lock:
            self._ensure_lstm_loaded()
            return {
                "enabled": self.enabled,
                "step_count": self._step_count,
                "agent_count": len(self._agents),
                "history_window": self.history_window,
                "cluster_window": self.cluster_window,
                "cluster_k": self.cluster_k,
                "risk_threshold": self.risk_threshold,
                "f_min": self.f_min,
                "f_max": self.f_max,
                "min_coverage_pct": self.min_coverage_pct,
                "scheduler_converged": bool(self._scheduler.converged),
                "gradient_converged": bool(self._gradient_tracker.converged),
                "lstm_enabled": self._lstm is not None,
                "network_branch_enabled": self._network_lstm is not None,
                "lstm_model_path": self._lstm_model_path or None,
                "network_lstm_model_path": self._network_lstm_model_path or None,
                "lstm_error": self._lstm_error,
                "network_lstm_error": self._network_lstm_error,
            }

    def _get_or_create_agent(self, request: Dict[str, Any]) -> BaseAgent:
        agent_id = str(request["agent_id"])
        agent = self._agents.get(agent_id)
        if agent is None:
            agent = BaseAgent(
                agent_id=agent_id,
                agent_type=_agent_type_from_id(agent_id),
                criticality=AgentCriticality(weight=float(request["criticality_weight"])),
                bx=np.asarray(request["bx"], dtype=float),
                by=np.asarray(request["by"], dtype=float),
                thx=np.asarray(request["thx"], dtype=float),
                thy=np.asarray(request["thy"], dtype=float),
            )
            self._agents[agent_id] = agent
            return agent

        agent.criticality = AgentCriticality(weight=float(request["criticality_weight"]))
        if agent.bx.shape != np.asarray(request["bx"], dtype=float).shape:
            agent.bx = np.asarray(request["bx"], dtype=float)
        if agent.by.shape != np.asarray(request["by"], dtype=float).shape:
            agent.by = np.asarray(request["by"], dtype=float)
        if agent.thx.shape != np.asarray(request["thx"], dtype=float).shape:
            agent.thx = np.asarray(request["thx"], dtype=float)
        if agent.thy.shape != np.asarray(request["thy"], dtype=float).shape:
            agent.thy = np.asarray(request["thy"], dtype=float)
        return agent

    def _apply_lstm_probabilities(self, agents: List[BaseAgent]) -> None:
        self._ensure_lstm_loaded()
        if self._lstm is None:
            for agent in agents:
                if agent.last_state is not None:
                    agent.last_state.anomaly_prob = 0.0
                    agent.last_state.grid_anomaly_prob = 0.0
                    agent.last_state.network_intrusion_prob = 0.0
            return

        ready_agents: List[BaseAgent] = []
        grid_windows: List[np.ndarray] = []
        network_windows: List[np.ndarray] = []
        for agent in agents:
            if agent.last_state is None:
                continue
            try:
                history = agent.get_history_window(window=getattr(self._lstm, "window", None) or self.history_window)
            except Exception:
                agent.last_state.anomaly_prob = 0.0
                continue
            grid_windows.append(build_grid_branch_window(history))
            if self._network_lstm is not None:
                network_windows.append(build_network_branch_window(history))
            ready_agents.append(agent)

        if not grid_windows:
            return

        try:
            grid_probs = self._lstm.predict_proba_batch(grid_windows)
            network_probs = (
                self._network_lstm.predict_proba_batch(network_windows)
                if self._network_lstm is not None and network_windows
                else [0.0] * len(grid_probs)
            )
        except Exception as exc:
            self._lstm_error = str(exc)
            for agent in ready_agents:
                if agent.last_state is not None:
                    agent.last_state.anomaly_prob = 0.0
                    agent.last_state.grid_anomaly_prob = 0.0
                    agent.last_state.network_intrusion_prob = 0.0
            return

        for agent, grid_prob, network_prob in zip(ready_agents, grid_probs, network_probs):
            if agent.last_state is not None:
                fused = fuse_branch_probabilities(grid_prob, network_prob)
                agent.last_state.grid_anomaly_prob = float(fused.grid_prob)
                agent.last_state.network_intrusion_prob = float(fused.network_prob)
                agent.last_state.fusion_agreement = float(fused.agreement)
                agent.last_state.anomaly_prob = float(fused.fused_prob)

    def process_batch(self, requests: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        if not requests:
            return {}

        with self._lock:
            self._step_count += 1
            touched_ids: List[str] = []

            for request in requests:
                agent = self._get_or_create_agent(request)
                x_phys = np.asarray(request["x_phys"], dtype=float)
                y_cyber = np.asarray(request["y_cyber"], dtype=float)
                agent.observe(x_phys, y_cyber)
                touched_ids.append(agent.agent_id)

            active_agents = [agent for agent in self._agents.values() if agent.last_state is not None]
            self._apply_lstm_probabilities(active_agents)

            for agent in active_agents:
                compute_score_and_flag(agent, agent.last_state)

            for agent in active_agents:
                behavior_update(agent, agent.last_state)

            if (
                len(active_agents) >= self.cluster_k
                and self._step_count >= self.cluster_window
                and self._step_count % self.cluster_period == 0
            ):
                try:
                    labels = cluster_agents_trends(
                        active_agents,
                        window=min(self.cluster_window, self._step_count),
                        k=min(self.cluster_k, len(active_agents)),
                        seed=42,
                    )
                    assign_cluster_labels(active_agents, labels)
                except Exception:
                    pass

            prev_min_coverage = os.environ.get("SMARTGRID_MIN_COVERAGE_PCT")
            os.environ["SMARTGRID_MIN_COVERAGE_PCT"] = str(self.min_coverage_pct)
            try:
                actions, rewards, _, _, _ = hybrid_audit_schedule(
                    agents=active_agents,
                    scheduler=self._scheduler,
                    risk_threshold=self.risk_threshold,
                    f_min=self.f_min,
                    f_max=self.f_max,
                    max_audits_per_cycle=self.max_audits_per_cycle,
                    audit_cost_per_audit=self.audit_cost_per_audit,
                    operational_cost=self.operational_cost,
                    budget_ratio=self.budget_ratio,
                    C_a=self.C_a,
                    C_f=self.C_f,
                    grad_lr=self.grad_lr,
                    gradient_tracker=self._gradient_tracker,
                    ablation_mode=self.ablation_mode,
                )
                self._last_scheduler_actions = dict(actions)
                self._last_scheduler_rewards = dict(rewards)
            except Exception:
                self._last_scheduler_actions = {}
                self._last_scheduler_rewards = {}
            finally:
                if prev_min_coverage is None:
                    os.environ.pop("SMARTGRID_MIN_COVERAGE_PCT", None)
                else:
                    os.environ["SMARTGRID_MIN_COVERAGE_PCT"] = prev_min_coverage

            response_events: Dict[str, Dict[str, Any]] = {}
            for agent in active_agents:
                history = list(agent.anomaly_flag_history)
                response_events[agent.agent_id] = response_step(
                    agent,
                    history,
                    T=self.response_window,
                    f_min=self.f_min,
                    f_max=self.f_max,
                )

            results: Dict[str, Dict[str, Any]] = {}
            for request in requests:
                agent_id = str(request["agent_id"])
                agent = self._agents[agent_id]
                state = agent.last_state
                if state is None:
                    continue

                phys_names = _feature_names(request, PHYS_FEATURE_NAMES)
                cyber_names = _feature_names(request, CYBER_FEATURE_NAMES)
                response_event = response_events.get(agent_id, {"action": "UNKNOWN", "severity_level": "LOW"})
                decision = str(response_event.get("action", "UNKNOWN"))

                xai_phys = explain_deviation(
                    obs=state.x_phys,
                    base=agent.bx,
                    th=agent.thx,
                    feature_names=phys_names,
                )
                xai_cyber = explain_deviation(
                    obs=state.y_cyber,
                    base=agent.by,
                    th=agent.thy,
                    feature_names=cyber_names,
                )
                decision_xai = explain_audit_decision(
                    risk_score=float(state.risk_score),
                    risk_threshold=float(self.risk_threshold),
                    action=decision,
                    cluster_label=int(getattr(state, "cluster_label", -1)),
                )

                results[agent_id] = {
                    "agent_id": agent_id,
                    "deviation_score": float(state.deviation_score),
                    "anomaly_flag": int(state.anomaly_flag),
                    "anomaly_prob": float(state.anomaly_prob),
                    "grid_anomaly_prob": float(getattr(state, "grid_anomaly_prob", 0.0)),
                    "network_intrusion_prob": float(getattr(state, "network_intrusion_prob", 0.0)),
                    "fusion_agreement": float(getattr(state, "fusion_agreement", 0.0)),
                    "network_attack_label": str(getattr(state, "network_attack_label", "NONE")),
                    "network_attack_confidence": float(getattr(state, "network_attack_confidence", 0.0)),
                    "network_dos_score": float(getattr(state, "network_dos_score", 0.0)),
                    "network_mitm_score": float(getattr(state, "network_mitm_score", 0.0)),
                    "hybrid_confidence": float(getattr(state, "hybrid_confidence", 0.0)),
                    "risk_score": float(state.risk_score),
                    "decision": decision,
                    "severity": str(response_event.get("severity_level", "LOW")).upper(),
                    "audit_frequency": int(agent.audit_frequency),
                    "cluster_label": int(getattr(state, "cluster_label", -1)),
                    "attack_type": str(getattr(state, "attack_type", "NONE")),
                    "attack_type_confidence": float(getattr(state, "attack_type_confidence", 0.0)),
                    "pipeline": "experiment_live",
                    "response": response_event,
                    "xai": {
                        "physical": xai_phys,
                        "cyber": xai_cyber,
                        "decision": decision_xai,
                    },
                    "experiment_details": {
                        "scheduler_action": self._last_scheduler_actions.get(agent_id),
                        "scheduler_reward": self._last_scheduler_rewards.get(agent_id),
                        "lstm_enabled": self._lstm is not None,
                        "network_branch_enabled": self._network_lstm is not None,
                        "step": self._step_count,
                    },
                }

            return results
