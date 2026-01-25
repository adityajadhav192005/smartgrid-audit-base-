"""
Unified end-to-end experiment runner for Smart Grid Audit Framework.

This module orchestrates the complete experimental pipeline:
1. Deterministic seeding
2. Environment validation
3. LSTM model training (if needed)
4. Agent pool creation
5. Full 24-hour dynamic simulation (RL + gradient + audits + learning)
6. Fixed baseline simulation (f=1)
7. Metrics evaluation
8. Results export
9. Summary reporting

Entry point: python -m smartgrid_mas.run_all
"""
from __future__ import annotations
import os
import sys
import json
import random
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple
from datetime import datetime

import numpy as np
import torch
import pandas as pd

from smartgrid_mas.config.loader import load_config
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentCriticality, AgentType
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.anomaly_detection.train_lstm import train_lstm
from smartgrid_mas.environment.grid_env import GridEnvConfig
from smartgrid_mas.simulation.debug_logger import setup_debug_logging, get_logger
from smartgrid_mas.simulation.run_simulation import run_simulation_24h
from smartgrid_mas.simulation.run_baseline_fixed import run_fixed_audit_24h
from smartgrid_mas.simulation.eval_suite import build_summary
from smartgrid_mas.simulation.export import export_records_csv
from smartgrid_mas.data.cyber_attacks import AttackConfig
from smartgrid_mas.data.synthetic_faults import FaultConfig


# ============================================================================
# CONFIGURATION CONSTANTS
# ============================================================================

SEED = 42
CONFIG_PATH = os.environ.get('SMARTGRID_CONFIG', "smartgrid_mas/config/global_config.yaml")
LSTM_MODEL_PATH = "smartgrid_mas/data/anomaly_inputs/lstm.pt"
LOGS_DIR = Path("logs")
DATA_DIR = Path("smartgrid_mas/data")

# Paper parameters (non-negotiable)
GAMMA = 0.9
RISK_THRESHOLD = 0.25  # Lowered from 0.5 to improve attack detection sensitivity
def _env_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except Exception:
        return default


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except Exception:
        return default


# Paper-aligned defaults: balance cost efficiency + risk mitigation
AUDIT_BUDGET_RATIO = _env_float("SMARTGRID_AUDIT_BUDGET_RATIO", 0.50)  # Increased from 0.20 to give larger grids enough budget for audits
GRADIENT_LR = 0.01
MAX_AUDITS_PER_CYCLE = _env_int("SMARTGRID_MAX_AUDITS_PER_CYCLE", 10)  # Reduced from 50 for cost efficiency
CONSTRAINT_LOG_LEVEL = os.environ.get("SMARTGRID_CONSTRAINT_LOG_LEVEL", "WARNING").upper()
RISK_THRESHOLD = _env_float("SMARTGRID_RISK_THRESHOLD", 0.5)  # Raised back to 0.5 for balanced detection
F_MAX_OVERRIDE = os.environ.get("SMARTGRID_F_MAX", "").strip()
RL_ALPHA = _env_float("SMARTGRID_RL_ALPHA", 0.4)  # Increased from 0.1 for faster convergence
RL_GAMMA = _env_float("SMARTGRID_RL_GAMMA", 0.95)  # Increased from 0.9 for better long-term planning
RL_EPSILON_START = _env_float("SMARTGRID_RL_EPSILON_START", 1.0)
RL_EPSILON_MIN = _env_float("SMARTGRID_RL_EPSILON_MIN", 0.05)
RL_EPSILON_DECAY = _env_float("SMARTGRID_RL_EPSILON_DECAY", 0.995)

# Behavior adaptation overrides
ALPHA_LOW = _env_float("SMARTGRID_ALPHA_LOW", 0.05)  # Reduced for less aggressive baseline updates
ALPHA_HIGH = _env_float("SMARTGRID_ALPHA_HIGH", 0.5)  # Reduced for stability
BETA = _env_float("SMARTGRID_BETA", 0.1)

# Baseline naive audit frequency (paper f=1)
BASELINE_FIXED_F = _env_int("SMARTGRID_BASELINE_F", 1)

# LSTM hyperparameters (single source of truth)
ENV_CFG = GridEnvConfig()
FEATURE_DIM = ENV_CFG.phys_dim + ENV_CFG.cyber_dim
LSTM_HIDDEN_SIZE = 32
LSTM_NUM_LAYERS = 2
LSTM_DROPOUT = 0.2
LSTM_WINDOW = _env_int("SMARTGRID_LSTM_WINDOW", 24)

# Attack scenario parameters
FDI_RATE = 0.10
DOS_RATE = 0.05
CHAIN_RATE = 0.20
FAULT_RATE = 0.20

# Agent distribution (paper-faithful)
GEN_RATIO = 0.20
SUB_RATIO = 0.30
PMU_RATIO = 0.25
BRK_RATIO = 0.25


# ============================================================================
# LOGGER SETUP
# ============================================================================

def setup_logging() -> logging.Logger:
    """Configure logging for the run."""
    setup_debug_logging(logging.INFO)
    logger = get_logger(__name__)
    # Allow suppressing noisy constraint warnings when running large sweeps
    constraint_logger = logging.getLogger("smartgrid_mas.audit.constraints")
    constraint_logger.setLevel(getattr(logging, CONSTRAINT_LOG_LEVEL, logging.WARNING))
    return logger


# ============================================================================
# STEP 1: SET DETERMINISTIC SEEDS
# ============================================================================

