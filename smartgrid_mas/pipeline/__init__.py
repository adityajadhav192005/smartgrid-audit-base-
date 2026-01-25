"""
Smart Grid Audit Framework - Modular Pipeline Architecture
===========================================================

This module provides a clean, modular pipeline for the smart grid audit framework.

Pipeline Stages:
1. Configuration Loading
2. Data Generation/Loading
3. Anomaly Detection
4. Audit Scheduling (RL-based)
5. Evaluation & Metrics
6. Report Generation

Usage:
    from smartgrid_mas.pipeline import Pipeline
    
    pipeline = Pipeline()
    results = pipeline.run()
"""

from .config_manager import ConfigManager
from .main_pipeline import Pipeline

__all__ = [
    'ConfigManager',
    'Pipeline',
]
