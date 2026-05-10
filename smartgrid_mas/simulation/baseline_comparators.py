"""
Baseline detection methods for comparative evaluation.

Implements four alternative anomaly detectors that process the same
(x_phys, y_cyber) feature vectors as the full pipeline, allowing
apples-to-apples comparison on identical simulation data.

Methods:
  1. DeviationOnlyDetector  — pure deviation scoring (base paper approach)
  2. LSTMOnlyDetector       — LSTM probability threshold only
  3. IsolationForestDetector — sklearn unsupervised anomaly detection
  4. OneClassSVMDetector     — sklearn one-class SVM
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.svm import OneClassSVM
    from sklearn.preprocessing import StandardScaler

    _SKLEARN = True
except ImportError:
    _SKLEARN = False


@dataclass
class DetectionResult:
    flag: int  # 0 or 1
    score: float  # continuous anomaly score
    label: str  # attack type label (or NONE)


class DeviationOnlyDetector:
    """Replicates the base paper's deviation-scoring approach (Eq. 9).

    S_i(t) = w_i * (d_x + d_y)
    Flag if S_i > threshold.
    No LSTM, no behavioral signatures, no multi-layer.
    """

    def __init__(self, threshold: float = 4.40):
        self.threshold = threshold

    def detect(
        self,
        x_phys: np.ndarray,
        y_cyber: np.ndarray,
        bx: np.ndarray,
        by: np.ndarray,
        thx: np.ndarray,
        thy: np.ndarray,
        weight: float = 1.0,
    ) -> DetectionResult:
        dx = np.sqrt(np.mean(((x_phys - bx) / np.maximum(thx, 1e-6)) ** 2))
        dy = np.sqrt(np.mean(((y_cyber - by) / np.maximum(thy, 1e-6)) ** 2))
        score = float(weight * (dx + dy))
        flag = 1 if score > self.threshold else 0
        return DetectionResult(flag=flag, score=score, label="ANOMALY" if flag else "NONE")


class LSTMOnlyDetector:
    """Uses only the LSTM anomaly probability with a fixed threshold.

    No deviation scoring, no behavioral signatures, no multi-layer.
    """

    def __init__(self, prob_threshold: float = 0.80):
        self.prob_threshold = prob_threshold

    def detect(self, anomaly_prob: float) -> DetectionResult:
        flag = 1 if anomaly_prob >= self.prob_threshold else 0
        return DetectionResult(
            flag=flag, score=anomaly_prob, label="ANOMALY" if flag else "NONE"
        )


class IsolationForestDetector:
    """Sklearn Isolation Forest — unsupervised anomaly detection.

    Trains on the first `warmup` clean timesteps, then predicts on all
    subsequent data. Standard ML baseline for anomaly detection.
    """

    def __init__(
        self,
        contamination: float = 0.05,
        warmup: int = 50,
        n_estimators: int = 100,
        random_state: int = 42,
    ):
        if not _SKLEARN:
            raise ImportError("sklearn required for IsolationForestDetector")
        self.contamination = contamination
        self.warmup = warmup
        self.n_estimators = n_estimators
        self.random_state = random_state
        self.scaler = StandardScaler()
        self.model: Optional[IsolationForest] = None
        self._training_buffer: List[np.ndarray] = []
        self._fitted = False

    def _features(self, x_phys: np.ndarray, y_cyber: np.ndarray) -> np.ndarray:
        return np.concatenate([x_phys.ravel(), y_cyber.ravel()])

    def observe_and_detect(
        self,
        x_phys: np.ndarray,
        y_cyber: np.ndarray,
        is_warmup: bool = False,
    ) -> DetectionResult:
        feat = self._features(x_phys, y_cyber)

        if not self._fitted:
            self._training_buffer.append(feat)
            if len(self._training_buffer) >= self.warmup or not is_warmup:
                if len(self._training_buffer) >= 10:
                    X = np.stack(self._training_buffer)
                    self.scaler.fit(X)
                    X_scaled = self.scaler.transform(X)
                    self.model = IsolationForest(
                        contamination=self.contamination,
                        n_estimators=self.n_estimators,
                        random_state=self.random_state,
                    )
                    self.model.fit(X_scaled)
                    self._fitted = True
            return DetectionResult(flag=0, score=0.0, label="NONE")

        feat_scaled = self.scaler.transform(feat.reshape(1, -1))
        pred = self.model.predict(feat_scaled)[0]
        score = -float(self.model.score_samples(feat_scaled)[0])
        flag = 1 if pred == -1 else 0
        return DetectionResult(flag=flag, score=score, label="ANOMALY" if flag else "NONE")


class OneClassSVMDetector:
    """Sklearn One-Class SVM — novelty detection baseline.

    Trains on warmup period of clean data, then flags novel observations.
    """

    def __init__(
        self,
        kernel: str = "rbf",
        nu: float = 0.05,
        warmup: int = 50,
        random_state: int = 42,
    ):
        if not _SKLEARN:
            raise ImportError("sklearn required for OneClassSVMDetector")
        self.kernel = kernel
        self.nu = nu
        self.warmup = warmup
        self.scaler = StandardScaler()
        self.model: Optional[OneClassSVM] = None
        self._training_buffer: List[np.ndarray] = []
        self._fitted = False

    def _features(self, x_phys: np.ndarray, y_cyber: np.ndarray) -> np.ndarray:
        return np.concatenate([x_phys.ravel(), y_cyber.ravel()])

    def observe_and_detect(
        self,
        x_phys: np.ndarray,
        y_cyber: np.ndarray,
        is_warmup: bool = False,
    ) -> DetectionResult:
        feat = self._features(x_phys, y_cyber)

        if not self._fitted:
            self._training_buffer.append(feat)
            if len(self._training_buffer) >= self.warmup or not is_warmup:
                if len(self._training_buffer) >= 10:
                    X = np.stack(self._training_buffer)
                    self.scaler.fit(X)
                    X_scaled = self.scaler.transform(X)
                    self.model = OneClassSVM(kernel=self.kernel, nu=self.nu)
                    self.model.fit(X_scaled)
                    self._fitted = True
            return DetectionResult(flag=0, score=0.0, label="NONE")

        feat_scaled = self.scaler.transform(feat.reshape(1, -1))
        pred = self.model.predict(feat_scaled)[0]
        score = -float(self.model.decision_function(feat_scaled)[0])
        flag = 1 if pred == -1 else 0
        return DetectionResult(flag=flag, score=score, label="ANOMALY" if flag else "NONE")


@dataclass
class ComparisonResult:
    """Aggregated metrics for one detection method over a full simulation."""

    method_name: str
    y_true: List[int] = field(default_factory=list)
    y_pred: List[int] = field(default_factory=list)
    scores: List[float] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.y_true)

    @property
    def tp(self) -> int:
        return sum(1 for t, p in zip(self.y_true, self.y_pred) if t == 1 and p == 1)

    @property
    def fp(self) -> int:
        return sum(1 for t, p in zip(self.y_true, self.y_pred) if t == 0 and p == 1)

    @property
    def fn(self) -> int:
        return sum(1 for t, p in zip(self.y_true, self.y_pred) if t == 1 and p == 0)

    @property
    def tn(self) -> int:
        return sum(1 for t, p in zip(self.y_true, self.y_pred) if t == 0 and p == 0)

    @property
    def accuracy(self) -> float:
        return (self.tp + self.tn) / max(1, self.total)

    @property
    def fpr(self) -> float:
        neg = self.fp + self.tn
        return self.fp / max(1, neg)

    @property
    def recall(self) -> float:
        pos = self.tp + self.fn
        return self.tp / max(1, pos)

    @property
    def precision(self) -> float:
        pred_pos = self.tp + self.fp
        return self.tp / max(1, pred_pos)

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / max(1e-9, p + r)

    @property
    def fnr(self) -> float:
        return 1.0 - self.recall

    def summary(self) -> Dict[str, float]:
        return {
            "method": self.method_name,
            "accuracy": round(self.accuracy * 100, 2),
            "fpr": round(self.fpr * 100, 2),
            "recall": round(self.recall * 100, 2),
            "precision": round(self.precision * 100, 2),
            "f1": round(self.f1 * 100, 2),
            "fnr": round(self.fnr * 100, 2),
            "tp": self.tp,
            "fp": self.fp,
            "fn": self.fn,
            "tn": self.tn,
        }