def set_seeds(seed: int = SEED) -> None:
    """Set deterministic seeds for reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)


# ============================================================================
# STEP 2: VALIDATE ENVIRONMENT
# ============================================================================

def validate_and_setup_environment(logger: logging.Logger) -> None:
    """Check required folders and create logs/data if missing."""
    logger.info("Validating environment...")
    
    # Check config exists
    if not Path(CONFIG_PATH).exists():
        raise FileNotFoundError(f"Config not found: {CONFIG_PATH}")
    logger.info(f"✓ Config found: {CONFIG_PATH}")
    
    # Create logs directory
    LOGS_DIR.mkdir(exist_ok=True)
    logger.info(f"✓ Logs directory: {LOGS_DIR}")
    
    # Create data directory
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"✓ Data directory: {DATA_DIR}")
    
    # Ensure anomaly_inputs subfolder exists
    anomaly_dir = DATA_DIR / "anomaly_inputs"
    anomaly_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"✓ Anomaly inputs directory: {anomaly_dir}")


# ============================================================================
# STEP 3: LSTM TRAINING (IF NEEDED)
# ============================================================================

def generate_synthetic_training_data(
    n_samples: int = 2000,
    n_features: int | None = None,
    anomaly_ratio: float = 0.2,
    seed: int = SEED,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic training data for LSTM.
    
    Simulates normal and anomalous grid behavior:
    - Normal: slow sine waves with small noise
    - Anomalous: larger deviations or sudden spikes
    
    Features are derived from GridEnvConfig (phys_dim + cyber_dim).
    - Physical dims follow slow sine/cosine trends
    - Cyber dims follow slower modulations
    """
    if n_features is None:
        n_features = FEATURE_DIM

    rng = np.random.default_rng(seed)
    
    data = []
    labels = []
    
    # Number of anomalies
    n_anomalies = int(n_samples * anomaly_ratio)
    
    for i in range(n_samples):
        # Time parameter (normalize to [0, 2π])
        t = (i / n_samples) * 2 * np.pi
        
        # Base signal: slow sine waves (paper-like baseline)
        base_phys = np.array([
            0.5 * np.sin(t),          # voltage-like
            0.5 * np.cos(t),          # frequency-like
            0.3 * np.sin(2*t),        # current-like
            0.4 * np.cos(2*t),        # power-like
            0.2 * np.sin(t),          # response-time-like
        ], dtype=np.float32)

        base_cyber = np.array([
            0.1 * np.cos(t),          # latency (ms)
            0.05 * np.sin(3*t),       # packet loss
            0.95 + 0.02 * np.sin(t),  # integrity (near 1.0)
            0.5 * np.cos(2*t),        # comm frequency (Hz)
        ], dtype=np.float32)

        # Slice to configured feature dimensions
        phys_dim = ENV_CFG.phys_dim
        cyber_dim = ENV_CFG.cyber_dim
        phys_slice = base_phys[:phys_dim]
        cyber_slice = base_cyber[:cyber_dim]
        base_signal = np.concatenate([phys_slice, cyber_slice], dtype=np.float32)
        n_features = phys_dim + cyber_dim
        
        # Add noise
        noise = rng.normal(0, 0.02, size=n_features).astype(np.float32)
        signal = base_signal + noise
        
        # Determine if anomalous
        is_anomaly = i < n_anomalies
        
        if is_anomaly:
            # Anomalous: inject larger deviations (FDI-like)
            anomaly_factor = rng.uniform(1.5, 3.0)
            signal = signal * anomaly_factor + rng.normal(0, 0.1, size=n_features).astype(np.float32)
        
        data.append(signal)
        labels.append(float(is_anomaly))
    
    return np.array(data, dtype=np.float32), np.array(labels, dtype=np.float32)


def _train_lstm_with_current_config(logger: logging.Logger) -> None:
    """Train LSTM with the configured feature dimension and hyperparameters."""
    logger.info(f"  Generating synthetic training data (features={FEATURE_DIM})...")
    data, labels = generate_synthetic_training_data(
        n_samples=2000,
        anomaly_ratio=0.2,
        seed=SEED,
    )

    result = train_lstm(
        data=data,
        labels=labels,
        window=LSTM_WINDOW,
        model_path=str(LSTM_MODEL_PATH),
        hidden_size=LSTM_HIDDEN_SIZE,
        num_layers=LSTM_NUM_LAYERS,
        dropout=LSTM_DROPOUT,
        batch_size=32,
        epochs=50,
        lr=1e-3,
        seed=SEED,
        verbose=False,
    )
    logger.info(f"✓ LSTM model trained and saved: {LSTM_MODEL_PATH}")
    logger.info(f"  Train loss: {result.train_loss:.4f}, Val loss: {result.val_loss:.4f}")


def train_lstm_if_needed(logger: logging.Logger) -> None:
    """Ensure LSTM checkpoint exists and matches current configuration."""
    model_path = Path(LSTM_MODEL_PATH)
    retrain_reason = None

    if not model_path.exists():
        retrain_reason = "no existing checkpoint"
    else:
        try:
            ckpt = torch.load(model_path, map_location="cpu")
            if not (isinstance(ckpt, dict) and "state_dict" in ckpt):
                retrain_reason = "legacy checkpoint without metadata"
            else:
                if int(ckpt.get("input_size", -1)) != FEATURE_DIM:
                    retrain_reason = "input_size mismatch"
                elif int(ckpt.get("hidden_size", -1)) != LSTM_HIDDEN_SIZE:
                    retrain_reason = "hidden_size mismatch"
                elif int(ckpt.get("num_layers", -1)) != LSTM_NUM_LAYERS:
                    retrain_reason = "num_layers mismatch"
                elif float(ckpt.get("dropout", -1.0)) != float(LSTM_DROPOUT):
                    retrain_reason = "dropout mismatch"
                elif int(ckpt.get("window", -1)) != LSTM_WINDOW:
                    retrain_reason = "window mismatch"
        except Exception as e:
            retrain_reason = f"failed to load checkpoint ({e})"

    if retrain_reason:
        logger.info(f"Training LSTM model ({retrain_reason})...")
        _train_lstm_with_current_config(logger)
    else:
        logger.info(f"✓ LSTM model already exists and matches configuration: {LSTM_MODEL_PATH}")


# ============================================================================
# STEP 4: LOAD LSTM MODEL
# ============================================================================

def load_lstm_model(logger: logging.Logger) -> LSTMInferencer:
    """Load the trained LSTM model for inference."""
    logger.info("Loading LSTM model for inference...")
    try:
        inferencer = LSTMInferencer(model_path=LSTM_MODEL_PATH)
    except Exception as e:
        logger.warning(f"LSTM load failed after verification ({e}); retraining once more...")
        _train_lstm_with_current_config(logger)
        inferencer = LSTMInferencer(model_path=LSTM_MODEL_PATH)

    logger.info(
        "✓ LSTM model loaded: %s (input_size=%s, hidden_size=%s, layers=%s, window=%s)",
        LSTM_MODEL_PATH,
        getattr(inferencer, "input_size", "?"),
        getattr(inferencer, "model", None).hidden_size if hasattr(inferencer, "model") else "?",
        getattr(inferencer, "model", None).num_layers if hasattr(inferencer, "model") else "?",
        getattr(inferencer, "window", "?"),
    )
    return inferencer


# ============================================================================
# STEP 5: BUILD AGENTS
# ============================================================================

def build_agent_pool(n_agents: int = 100, seed: int = SEED) -> List[BaseAgent]:
    """Build paper-faithful agent mix: 20% gen, 30% sub, 25% PMU, 25% brk."""
    rng = np.random.default_rng(seed)
    
    # Criticality weights (paper-defined)
    gen_weight = 1.5
    sub_weight = 1.2
    pmu_weight = 0.8
    brk_weight = 1.0
    
    # Calculate counts
    n_gen = max(1, int(n_agents * GEN_RATIO))
    n_sub = max(1, int(n_agents * SUB_RATIO))
    n_pmu = max(1, int(n_agents * PMU_RATIO))
    n_brk = n_agents - n_gen - n_sub - n_pmu  # Remainder for brkrs
    
    agents = []
    agent_id = 0
    
    def make_agent(agent_type: AgentType, criticality: float) -> BaseAgent:
        nonlocal agent_id
        aid = f"{agent_id}"
        agent_id += 1
        return BaseAgent(
            agent_id=aid,
            agent_type=agent_type,
            criticality=AgentCriticality(weight=criticality),
            bx=np.ones(ENV_CFG.phys_dim),
            by=np.ones(ENV_CFG.cyber_dim),
            thx=np.ones(ENV_CFG.phys_dim) * 0.1,
            thy=np.ones(ENV_CFG.cyber_dim) * 0.1,
        )
    
    # Generators
    for _ in range(n_gen):
        w = float(gen_weight + 0.4 * rng.random())
        agents.append(make_agent(AgentType.GENERATOR, w))
    
    # Substations
    for _ in range(n_sub):
        w = float(sub_weight + 0.4 * rng.random())
        agents.append(make_agent(AgentType.SUBSTATION, w))
    
    # PMUs
    for _ in range(n_pmu):
        w = float(pmu_weight + 0.3 * rng.random())
        agents.append(make_agent(AgentType.PMU, w))
    
    # Breakers
    for _ in range(n_brk):
        w = float(brk_weight + 0.3 * rng.random())
        agents.append(make_agent(AgentType.BREAKER, w))
    
    return agents


