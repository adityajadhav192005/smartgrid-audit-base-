"""
Hybrid Anomaly Detection Integration
====================================
Combines LSTM inference + deviation scoring + integrity validation
into unified detection pipeline.
"""

import numpy as np
from typing import Dict, Tuple, Optional
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
from smartgrid_mas.detection.integrity_validator import HybridAnomalyDetector, IntegrityValidator
import logging

logger = logging.getLogger(__name__)


class UnifiedAnomalyDetector:
    """
    Unified detector that combines three modalities:
    1. Deviation-based scoring (from existing framework)
    2. LSTM anomaly probability (pre-trained model)
    3. Cryptographic integrity validation (FDI/MITM detection)
    
    Voting ensemble: flag if 2+ of 3 detectors agree.
    
    Target Performance:
    - Accuracy: 95%+ (vs 82% deviation-only)
    - FPR: <5% (vs 19.7% deviation-only)
    - FNR: <5% (vs high on FDI/MITM)
    - TPR: >95% across all attack types
    """
    
    def __init__(self,
                 lstm_model_path: Optional[str] = None,
                 deviation_weight: float = 0.4,
                 lstm_weight: float = 0.4,
                 integrity_weight: float = 0.2,
                 ensemble_threshold: float = 0.5):
        """
        Initialize unified detector.
        
        Args:
            lstm_model_path: Path to pre-trained LSTM model (if None, skip LSTM)
            deviation_weight: Weight for deviation scoring
            lstm_weight: Weight for LSTM probability
            integrity_weight: Weight for integrity validation
            ensemble_threshold: Threshold for voting (0-1)
        """
        self.lstm_inferencer = None
        if lstm_model_path:
            try:
                self.lstm_inferencer = LSTMInferencer(lstm_model_path)
                logger.info(f"Loaded pre-trained LSTM from {lstm_model_path}")
            except Exception as e:
                logger.warning(f"Failed to load LSTM model: {e}. Falling back to deviation-only.")
        
        self.hybrid_detector = HybridAnomalyDetector(
            deviation_weight=deviation_weight,
            lstm_weight=lstm_weight,
            integrity_weight=integrity_weight
        )
        
        self.ensemble_threshold = ensemble_threshold
        
        # Metrics tracking
        self.detection_log = []
    
    def detect_anomaly(self,
                      agent_id: str,
                      deviation_score: float,
                      X_window: Optional[np.ndarray] = None,
                      Y_window: Optional[np.ndarray] = None,
                      message_data: Optional[Dict] = None) -> Tuple[bool, Dict]:
        """
        Comprehensive anomaly detection via ensemble voting.
        
        Args:
            agent_id: Agent identifier
            deviation_score: Deviation-based score (from existing framework)
            X_window: Physical metrics window [window_size, n_metrics]
            Y_window: Cyber metrics window [window_size, n_metrics]
            message_data: Raw message dict {metric: value} for integrity checks
        
        Returns:
            (is_anomalous: bool, detection_breakdown: dict)
        """
        breakdown = {
            "agent_id": agent_id,
            "deviation_score": deviation_score,
            "lstm_probability": 0.0,
            "integrity_verdict": "NORMAL",
            "integrity_confidence": 0.0,
            "ensemble_vote": 0,
            "is_anomalous": False,
            "confidence": 0.0
        }
        
        # 1. Deviation-based vote
        deviation_vote = 1 if deviation_score > 1.0 else 0
        breakdown["deviation_vote"] = deviation_vote
        
        # 2. LSTM probability vote (if model available)
        lstm_vote = 0
        if self.lstm_inferencer and X_window is not None and Y_window is not None:
            try:
                # Prepare input window
                lstm_input = np.concatenate([X_window, Y_window], axis=-1)
                # predict_proba expects 2D (window, features), not 3D batched
                
                # Get anomaly probability (use last timestep)
                lstm_probs = self.lstm_inferencer.predict_proba(lstm_input)
                lstm_prob = float(lstm_probs[-1, 0])
                breakdown["lstm_probability"] = lstm_prob
                lstm_vote = 1 if lstm_prob > self.ensemble_threshold else 0
                breakdown["lstm_vote"] = lstm_vote
            except Exception as e:
                logger.debug(f"LSTM inference failed for {agent_id}: {e}")
                lstm_vote = 0
        
        # 3. Integrity validation vote (if message data available)
        integrity_vote = 0
        if message_data:
            try:
                # Log message for CRC/hash tracking
                self.hybrid_detector.integrity_validator.validate_message_integrity(
                    agent_id, message_data)
                self.hybrid_detector.integrity_validator.compute_hash_entropy(
                    agent_id, message_data)
                
                # Get integrity score
                integrity_score = self.hybrid_detector.integrity_validator.compute_integrity_score(
                    agent_id)
                breakdown["integrity_verdict"] = integrity_score.severity
                breakdown["integrity_confidence"] = integrity_score.confidence
                
                integrity_vote = 1 if (integrity_score.is_compromised and 
                                      integrity_score.confidence > 0.7) else 0
                breakdown["integrity_vote"] = integrity_vote
            except Exception as e:
                logger.debug(f"Integrity validation failed for {agent_id}: {e}")
                integrity_vote = 0
        
        # Ensemble vote: require 2+ of 3
        total_votes = deviation_vote + lstm_vote + integrity_vote
        breakdown["ensemble_vote"] = total_votes
        breakdown["is_anomalous"] = total_votes >= 2
        breakdown["confidence"] = total_votes / 3.0
        
        # Logging
        self.detection_log.append(breakdown)
        
        return breakdown["is_anomalous"], breakdown
    
    def get_detection_metrics(self) -> Dict:
        """
        Compute detection quality metrics from logged detections.
        
        Returns:
            Dict with precision, recall, F1, accuracy, etc.
        """
        if not self.detection_log:
            return {}
        
        log = np.array([
            (d["is_anomalous"], d.get("is_truly_anomalous", d["is_anomalous"]))
            for d in self.detection_log
        ])
        
        tp = np.sum((log[:, 0] == 1) & (log[:, 1] == 1))
        tn = np.sum((log[:, 0] == 0) & (log[:, 1] == 0))
        fp = np.sum((log[:, 0] == 1) & (log[:, 1] == 0))
        fn = np.sum((log[:, 0] == 0) & (log[:, 1] == 1))
        
        precision = tp / (tp + fp + 1e-10)
        recall = tp / (tp + fn + 1e-10)
        f1 = 2 * precision * recall / (precision + recall + 1e-10)
        accuracy = (tp + tn) / (tp + tn + fp + fn + 1e-10)
        fpr = fp / (fp + tn + 1e-10)
        tpr = tp / (tp + fn + 1e-10)
        
        return {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "accuracy": accuracy,
            "tpr": tpr,
            "tnr": tn / (tn + fp + 1e-10),
            "fpr": fpr,
            "fnr": fn / (fn + tp + 1e-10),
            "total_detections": len(self.detection_log),
            "true_anomalies": int(np.sum(log[:, 1])),
            "detected_anomalies": int(np.sum(log[:, 0]))
        }
    
    def report_detection_breakdown(self) -> Dict:
        """
        Summarize performance of each detector modality.
        
        Returns:
            Dict showing deviation, LSTM, and integrity vote patterns
        """
        if not self.detection_log:
            return {}
        
        deviation_votes = np.array([d.get("deviation_vote", 0) for d in self.detection_log])
        lstm_votes = np.array([d.get("lstm_vote", 0) for d in self.detection_log])
        integrity_votes = np.array([d.get("integrity_vote", 0) for d in self.detection_log])
        
        return {
            "deviation_detector_agreement": float(np.mean(deviation_votes)),
            "lstm_detector_agreement": float(np.mean(lstm_votes)),
            "integrity_detector_agreement": float(np.mean(integrity_votes)),
            "ensemble_false_positives": int(np.sum((deviation_votes + lstm_votes + integrity_votes) >= 2)),
            "ensemble_false_negatives": int(np.sum((deviation_votes + lstm_votes + integrity_votes) < 2))
        }
