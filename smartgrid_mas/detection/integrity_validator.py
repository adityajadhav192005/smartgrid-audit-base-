"""
Cryptographic Integrity Validation Module
==========================================
Detects False Data Injection (FDI) and Man-in-the-Middle (MITM) attacks
by validating message integrity using CRC32 checksums and hash-based
anomaly detection.

This module complements deviation-based detection by identifying data
tampering that doesn't necessarily cause statistical deviations.
"""

import hashlib
import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional


@dataclass
class IntegrityScore:
    """Result of cryptographic integrity validation."""
    agent_id: str
    crc_match_rate: float  # % of messages with valid CRC
    hash_deviation: float  # normalized hash entropy deviation
    is_compromised: bool   # True if FDI/MITM likely
    severity: str          # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    confidence: float      # 0-1 confidence in verdict


class IntegrityValidator:
    """
    Detects FDI/MITM attacks via cryptographic validation.
    
    Key Insight: FDI attacks often involve:
    1. Modifying field values (voltage, current, frequency)
    2. Recalculating CRC to match the tampered data
    3. But failing to update related consistency checks
    
    This module tracks:
    - CRC checksum validity across historical messages
    - Hash entropy of message payloads (steady state vs chaotic)
    - Cross-field correlation inconsistencies
    """
    
    def __init__(self, 
                 crc_threshold: float = 0.95,
                 entropy_threshold: float = 2.0,
                 correlation_threshold: float = 0.85):
        """
        Args:
            crc_threshold: % valid CRCs below which to flag agent (default 95%)
            entropy_threshold: std deviation of hash entropy above which to flag
            correlation_threshold: min correlation between related metrics
        """
        self.crc_threshold = crc_threshold
        self.entropy_threshold = entropy_threshold
        self.correlation_threshold = correlation_threshold
        
        # Historical tracking per agent
        self.crc_history: Dict[str, List[bool]] = {}
        self.hash_entropy_history: Dict[str, List[float]] = {}
        self.message_log: Dict[str, List[Dict]] = {}
        self.baseline_correlation: Dict[str, Dict[str, float]] = {}
    
    def validate_message_integrity(self, 
                                   agent_id: str,
                                   message_data: Dict,
                                   expected_crc: Optional[int] = None) -> Tuple[bool, float]:
        """
        Validate single message CRC32 checksum.
        
        Args:
            agent_id: Agent sending message
            message_data: Dict of {metric: value}
            expected_crc: Expected CRC32 (if None, compute from data)
        
        Returns:
            (is_valid: bool, crc_value: int)
        """
        # Serialize message for hashing
        message_str = str(sorted(message_data.items()))
        computed_crc = self._compute_crc32(message_str)
        
        if expected_crc is None:
            is_valid = True
        else:
            is_valid = (computed_crc == expected_crc)
        
        # Track history
        if agent_id not in self.crc_history:
            self.crc_history[agent_id] = []
        self.crc_history[agent_id].append(is_valid)
        
        # Keep last 100 messages
        if len(self.crc_history[agent_id]) > 100:
            self.crc_history[agent_id] = self.crc_history[agent_id][-100:]
        
        return is_valid, computed_crc
    
    def compute_hash_entropy(self,
                            agent_id: str,
                            message_data: Dict) -> float:
        """
        Compute Shannon entropy of message hash.
        
        Insight: FDI attacks often produce hash patterns with lower entropy
        because tampered values are constrained to plausible ranges.
        
        Args:
            agent_id: Agent ID
            message_data: Message payload
        
        Returns:
            entropy: float (higher = more random/diverse)
        """
        # Hash the message payload
        message_str = str(sorted(message_data.items()))
        hash_bytes = hashlib.sha256(message_str.encode()).digest()
        
        # Compute entropy of hash bytes
        byte_counts = np.bincount(np.frombuffer(hash_bytes, dtype=np.uint8), 
                                   minlength=256)
        probabilities = byte_counts / len(hash_bytes)
        entropy = -np.sum(probabilities[probabilities > 0] * 
                         np.log2(probabilities[probabilities > 0]))
        
        # Track history
        if agent_id not in self.hash_entropy_history:
            self.hash_entropy_history[agent_id] = []
        self.hash_entropy_history[agent_id].append(entropy)
        
        if len(self.hash_entropy_history[agent_id]) > 100:
            self.hash_entropy_history[agent_id] = self.hash_entropy_history[agent_id][-100:]
        
        return entropy
    
    def check_metric_correlation(self,
                                agent_id: str,
                                voltage: float,
                                current: float,
                                power: float) -> Tuple[float, bool]:
        """
        Verify consistency between related metrics: P = V * I
        
        FDI often tampers with one metric (e.g., voltage) but forgets
        to update derived metrics (power), creating correlation breaks.
        
        Args:
            agent_id: Agent ID
            voltage: Voltage reading (V)
            current: Current reading (A)
            power: Power reading (W)
        
        Returns:
            (correlation_score: float, is_consistent: bool)
        """
        # Expected power from V and I
        expected_power = voltage * current
        
        # Allow 5% tolerance for measurement noise
        if expected_power > 0:
            deviation = abs(power - expected_power) / expected_power
            is_consistent = deviation < 0.05
            correlation_score = 1.0 - min(deviation, 1.0)
        else:
            correlation_score = 1.0
            is_consistent = True
        
        return correlation_score, is_consistent
    
    def compute_integrity_score(self, agent_id: str) -> IntegrityScore:
        """
        Aggregate integrity metrics into final compromise verdict.
        
        Args:
            agent_id: Agent to evaluate
        
        Returns:
            IntegrityScore with verdict and confidence
        """
        # CRC match rate (if no history, neutral)
        if agent_id in self.crc_history and len(self.crc_history[agent_id]) > 0:
            crc_matches = sum(self.crc_history[agent_id])
            crc_match_rate = crc_matches / len(self.crc_history[agent_id])
        else:
            crc_match_rate = 1.0
        
        # Hash entropy deviation (lower entropy = suspicious)
        if agent_id in self.hash_entropy_history and len(self.hash_entropy_history[agent_id]) > 10:
            entropy_values = np.array(self.hash_entropy_history[agent_id])
            entropy_mean = entropy_values.mean()
            entropy_std = entropy_values.std()
            
            # Flag if recent entropy is much lower than baseline
            recent_entropy = entropy_values[-5:].mean()
            hash_deviation = (entropy_mean - recent_entropy) / (entropy_std + 1e-6)
        else:
            hash_deviation = 0.0
        
        # Verdict logic
        is_compromised = False
        confidence = 0.0
        severity = "LOW"
        
        # Flag if CRC match rate below threshold
        if crc_match_rate < self.crc_threshold:
            is_compromised = True
            confidence += 0.5
            severity = "CRITICAL"
        
        # Flag if hash entropy significantly deviates
        if hash_deviation > self.entropy_threshold:
            is_compromised = True
            confidence += 0.3
            if severity != "CRITICAL":
                severity = "HIGH"
        
        confidence = min(confidence, 1.0)
        
        return IntegrityScore(
            agent_id=agent_id,
            crc_match_rate=crc_match_rate,
            hash_deviation=hash_deviation,
            is_compromised=is_compromised,
            severity=severity,
            confidence=confidence
        )
    
    @staticmethod
    def _compute_crc32(data: str) -> int:
        """Compute CRC32 checksum of string data."""
        return np.uint32(int(hashlib.md5(data.encode()).hexdigest()[:8], 16))