# ============================================================================
# STEP 6: INITIALIZE SCENARIO ENGINE
# ============================================================================

def create_attack_and_fault_configs() -> Tuple[AttackConfig, FaultConfig]:
    """Create attack and fault configurations with paper parameters."""
    attack_cfg = AttackConfig(
        fdi_bias=2.5,
        fdi_drift=0.05,
        dos_latency_increase=4.0,
        dos_integrity_drop=0.8,
        mitm_noise_std=1.0,
    )
    
    fault_cfg = FaultConfig(
        sag_pct=0.45,
        surge_pct=0.35,
        overcurrent_pct=0.70,
        freq_delta=1.5,
    )
    
    return attack_cfg, fault_cfg


# ============================================================================
# STEP 7 & 8: RUN SIMULATIONS
# ============================================================================

def run_all_simulations(
    agents_dyn: List[BaseAgent],
    agents_base: List[BaseAgent],
    lstm_infer: LSTMInferencer,
    config: Dict[str, Any],
    logger: logging.Logger,
    ablation_mode: str = 'HYBRID',
) -> Tuple[List[Dict], List[Dict], List[Dict], List[Dict], List[int], List[int], List[str], List[str], float, float, Dict[str, Any]]:
    """
    Run both dynamic (RL+gradient) and baseline (f=1) simulations.
    
    Returns:
        (dynamic_metrics, dynamic_events, baseline_metrics, baseline_events, y_true_dyn, y_pred_dyn, y_pred_types_dyn, y_true_types_dyn, initial_risk_dyn, final_risk_dyn, convergence_info_dyn)
    """
    attack_cfg, fault_cfg = create_attack_and_fault_configs()
    
    logger.info("="*70)
    logger.info("RUNNING DYNAMIC SIMULATION (RL + Gradient + Audits + Learning)")
    logger.info("="*70)
    
    # Optional f_max override via env
    if F_MAX_OVERRIDE:
        try:
            config.setdefault("audit", {})["f_max"] = int(F_MAX_OVERRIDE)
        except Exception:
            pass

    # Create RL scheduler with env-driven overrides
    from smartgrid_mas.audit.audit_scheduler_rl import QLearningAuditScheduler
    scheduler = QLearningAuditScheduler(gamma=RL_GAMMA, alpha=RL_ALPHA)
    scheduler.epsilon = RL_EPSILON_START
    scheduler.epsilon_min = RL_EPSILON_MIN
    scheduler.epsilon_decay = RL_EPSILON_DECAY
    # Warm-start Q-table for improved early convergence
    try:
        scheduler.warm_start_defaults()
    except Exception:
        pass

    # Allow env overrides for quick experiments
    _cycle_hours = int(os.environ.get("SMARTGRID_CYCLE_HOURS", config["simulation"]["cycle_hours"]))
    _timestep_minutes = int(os.environ.get("SMARTGRID_TIMESTEP_MINUTES", config["simulation"]["timestep_minutes"]))

    dyn_metrics, dyn_events, y_true_dyn, y_pred_dyn, y_pred_types_dyn, y_true_types_dyn, initial_risk_dyn, final_risk_dyn, conv_info_dyn = run_simulation_24h(
        agents=agents_dyn,
        lstm_infer=lstm_infer,
        timestep_minutes=_timestep_minutes,
        cycle_hours=_cycle_hours,
        risk_threshold=RISK_THRESHOLD,
        audit_budget_ratio=AUDIT_BUDGET_RATIO,
        max_audits_per_cycle=MAX_AUDITS_PER_CYCLE,
        f_min=int(config["audit"]["f_min"]),
        f_max=int(config["audit"]["f_max"]),
        audit_cost_per_audit=1.0,
        operational_cost=100.0,
        alpha_low=ALPHA_LOW,
        alpha_high=ALPHA_HIGH,
        beta=BETA,
        cluster_k=3,
        cluster_window=50,
        C_a=1.0,
        C_f=100.0,
        grad_lr=GRADIENT_LR,
        scheduler=scheduler,
        ablation_mode=ablation_mode,
        scenario_fdi_rate=FDI_RATE,
        scenario_dos_rate=DOS_RATE,
        scenario_chain_rate=CHAIN_RATE,
        scenario_fault_rate=FAULT_RATE,
        attack_cfg=attack_cfg,
        fault_cfg=fault_cfg,
    )
    logger.info(f"✓ Dynamic run complete: {len(dyn_metrics)} timesteps, {len(dyn_events)} events")
    
    logger.info("="*70)
    logger.info("RUNNING BASELINE SIMULATION (Fixed Frequency f=1)")
    logger.info("="*70)
    
    base_metrics, base_events, _, _, _, _, _ = run_fixed_audit_24h(
        agents=agents_base,
        lstm_infer=lstm_infer,
        fixed_f=BASELINE_FIXED_F,
        timestep_minutes=_timestep_minutes,
        cycle_hours=_cycle_hours,
        audit_cost_per_audit=1.0,
        operational_cost=100.0,
        alpha_low=ALPHA_LOW,
        alpha_high=ALPHA_HIGH,
        beta=BETA,
        scenario_fdi_rate=FDI_RATE,
        scenario_dos_rate=DOS_RATE,
        scenario_chain_rate=CHAIN_RATE,
        scenario_fault_rate=FAULT_RATE,
        attack_cfg=attack_cfg,
        fault_cfg=fault_cfg,
    )
    logger.info(f"✓ Baseline run complete: {len(base_metrics)} timesteps, {len(base_events)} events")
    
    return dyn_metrics, dyn_events, base_metrics, base_events, y_true_dyn, y_pred_dyn, y_pred_types_dyn, y_true_types_dyn, initial_risk_dyn, final_risk_dyn, conv_info_dyn


# ============================================================================
# STEP 9: COMPUTE EVALUATION METRICS
# ============================================================================

