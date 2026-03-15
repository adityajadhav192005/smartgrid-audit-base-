from __future__ import annotations
from pathlib import Path
import yaml
import os


def _deep_merge(base: dict, override: dict) -> dict:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_config(path: str | Path) -> dict:
    path = Path(path)
    with path.open("r", encoding="utf-8") as f:
        base_config = yaml.safe_load(f)

    runtime_overrides_path = path.parent / "runtime_overrides.json"
    if runtime_overrides_path.exists():
        with runtime_overrides_path.open("r", encoding="utf-8") as f:
            runtime_overrides = yaml.safe_load(f) or {}
        if isinstance(base_config, dict) and isinstance(runtime_overrides, dict):
            return _deep_merge(base_config, runtime_overrides)

    return base_config


def get_api_config() -> dict:
    """Load API configuration from environment variables or defaults."""
    return {
        "host": os.environ.get("SMARTGRID_API_HOST", "127.0.0.1"),
        "port": int(os.environ.get("SMARTGRID_API_PORT", "8000")),
        "api_key": os.environ.get("SMARTGRID_API_KEY", "smartgrid-dev-key"),
        "max_requests_per_min": int(os.environ.get("SMARTGRID_RATE_LIMIT", "100")),
    }


def get_simulation_config() -> dict:
    """Load simulation configuration from environment variables or defaults."""
    return {
        "cycle_hours": int(os.environ.get("SMARTGRID_CYCLE_HOURS", "24")),
        "timestep_minutes": int(os.environ.get("SMARTGRID_TIMESTEP_MINUTES", "5")),
        "agent_counts": list(map(int, os.environ.get("SMARTGRID_AGENT_COUNTS", "100,200,500").split(","))),
        "log_dir": os.environ.get("SMARTGRID_LOG_DIR", "logs"),
        "data_dir": os.environ.get("SMARTGRID_DATA_DIR", "data"),
    }