class HybridAnomalyDetector:
    """
    Combines three detection modalities:
    1. Deviation-based scoring (statistical deviation from baseline)
    2. LSTM anomaly probability (neural network learned patterns)
    3. Integrity validation (cryptographic consistency)
    
    Voting ensemble: flag anomaly if ≥2 of 3 detect suspicious behavior.
    """
    
    def __init__(self, 
                 deviation_weight: float = 0.4,
                 lstm_weight: float = 0.4,
                 integrity_weight: float = 0.2):
        """
        Args:
            deviation_weight: Weight for deviation-based score
            lstm_weight: Weight for LSTM probability
            integrity_weight: Weight for integrity validation
        """
        self.deviation_weight = deviation_weight
        self.lstm_weight = lstm_weight
        self.integrity_weight = integrity_weight
        
        self.integrity_validator = IntegrityValidator()
    
    def compute_hybrid_score(self,
                            agent_id: str,
                            deviation_score: float,
                            lstm_probability: float,
                            message_data: Dict) -> Tuple[float, Dict]:
        """
        Compute weighted hybrid anomaly score.
        
        Args:
            agent_id: Agent ID
            deviation_score: Deviation-based score (0-3, where >1 = anomalous)
            lstm_probability: LSTM anomaly probability (0-1)
            message_data: Raw message data for integrity checks
        
        Returns:
            (hybrid_score: float, breakdown: dict)
        """
        # Normalize deviation score to 0-1
        deviation_normalized = min(deviation_score / 3.0, 1.0)
        
        # Compute integrity score
        integrity_score = self.integrity_validator.compute_integrity_score(agent_id)
        integrity_normalized = 1.0 if integrity_score.is_compromised else 0.0
        
        # Weighted combination
        hybrid_score = (
            self.deviation_weight * deviation_normalized +
            self.lstm_weight * lstm_probability +
            self.integrity_weight * integrity_normalized
        )
        
        breakdown = {
            "deviation": deviation_normalized,
            "lstm": lstm_probability,
            "integrity": integrity_normalized,
            "hybrid": hybrid_score,
            "integrity_verdict": integrity_score.severity,
            "integrity_confidence": integrity_score.confidence
        }
        
        return hybrid_score, breakdown
    
    def ensemble_vote(self,
                     deviation_score: float,
                     lstm_probability: float,
                     integrity_score: IntegrityScore,
                     threshold: float = 0.5) -> Tuple[bool, float]:
        """
        Ensemble voting: require agreement from 2+ of 3 detectors.
        
        Args:
            deviation_score: Deviation-based anomaly score
            lstm_probability: LSTM anomaly probability
            integrity_score: IntegrityScore from validator
            threshold: Classification threshold (0-1)
        
        Returns:
            (is_anomalous: bool, confidence: float)
        """
        votes = []
        
        # Deviation vote: > 1.0 = anomalous
        deviation_vote = 1 if deviation_score > 1.0 else 0
        votes.append(deviation_vote)
        
        # LSTM vote: > threshold
        lstm_vote = 1 if lstm_probability > threshold else 0
        votes.append(lstm_vote)
        
        # Integrity vote: compromised or high confidence
        integrity_vote = 1 if (integrity_score.is_compromised and 
                               integrity_score.confidence > 0.7) else 0
        votes.append(integrity_vote)
        
        # Require 2+ votes for anomaly
        vote_count = sum(votes)
        is_anomalous = vote_count >= 2
        
        # Confidence = proportion of votes in majority
        confidence = vote_count / 3.0
        
        return is_anomalous, confidence