def compute_evaluation_metrics(
    dyn_metrics: List[Dict],
    dyn_events: List[Dict],
    base_metrics: List[Dict],
    base_events: List[Dict],
    y_true_dyn: List[int],
    y_pred_dyn: List[int],
    y_pred_types_dyn: List[str],
    y_true_types_dyn: List[str],
    initial_risk_dyn: float,
    final_risk_dyn: float,
    convergence_info: Dict[str, Any],
    logger: logging.Logger,
    failure_cost_coeff: float = 10.0,
) -> Dict[str, Any]:
    """Compute comprehensive evaluation metrics."""
    logger.info("Computing evaluation metrics...")
    
    # Build summary from metrics, ground truth, and risk scores
    summary = build_summary(
        dyn_metrics,
        base_metrics,
        y_true_dyn,
        y_pred_dyn,
        y_pred_types_dyn,
        y_true_types_dyn,
        initial_risk_dyn,
        final_risk_dyn,
        failure_cost_coeff=failure_cost_coeff,
    )
    
    # Add event counts
    summary["dynamic_events"] = len(dyn_events)
    summary["baseline_events"] = len(base_events)

    # Response mechanism metrics (severity and levels)
    if dyn_events:
        sev_scores = [e.get("severity_score") for e in dyn_events if "severity_score" in e]
        sev_levels = [e.get("severity_level") for e in dyn_events if "severity_level" in e]
        if sev_scores:
            summary["avg_severity_score"] = float(np.mean(sev_scores))
        level_counts: Dict[str, int] = {}
        for lvl in sev_levels:
            level_counts[str(lvl)] = level_counts.get(str(lvl), 0) + 1
        if level_counts:
            summary["severity_level_distribution"] = level_counts

    # Alias keys used by the printer so values render instead of defaulting to 0
    summary["attack_rate_dyn"] = summary.get("dynamic_mean_attack_rate", 0.0)
    summary["attack_rate_base"] = summary.get("baseline_mean_attack_rate", 0.0)
    summary["cost_dyn"] = summary.get("dynamic_total_audit_cost", 0.0)
    summary["cost_base"] = summary.get("baseline_total_audit_cost", 0.0)
    summary["intended_cost_dyn"] = summary.get("dynamic_intended_audit_cost", 0.0)
    summary["intended_cost_base"] = summary.get("baseline_intended_audit_cost", 0.0)
    summary["executed_cost_dynamic"] = summary.get("executed_cost_dynamic", summary.get("dynamic_total_audit_cost", 0.0))
    summary["executed_cost_baseline"] = summary.get("executed_cost_baseline", summary.get("baseline_total_audit_cost", 0.0))

    # Coverage over the full cycle (final cumulative coverage)
    if dyn_metrics:
        summary["coverage_dyn"] = float(dyn_metrics[-1].get("coverage", 0.0))
    if base_metrics:
        summary["coverage_base"] = float(base_metrics[-1].get("coverage", 0.0))
    
    # Add convergence metrics (AGT - Algorithm Gradient Time)
    summary["rl_iterations"] = convergence_info.get("rl_iterations", 0)
    summary["rl_converged"] = convergence_info.get("rl_converged", False)
    summary["rl_epsilon_final"] = convergence_info.get("rl_epsilon_final", None)
    summary["rl_rolling_mean_abs_q_delta"] = convergence_info.get("rl_rolling_mean_abs_q_delta", 0.0)
    summary["rl_stable_windows"] = convergence_info.get("rl_stable_windows", 0)
    summary["gradient_iterations"] = convergence_info.get("gradient_iterations", 0)
    summary["gradient_converged"] = convergence_info.get("gradient_converged", False)
    summary["validity_notes"] = convergence_info.get("validity_notes", [])
    
    # Add chain attack tracking
    summary["chain_attack_pairs"] = convergence_info.get("chain_attack_pairs", 0)
    summary["chain_attack_agents"] = convergence_info.get("chain_attack_agents", 0)
    
    # Budget model reporting
    summary["operational_cost"] = convergence_info.get("operational_cost", 0.0)
    summary["budget_ratio"] = convergence_info.get("budget_ratio", 0.0)
    summary["allowed_budget"] = convergence_info.get("allowed_budget", 0)
    summary["actual_audit_spend"] = convergence_info.get("actual_audit_spend", 0.0)
    summary["budget_compliance"] = convergence_info.get("budget_compliance", False)
    
    # Overhead analysis
    summary["total_runtime_sec"] = convergence_info.get("total_runtime_sec", 0.0)
    summary["avg_lstm_inference_time_ms"] = convergence_info.get("avg_lstm_inference_time_ms", 0.0)
    summary["avg_schedule_time_ms"] = convergence_info.get("avg_schedule_time_ms", 0.0)
    
    # Reproducibility bundle
    summary["config"] = convergence_info.get("config", {})

    logger.info(f"✓ Metrics computed")
    
    return summary


# ============================================================================
# STEP 10: EXPORT RESULTS
# ============================================================================

def export_all_results(
    dyn_metrics: List[Dict],
    dyn_events: List[Dict],
    base_metrics: List[Dict],
    base_events: List[Dict],
    summary: Dict[str, Any],
    logger: logging.Logger,
    output_dir: Path | None = None,
) -> None:
    """Export all results to CSV and JSON files."""
    logger.info("Exporting results...")
    
    # Create output directory structure
    base_dir = output_dir or LOGS_DIR
    base_dir.mkdir(parents=True, exist_ok=True)
    
    # Export metrics CSVs
    dynamic_csv = base_dir / "dynamic_metrics.csv"
    baseline_csv = base_dir / "baseline_metrics.csv"
    
    export_records_csv(dyn_metrics, str(dynamic_csv))
    logger.info(f"✓ Dynamic metrics: {dynamic_csv}")
    
    export_records_csv(base_metrics, str(baseline_csv))
    logger.info(f"✓ Baseline metrics: {baseline_csv}")
    
    # Export events CSVs
    events_dyn_csv = base_dir / "events_dynamic.csv"
    events_base_csv = base_dir / "events_baseline.csv"
    
    if dyn_events:
        dyn_df = pd.DataFrame(dyn_events)
        dyn_df.to_csv(events_dyn_csv, index=False)
        logger.info(f"✓ Dynamic events: {events_dyn_csv}")
    
    if base_events:
        base_df = pd.DataFrame(base_events)
        base_df.to_csv(events_base_csv, index=False)
        logger.info(f"✓ Baseline events: {events_base_csv}")
    
    # Export summary as JSON
    summary_json = base_dir / "summary.json"
    with open(summary_json, "w") as f:
        json.dump(summary, f, indent=2, default=str)
    logger.info(f"✓ Summary JSON: {summary_json}")


# ============================================================================
# STEP 11: PRINT SUMMARY REPORT
# ============================================================================

def print_summary_report(summary: Dict[str, Any], logger: logging.Logger) -> None:
    """Print final summary in a clean table format."""
    logger.info("="*70)
    logger.info("FINAL EXPERIMENT SUMMARY")
    logger.info("="*70)
    
    print("\n" + "="*70)
    print("EXPERIMENT RESULTS SUMMARY")
    print("="*70 + "\n")


