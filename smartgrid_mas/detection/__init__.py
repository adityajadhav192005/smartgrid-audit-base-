"""
Hybrid Detection Module
======================
Combines multiple anomaly detection modalities.
"""

from .integrity_validator import IntegrityValidator, HybridAnomalyDetector, IntegrityScore
from .lstm_pretraining import (
    AugmentedDatasetGenerator,
    LSTMPretrainedModel,
    pretrain_lstm_model,
    save_pretrained_model,
    load_pretrained_model
)
from .unified_detector import UnifiedAnomalyDetector
from .load_pretrained import (
    load_pretrained_lstm_checkpoint,
    ensure_pretrained_lstm_exists,
    get_pretrained_lstm_info,
    PRETRAINED_MODEL_PATH
)

__all__ = [
    "IntegrityValidator",
    "HybridAnomalyDetector",
    "IntegrityScore",
    "AugmentedDatasetGenerator",
    "LSTMPretrainedModel",
    "pretrain_lstm_model",
    "save_pretrained_model",
    "load_pretrained_model",
    "UnifiedAnomalyDetector",
    "load_pretrained_lstm_checkpoint",
    "ensure_pretrained_lstm_exists",
    "get_pretrained_lstm_info",
    "PRETRAINED_MODEL_PATH",
]
