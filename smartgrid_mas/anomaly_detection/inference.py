from __future__ import annotations
import numpy as np
import torch

from smartgrid_mas.anomaly_detection.lstm_model import LSTMAnomalyDetector
from smartgrid_mas.anomaly_detection.train_lstm import _IN_MEMORY_CHECKPOINTS
from typing import List

def concat_xy_window(X: np.ndarray, Y: np.ndarray) -> np.ndarray:
    """
    Concatenate physical and cyber feature windows.
    
    Args:
        X: Physical metrics window (W, dx)
        Y: Cyber metrics window (W, dy)
    
    Returns:
        Concatenated window (W, dx+dy)
    """
    X = np.asarray(X, dtype=np.float32)
    Y = np.asarray(Y, dtype=np.float32)
    if X.shape[0] != Y.shape[0]:
        raise ValueError(f"X and Y must have same window length: {X.shape[0]} vs {Y.shape[0]}")
    return np.concatenate([X, Y], axis=1)

class LSTMInferencer:
    """
    Inference wrapper for trained LSTM anomaly detector.
    
    Loads model weights and provides predict_proba() for single samples.
    Automatically reads checkpoint metadata (input_size, hidden_size, num_layers, dropout, window)
    when available. Falls back to caller-provided values for legacy checkpoints.
    """
    
    def __init__(
        self,
        model_path: str,
        input_size: int | None = None,
        hidden_size: int | None = None,
        num_layers: int | None = None,
        dropout: float | None = None,
        device: str | None = None,
    ):
        """
        Initialize inferencer.
        
        Args:
            model_path: Path to saved model checkpoint (metadata-aware)
            input_size: Number of features (required for legacy checkpoints without metadata)
            hidden_size: Hidden size override (optional)
            num_layers: Layer count override (optional)
            dropout: Dropout override (optional)
            device: Device ('cpu', 'cuda', or None for auto)
        """
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device

        if model_path in _IN_MEMORY_CHECKPOINTS:
            ckpt = _IN_MEMORY_CHECKPOINTS[model_path]
        else:
            ckpt = torch.load(model_path, map_location=self.device)

        # New-format checkpoint with metadata
        if isinstance(ckpt, dict) and "state_dict" in ckpt:
            meta = ckpt
            ckpt_input = meta.get("input_size")
            ckpt_hidden = meta.get("hidden_size")
            ckpt_layers = meta.get("num_layers")
            ckpt_dropout = meta.get("dropout")
            self.window = meta.get("window")
            self.calibration_temperature = float(meta.get("calibration_temperature", 1.0) or 1.0)
            self.calibration_threshold = float(meta.get("calibration_threshold", 0.5) or 0.5)
            state_dict = meta["state_dict"]
        else:
            # Legacy checkpoint: only state_dict present
            meta = None
            ckpt_input = None
            ckpt_hidden = None
            ckpt_layers = None
            ckpt_dropout = None
            self.window = None
            self.calibration_temperature = 1.0
            self.calibration_threshold = 0.5
            state_dict = ckpt

        resolved_input = ckpt_input if ckpt_input is not None else input_size
        if resolved_input is None:
            raise ValueError("input_size must be provided when checkpoint lacks metadata")

        resolved_hidden = ckpt_hidden if ckpt_hidden is not None else (hidden_size if hidden_size is not None else 64)
        resolved_layers = ckpt_layers if ckpt_layers is not None else (num_layers if num_layers is not None else 2)
        resolved_dropout = ckpt_dropout if ckpt_dropout is not None else (dropout if dropout is not None else 0.2)

        # Validate user-specified overrides against metadata
        if input_size is not None and ckpt_input is not None and int(input_size) != int(ckpt_input):
            raise ValueError(f"Checkpoint input_size={ckpt_input} mismatch with requested input_size={input_size}")
        if hidden_size is not None and ckpt_hidden is not None and int(hidden_size) != int(ckpt_hidden):
            raise ValueError(f"Checkpoint hidden_size={ckpt_hidden} mismatch with requested hidden_size={hidden_size}")
        if num_layers is not None and ckpt_layers is not None and int(num_layers) != int(ckpt_layers):
            raise ValueError(f"Checkpoint num_layers={ckpt_layers} mismatch with requested num_layers={num_layers}")
        if dropout is not None and ckpt_dropout is not None and float(dropout) != float(ckpt_dropout):
            raise ValueError(f"Checkpoint dropout={ckpt_dropout} mismatch with requested dropout={dropout}")

        self.input_size = int(resolved_input)

        self.model = LSTMAnomalyDetector(
            input_size=self.input_size,
            hidden_size=int(resolved_hidden),
            num_layers=int(resolved_layers),
            dropout=float(resolved_dropout),
        ).to(self.device)
        
        self.model.load_state_dict(state_dict)
        self.model.eval()

    @torch.no_grad()
    def predict_proba(self, window_feat: np.ndarray) -> float:
        """
        Predict anomaly probability for a single window.
        
        Args:
            window_feat: Feature window (W, F) with W timesteps, F features
        
        Returns:
            Anomaly probability in [0, 1]
        """
        arr = np.asarray(window_feat, dtype=np.float32)
        if arr.ndim != 2:
            raise ValueError(f"window_feat must be 2D (W, F), got shape {arr.shape}")
        if arr.shape[1] != self.input_size:
            raise ValueError(f"Feature dimension mismatch: window_feat has {arr.shape[1]} features but model expects {self.input_size}. Retrain or regenerate checkpoint with correct dims.")
        x = torch.from_numpy(arr)
        x = x.unsqueeze(0).to(self.device)  # (1, W, F)
        logits, probs = self.model(x)
        logit = logits / max(self.calibration_temperature, 1e-6)
        cal_prob = torch.sigmoid(logit)
        return float(cal_prob[0].item())

    @torch.no_grad()
    def predict_proba_batch(self, window_feats: List[np.ndarray]) -> List[float]:
        """
        Predict anomaly probabilities for a batch of windows.

        Args:
            window_feats: List of feature windows (each (W, F))

        Returns:
            List of anomaly probabilities in [0, 1]
        """
        if not window_feats:
            return []
        arrs = [np.asarray(w, dtype=np.float32) for w in window_feats]
        W = arrs[0].shape[0]
        F = arrs[0].shape[1]
        for arr in arrs:
            if arr.ndim != 2:
                raise ValueError(f"Each window must be 2D (W, F), got shape {arr.shape}")
            if arr.shape[1] != self.input_size:
                raise ValueError(
                    f"Feature dimension mismatch: window has {arr.shape[1]} features but model expects {self.input_size}."
                )
            if arr.shape[0] != W:
                raise ValueError("All windows in batch must share same length W")
        x = torch.from_numpy(np.stack(arrs, axis=0))  # (B, W, F)
        x = x.to(self.device)
        logits, probs = self.model(x)
        cal_logits = logits / max(self.calibration_temperature, 1e-6)
        cal_probs = torch.sigmoid(cal_logits)
        return [float(p.item()) for p in cal_probs]