def print_compact_sweep_table(run_summaries: List[Dict[str, Any]], logger: logging.Logger) -> None:
    """Print a compact multi-N table for presentation in the terminal."""
    if not run_summaries:
        return

    # Collect latest summary per N
    by_n: Dict[int, Dict[str, Any]] = {}
    for entry in run_summaries:
        summ = entry.get("summary", {})
        n_val = summ.get("n_agents") or entry.get("n")
        if n_val is None:
            continue
        try:
            by_n[int(n_val)] = summ
        except Exception:
            continue

    if not by_n:
        return

    order = sorted(by_n.keys())

    def pct(val: float) -> str:
        return f"{val * 100:.2f}%"

    def money(val: float) -> str:
        return f"${val:,.2f}"

    def fmt(val: float, digits: int = 4) -> str:
        return f"{val:.{digits}f}"

    def get(n: int, key: str, default: float = 0.0) -> float:
        return by_n.get(n, {}).get(key, default)

    def add_row(label: str, values: List[str], lines: List[str]) -> None:
        lines.append(f"{label:<35} " + " ".join(f"{v:>11}" for v in values))

    lines: List[str] = []
    lines.append("======================================================================")
    lines.append("EXPERIMENT RESULTS SUMMARY (N sweep)")
    lines.append("======================================================================")
    header_vals = [f"N{n}" for n in order]
    lines.append("Metric".ljust(35) + " " + " ".join(f"{h:>11}" for h in header_vals))
    lines.append("-" * 70)

    add_row("Attack Rate (Dynamic)", [pct(get(n, "dynamic_mean_attack_rate", get(n, "attack_rate_dyn", 0))) for n in order], lines)
    add_row("Attack Rate (Baseline)", [pct(get(n, "baseline_mean_attack_rate", get(n, "attack_rate_base", 0))) for n in order], lines)
    add_row("Attack Rate Reduction", [pct(get(n, "attack_rate_reduction", 0)) for n in order], lines)
    lines.append("-" * 70)

    add_row("Precision (Dynamic)", [fmt(get(n, "precision", 0), 4) for n in order], lines)
    add_row("Recall (Dynamic)", [fmt(get(n, "recall", 0), 3) for n in order], lines)
    add_row("F1-Score (Dynamic)", [fmt(get(n, "f1", 0), 4) for n in order], lines)
    add_row("TPR / TNR / FPR", [f"{fmt(get(n,'tpr',0),3)}/{fmt(get(n,'tnr',0),4)}/{fmt(get(n,'fpr',0),4)}" for n in order], lines)
    add_row("Accuracy (Dynamic)", [fmt(get(n, "accuracy", 0), 3) for n in order], lines)
    lines.append("-" * 70)

    add_row("Risk Mitigation", [pct(get(n, "risk_mitigation", 0)) for n in order], lines)
    add_row("Mean Risk Dyn/Base", [f"{fmt(get(n,'mean_global_risk_dynamic',0),4)}/{fmt(get(n,'mean_global_risk_baseline',0),4)}" for n in order], lines)
    add_row("Risk Reduced per $", [fmt(get(n, "risk_reduced_per_cost", 0), 6) for n in order], lines)
    add_row("CLSI", [pct(get(n, "cross_layer_stability", {}).get("index", 0)) for n in order], lines)
    add_row("Deviation Slope", [fmt(get(n, "deviation_trend", {}).get("deviation_slope", 0), 6) for n in order], lines)
    lines.append("-" * 70)

    add_row("Audit Coverage Dyn/Base", [f"{pct(get(n,'coverage_cycle_dynamic', get(n,'coverage_dyn',0)))}/{pct(get(n,'coverage_cycle_baseline', get(n,'coverage_base',0)))}" for n in order], lines)
    lines.append("-" * 70)

    add_row("Cost Exec Dyn/Base", [f"{money(get(n,'executed_cost_dynamic', get(n,'dynamic_total_audit_cost',0)))}/{money(get(n,'executed_cost_baseline', get(n,'baseline_total_audit_cost',0)))}" for n in order], lines)
    add_row("Intended Cost Dyn/Base", [f"{money(get(n,'dynamic_intended_audit_cost',0))}/{money(get(n,'baseline_intended_audit_cost',0))}" for n in order], lines)
    add_row("Cost Efficiency", [pct(get(n, "cost_efficiency", 0)) for n in order], lines)
    lines.append("-" * 70)

    add_row("RL Iterations", [str(int(get(n, "rl_iterations", 0))) for n in order], lines)
    add_row("Gradient Iterations", [str(int(get(n, "gradient_iterations", 0))) for n in order], lines)
    lines.append("-" * 70)

    add_row("Chain Pairs/Agents", [f"{int(get(n,'chain_attack_pairs',0))}/{int(get(n,'chain_attack_agents',0))}" for n in order], lines)
    add_row("Events Dyn/Base", [f"{int(get(n,'dynamic_events',0))}/{int(get(n,'baseline_events',0))}" for n in order], lines)
    lines.append("======================================================================")

    for line in lines:
        logger.info(line)
    
    # Key metrics table
    metrics_table = [
        ("Metric", "Value"),
        ("-" * 40, "-" * 20),
        ("Attack Rate (Dynamic)", f"{summary.get('attack_rate_dyn', 0):.2%}"),
        ("Attack Rate (Baseline)", f"{summary.get('attack_rate_base', 0):.2%}"),
        ("Attack Rate Reduction", f"{summary.get('attack_rate_reduction', 0):.2%}"),
        ("-" * 40, "-" * 20),
        ("Precision (Dynamic)", f"{summary.get('precision', 0):.3f}"),
        ("Recall (Dynamic)", f"{summary.get('recall', 0):.3f}"),
        ("F1-Score (Dynamic)", f"{summary.get('f1', 0):.3f}"),
        ("TPR/Sensitivity (Dynamic)", f"{summary.get('tpr', 0):.3f}"),
        ("TNR/Specificity (Dynamic)", f"{summary.get('tnr', 0):.3f}"),
        ("FPR (Dynamic)", f"{summary.get('fpr', 0):.3f}"),
        ("FNR (Dynamic)", f"{summary.get('fnr', 0):.3f}"),
        ("Accuracy (Dynamic)", f"{summary.get('accuracy', 0):.3f}"),
        ("-" * 40, "-" * 20),
        ("Risk Mitigation", f"{summary.get('risk_mitigation', 0):.2%}"),
        ("Mean Global Risk (Dynamic)", f"{summary.get('mean_global_risk_dynamic', 0):.4f}"),
        ("Mean Global Risk (Baseline)", f"{summary.get('mean_global_risk_baseline', 0):.4f}"),
        ("Risk Reduced per $ (Dynamic)", f"{summary.get('risk_reduced_per_cost', 0):.6f}"),
        ("Cross-Layer Stability (CLSI)", f"{summary.get('cross_layer_stability', {}).get('index', 0.0):.2%}"),
        ("Deviation Trend Slope", f"{summary.get('deviation_trend', {}).get('deviation_slope', 0.0):.6f}"),
        ("-" * 40, "-" * 20),
        ("Audit Coverage (Dynamic)", f"{summary.get('coverage_dyn', 0):.2%}"),
        ("Audit Coverage (Baseline)", f"{summary.get('coverage_base', 0):.2%}"),
        ("-" * 40, "-" * 20),
        ("Total Cost (Dynamic - executed)", f"${summary.get('executed_cost_dynamic', summary.get('cost_dyn', 0)):.2f}"),
        ("Total Cost (Baseline - executed)", f"${summary.get('executed_cost_baseline', summary.get('cost_base', 0)):.2f}"),
        ("Intended Cost (Dynamic)", f"${summary.get('intended_cost_dyn', 0):.2f}"),
        ("Intended Cost (Baseline)", f"${summary.get('intended_cost_base', 0):.2f}"),
        ("Cost Efficiency", f"{summary.get('cost_efficiency', 0):.2%}"),
        ("-" * 40, "-" * 20),
        ("RL Iterations", f"{summary.get('rl_iterations', 0)}"),
        ("RL Converged", f"{'Yes' if summary.get('rl_converged', False) else 'No'}"),
        ("Gradient Iterations", f"{summary.get('gradient_iterations', 0)}"),
        ("Gradient Converged", f"{'Yes' if summary.get('gradient_converged', False) else 'No'}"),
        ("-" * 40, "-" * 20),
        ("Chain Attack Pairs", f"{summary.get('chain_attack_pairs', 0)}"),
        ("Chain Attack Agents", f"{summary.get('chain_attack_agents', 0)}"),
        ("-" * 40, "-" * 20),
        ("Events (Dynamic)", f"{summary.get('dynamic_events', 0)}"),
        ("Events (Baseline)", f"{summary.get('baseline_events', 0)}"),
    ]
    
    for metric, value in metrics_table:
        print(f"{metric:<40} {value:>20}")
    
    print("\n" + "="*70)
    print("Outputs saved to: logs/")
    print("  - dynamic_metrics.csv")
    print("  - baseline_metrics.csv")
    print("  - events_dynamic.csv")
    print("  - events_baseline.csv")
    print("  - summary.json")
    print("="*70 + "\n")


# ============================================================================
# MAIN ORCHESTRATION
# ============================================================================

def main() -> None:
    """Orchestrate the complete experimental pipeline."""
    start_time = datetime.now()
    
    # Setup logging
    logger = setup_logging()
    logger.info(f"Smart Grid Audit Framework - End-to-End Experiment Runner")
    logger.info(f"Start time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(
        "Audit caps: max_audits_per_cycle=%s, budget_ratio=%.3f, constraint_log_level=%s",
        MAX_AUDITS_PER_CYCLE,
        AUDIT_BUDGET_RATIO,
        CONSTRAINT_LOG_LEVEL,
    )
    
    # Support seed sweep for robustness analysis
    seed_env = os.environ.get("SMARTGRID_SEEDS", "").strip()
    if seed_env:
        try:
            seeds = [int(x) for x in seed_env.split(",") if x.strip()]
        except Exception:
            seeds = [SEED]
    else:
        seeds = [SEED]
    
    # Support ablation mode: RL_ONLY, GRADIENT_ONLY, or HYBRID (default)
    ablation_env = os.environ.get("SMARTGRID_ABLATION", "").strip().upper()
    ablation_modes = []
    if ablation_env:
        try:
            ablation_modes = [x.strip() for x in ablation_env.split(",") if x.strip()]
            # Validate ablation modes
            valid_modes = {'RL_ONLY', 'GRADIENT_ONLY', 'HYBRID'}
            for mode in ablation_modes:
                if mode not in valid_modes:
                    logger_err = logging.getLogger(__name__)
                    logger_err.warning(f"Invalid ablation mode: {mode}. Using HYBRID.")
                    ablation_modes = ['HYBRID']
                    break
        except Exception:
            ablation_modes = ['HYBRID']
    else:
        ablation_modes = ['HYBRID']
    
    all_summaries = []  # For aggregation across seeds and N, with paths
    
    try:
        # Step 1: Set deterministic seeds
        logger.info("\n" + "="*70)
        logger.info("STEP 1: Setting Deterministic Seeds")
        logger.info("="*70)
        set_seeds(SEED)
        logger.info(f"✓ Seeds set to {SEED}")
        
        # Support multiple seeds for robustness analysis (full pipeline per seed)
        for seed_idx, current_seed in enumerate(seeds):
            if len(seeds) > 1:
                logger.info("\n" + "="*70)
                logger.info(f"ROBUSTNESS RUN {seed_idx + 1}/{len(seeds)} (Seed={current_seed})")
                logger.info("="*70)
            set_seeds(current_seed)

            # Seed-specific logs directory
            seed_logs = LOGS_DIR / f"seed_{current_seed}" if len(seeds) > 1 else LOGS_DIR
            seed_logs.mkdir(parents=True, exist_ok=True)
            seed_run_summaries: List[Dict[str, Any]] = []

            # Step 2: Validate environment
            logger.info("\n" + "="*70)
            logger.info("STEP 2: Validating Environment")
            logger.info("="*70)
            validate_and_setup_environment(logger)
            
            # Step 3: Train LSTM if needed
            logger.info("\n" + "="*70)
            logger.info("STEP 3: LSTM Model Training (If Needed)")
            logger.info("="*70)
            train_lstm_if_needed(logger)
            
            # Step 4: Load LSTM
            logger.info("\n" + "="*70)
            logger.info("STEP 4: Loading LSTM Model")
            logger.info("="*70)
            lstm_infer = load_lstm_model(logger)
            
            # Load config
            config = load_config(CONFIG_PATH)
            # Cycle length override
            cycle_override = os.environ.get("SMARTGRID_CYCLE_HOURS", "").strip()
            if cycle_override:
                try:
                    config.setdefault("simulation", {})["cycle_hours"] = int(cycle_override)
                except Exception:
                    pass
            
            # Agent scalability sweep per paper: N in {100, 200, 500}
            sweep_env = os.environ.get("SMARTGRID_SWEEP", "").strip()
            if sweep_env:
                try:
                    sweep = [int(x) for x in sweep_env.split(",") if x.strip()]
                except Exception:
                    sweep = [100]  # Phase 1: Test N=100 only
            else:
                sweep = [100]  # Phase 1: Test N=100 only
            for n_agents in sweep:
                logger.info("\n" + "="*70)
                logger.info("STEP 5: Building Agent Pools")
                logger.info("="*70)
                logger.info(f"Creating {n_agents} agents with paper-faithful distribution...")
                agents_dyn = build_agent_pool(n_agents, seed=current_seed)
                agents_base = build_agent_pool(n_agents, seed=current_seed)
                logger.info(f"✓ Built {len(agents_dyn)} agents for dynamic run")
                logger.info(f"✓ Built {len(agents_base)} agents for baseline run")

                # Step 6: Scenario configuration
                logger.info("\n" + "="*70)
                logger.info("STEP 6: Scenario Configuration")
                logger.info("="*70)
                logger.info(f"✓ FDI rate: {FDI_RATE:.0%}")
                logger.info(f"✓ DoS rate: {DOS_RATE:.0%}")
                logger.info(f"✓ Chain attack rate: {CHAIN_RATE:.0%}")
                logger.info(f"✓ Fault rate: {FAULT_RATE:.0%}")

                # Step 7-8: Run simulations (ablation modes)
                logger.info("\n" + "="*70)
                logger.info("STEP 7-8: Running Simulations")
                logger.info(f"Ablation modes: {', '.join(ablation_modes)}")
                logger.info("="*70)

                ablation_results = {}
                for ablation_mode in ablation_modes:
                    logger.info(f"\n  → Ablation mode: {ablation_mode}")
                    dyn_metrics, dyn_events, base_metrics, base_events, y_true_dyn, y_pred_dyn, y_pred_types_dyn, y_true_types_dyn, initial_risk_dyn, final_risk_dyn, conv_info_dyn = run_all_simulations(
                        agents_dyn, agents_base, lstm_infer, config, logger, ablation_mode=ablation_mode
                    )
                    ablation_results[ablation_mode] = {
                        'dyn_metrics': dyn_metrics, 'dyn_events': dyn_events,
                        'base_metrics': base_metrics, 'base_events': base_events,
                        'y_true_dyn': y_true_dyn, 'y_pred_dyn': y_pred_dyn,
                        'y_pred_types_dyn': y_pred_types_dyn, 'y_true_types_dyn': y_true_types_dyn,
                        'initial_risk_dyn': initial_risk_dyn, 'final_risk_dyn': final_risk_dyn,
                        'conv_info_dyn': conv_info_dyn,
                    }

                primary_mode = 'HYBRID' if 'HYBRID' in ablation_results else list(ablation_results.keys())[0]
                dyn_metrics, dyn_events, base_metrics, base_events = (
                    ablation_results[primary_mode]['dyn_metrics'],
                    ablation_results[primary_mode]['dyn_events'],
                    ablation_results[primary_mode]['base_metrics'],
                    ablation_results[primary_mode]['base_events']
                )
                y_true_dyn, y_pred_dyn, y_pred_types_dyn, y_true_types_dyn = (
                    ablation_results[primary_mode]['y_true_dyn'],
                    ablation_results[primary_mode]['y_pred_dyn'],
                    ablation_results[primary_mode]['y_pred_types_dyn'],
                    ablation_results[primary_mode]['y_true_types_dyn']
                )
                initial_risk_dyn, final_risk_dyn, conv_info_dyn = (
                    ablation_results[primary_mode]['initial_risk_dyn'],
                    ablation_results[primary_mode]['final_risk_dyn'],
                    ablation_results[primary_mode]['conv_info_dyn']
                )

                # Step 9: Compute metrics
                logger.info("\n" + "="*70)
                logger.info("STEP 9: Computing Evaluation Metrics")
                logger.info("="*70)
                summary = compute_evaluation_metrics(
                    dyn_metrics,
                    dyn_events,
                    base_metrics,
                    base_events,
                    y_true_dyn,
                    y_pred_dyn,
                    y_pred_types_dyn,
                    y_true_types_dyn,
                    initial_risk_dyn,
                    final_risk_dyn,
                    conv_info_dyn,
                    logger,
                    failure_cost_coeff=10.0,
                )
                summary["n_agents"] = n_agents
                summary["seed"] = current_seed
                if len(ablation_results) > 1:
                    logger.info("\n  → Computing ablation comparison metrics...")
                    summary["ablation_modes"] = {}
                    for ablation_mode, results in ablation_results.items():
                        ablation_summary = compute_evaluation_metrics(
                            results['dyn_metrics'], results['dyn_events'],
                            results['base_metrics'], results['base_events'],
                            results['y_true_dyn'], results['y_pred_dyn'],
                            results['y_pred_types_dyn'], results['y_true_types_dyn'],
                            results['initial_risk_dyn'], results['final_risk_dyn'], results['conv_info_dyn'],
                            logger,
                            failure_cost_coeff=10.0,
                        )
                        summary["ablation_modes"][ablation_mode] = ablation_summary
                    logger.info(f"  ✓ Ablation comparison complete ({len(ablation_results)} modes)")
                else:
                    summary["ablation_mode"] = primary_mode

                # Step 10: Export results to seed-specific N folder
                logger.info("\n" + "="*70)
                logger.info("STEP 10: Exporting Results")
                logger.info("="*70)
                out_dir = seed_logs / f"N{n_agents}"
                export_all_results(dyn_metrics, dyn_events, base_metrics, base_events, summary, logger, output_dir=out_dir)

                # Step 11: Print summary
                logger.info("\n" + "="*70)
                logger.info("STEP 11: Printing Summary Report")
                logger.info("="*70)
                print_summary_report(summary, logger)

                entry = {"seed": current_seed, "n": n_agents, "summary": summary, "path": out_dir / "summary.json"}
                all_summaries.append(entry)
                seed_run_summaries.append(entry)

            # Print compact multi-N table for this seed
            print_compact_sweep_table(seed_run_summaries, logger)
        logger.info("\n" + "="*70)
        logger.info("STEP 2: Validating Environment")
        logger.info("="*70)
        validate_and_setup_environment(logger)
        
        # Step 3: Train LSTM if needed
        logger.info("\n" + "="*70)
        logger.info("STEP 3: LSTM Model Training (If Needed)")
        logger.info("="*70)
        train_lstm_if_needed(logger)
        
        # Step 4: Load LSTM
        logger.info("\n" + "="*70)
        logger.info("STEP 4: Loading LSTM Model")
        logger.info("="*70)
        lstm_infer = load_lstm_model(logger)
        
        # Load config for experiment parameters
        config = load_config(CONFIG_PATH)
        # Agent scalability sweep per paper: N in {100, 200, 500}
        sweep_env = os.environ.get("SMARTGRID_SWEEP", "").strip()
        if sweep_env:
            try:
                sweep = [int(x) for x in sweep_env.split(",") if x.strip()]
            except Exception:
                sweep = [100, 200, 500]
        else:
            sweep = [100, 200, 500]
        for n_agents in sweep:
            logger.info("\n" + "="*70)
            logger.info("STEP 5: Building Agent Pools")
            logger.info("="*70)
            logger.info(f"Creating {n_agents} agents with paper-faithful distribution...")
            agents_dyn = build_agent_pool(n_agents, seed=SEED)
            agents_base = build_agent_pool(n_agents, seed=SEED)
            logger.info(f"✓ Built {len(agents_dyn)} agents for dynamic run")
            logger.info(f"✓ Built {len(agents_base)} agents for baseline run")

            # Step 6: Scenario configuration
            logger.info("\n" + "="*70)
            logger.info("STEP 6: Scenario Configuration")
            logger.info("="*70)
            logger.info(f"✓ FDI rate: {FDI_RATE:.0%}")
            logger.info(f"✓ DoS rate: {DOS_RATE:.0%}")
            logger.info(f"✓ Chain attack rate: {CHAIN_RATE:.0%}")
            logger.info(f"✓ Fault rate: {FAULT_RATE:.0%}")

            # Optional cycle length override for faster sweeps
            cycle_override = os.environ.get("SMARTGRID_CYCLE_HOURS", "").strip()
            if cycle_override:
                try:
                    config.setdefault("simulation", {})["cycle_hours"] = int(cycle_override)
                except Exception:
                    pass

            # Step 7 & 8: Run simulations (iterate over ablation modes if specified)
            logger.info("\n" + "="*70)
            logger.info("STEP 7-8: Running Simulations")
            logger.info(f"Ablation modes: {', '.join(ablation_modes)}")
            logger.info("="*70)
            
            ablation_results = {}
            for ablation_mode in ablation_modes:
                logger.info(f"\n  → Ablation mode: {ablation_mode}")
                dyn_metrics, dyn_events, base_metrics, base_events, y_true_dyn, y_pred_dyn, y_pred_types_dyn, y_true_types_dyn, initial_risk_dyn, final_risk_dyn, conv_info_dyn = run_all_simulations(
                    agents_dyn, agents_base, lstm_infer, config, logger, ablation_mode=ablation_mode
                )
                ablation_results[ablation_mode] = {
                    'dyn_metrics': dyn_metrics, 'dyn_events': dyn_events,
                    'base_metrics': base_metrics, 'base_events': base_events,
                    'y_true_dyn': y_true_dyn, 'y_pred_dyn': y_pred_dyn,
                    'y_pred_types_dyn': y_pred_types_dyn, 'y_true_types_dyn': y_true_types_dyn,
                    'initial_risk_dyn': initial_risk_dyn, 'final_risk_dyn': final_risk_dyn,
                    'conv_info_dyn': conv_info_dyn,
                }
            
            # Use HYBRID as the primary result for metrics/export (for backward compatibility)
            # If HYBRID not in ablation_modes, use the first mode
            primary_mode = 'HYBRID' if 'HYBRID' in ablation_results else list(ablation_results.keys())[0]
            dyn_metrics, dyn_events, base_metrics, base_events = (
                ablation_results[primary_mode]['dyn_metrics'], 
                ablation_results[primary_mode]['dyn_events'],
                ablation_results[primary_mode]['base_metrics'], 
                ablation_results[primary_mode]['base_events']
            )
            y_true_dyn, y_pred_dyn, y_pred_types_dyn, y_true_types_dyn = (
                ablation_results[primary_mode]['y_true_dyn'], 
                ablation_results[primary_mode]['y_pred_dyn'],
                ablation_results[primary_mode]['y_pred_types_dyn'],
                ablation_results[primary_mode]['y_true_types_dyn']
            )
            initial_risk_dyn, final_risk_dyn, conv_info_dyn = (
                ablation_results[primary_mode]['initial_risk_dyn'], 
                ablation_results[primary_mode]['final_risk_dyn'],
                ablation_results[primary_mode]['conv_info_dyn']
            )

            # Step 9: Compute metrics
            logger.info("\n" + "="*70)
            logger.info("STEP 9: Computing Evaluation Metrics")
            logger.info("="*70)
            summary = compute_evaluation_metrics(
                dyn_metrics,
                dyn_events,
                base_metrics,
                base_events,
                y_true_dyn,
                y_pred_dyn,
                y_pred_types_dyn,
                y_true_types_dyn,
                initial_risk_dyn,
                final_risk_dyn,
                conv_info_dyn,
                logger,
                failure_cost_coeff=10.0,
            )
            summary["n_agents"] = n_agents
            
            # Add ablation results if multiple modes were tested
            if len(ablation_results) > 1:
                logger.info("\n  → Computing ablation comparison metrics...")
                summary["ablation_modes"] = {}
                for ablation_mode, results in ablation_results.items():
                    ablation_summary = compute_evaluation_metrics(
                        results['dyn_metrics'], results['dyn_events'],
                        results['base_metrics'], results['base_events'],
                        results['y_true_dyn'], results['y_pred_dyn'],
                        results['y_true_types_dyn'],
                        results['initial_risk_dyn'], results['final_risk_dyn'], results['conv_info_dyn'],
                        logger,
                        failure_cost_coeff=10.0,
                    )
                    summary["ablation_modes"][ablation_mode] = ablation_summary
                logger.info(f"  ✓ Ablation comparison complete ({len(ablation_results)} modes)")
            else:
                summary["ablation_mode"] = primary_mode

            # Step 10: Export results to N-specific folder
            logger.info("\n" + "="*70)
            logger.info("STEP 10: Exporting Results")
            logger.info("="*70)
            out_dir = LOGS_DIR / f"N{n_agents}"
            export_all_results(dyn_metrics, dyn_events, base_metrics, base_events, summary, logger, output_dir=out_dir)

            # Step 11: Print summary
            logger.info("\n" + "="*70)
            logger.info("STEP 11: Printing Summary Report")
            logger.info("="*70)
            print_summary_report(summary, logger)
            
            all_summaries.append({"seed": current_seed, "summary": summary})
        
        # Aggregate robustness statistics if multiple seeds
        if len(all_summaries) > 1:
            logger.info("\n" + "="*70)
            logger.info("SEED ROBUSTNESS ANALYSIS")
            logger.info("="*70)
            
            metrics_to_aggregate = [
                "attack_rate_reduction",
                "cost_efficiency",
                "f1",
                "risk_mitigation",
            ]
            
            # Aggregate across all runs
            aggregated = {}
            for metric in metrics_to_aggregate:
                values = [s["summary"].get(metric, 0) for s in all_summaries]
                aggregated[metric] = {
                    "mean": float(np.mean(values)),
                    "std": float(np.std(values)),
                    "min": float(np.min(values)),
                    "max": float(np.max(values)),
                }

            # Embed robustness analysis into each summary.json and rewrite
            for entry in all_summaries:
                entry["summary"]["seed_robustness_analysis"] = aggregated
                try:
                    with open(entry["path"], "w") as f:
                        json.dump(entry["summary"], f, indent=2, default=str)
                except Exception:
                    pass
            
            logger.info("Seed robustness statistics:")
            for metric, stats in aggregated.items():
                logger.info(f"  {metric}: {stats['mean']:.4f} ± {stats['std']:.4f} (min {stats['min']:.4f}, max {stats['max']:.4f})")
        
        # Final timing
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        logger.info(f"✓ Experiment completed successfully in {duration:.1f} seconds")
        logger.info(f"  End time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
    except Exception as e:
        logger.error(f"X Experiment failed: {e}", exc_info=True)
        print(f"\nX ERROR: {e}\n")
        sys.exit(1)


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    main()
