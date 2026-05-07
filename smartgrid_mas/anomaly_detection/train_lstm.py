from __future__ import annotations
from dataclasses import dataclass
import numpy as np
import torch
from torch.utils.data import DataLoader, random_split, WeightedRandomSampler
import torch.nn as nn
import torch.optim as optim
import os

from smartgrid_mas.anomaly_detection.lstm_model import LSTMAnomalyDetector
from smartgrid_mas.anomaly_detection.dataset import SlidingWindowDataset

_IN_MEMORY_CHECKPOINTS: dict[str, dict] = {}

@dataclass
class TrainResult:
    """Result from LSTM training."""
    model_path: str
    train_loss: float
    val_loss: float
    calibration_temperature: float = 1.0
    calibration_threshold: float = 0.5


def _sigmoid_np(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=np.float32)
    return 1.0 / (1.0 + np.exp(-np.clip(x, -40.0, 40.0)))


def _focal_bce_with_logits(
    logits: torch.Tensor,
    targets: torch.Tensor,
    pos_weight: torch.Tensor | None = None,
    gamma: float = 2.0,
    alpha: float = 0.5,
) -> torch.Tensor:
    bce = nn.functional.binary_cross_entropy_with_logits(
        logits,
        targets,
        pos_weight=pos_weight,
        reduction="none",
    )
    probs = torch.sigmoid(logits)
    pt = torch.where(targets > 0.5, probs, 1.0 - probs)
    alpha_t = torch.where(targets > 0.5, torch.full_like(targets, alpha), torch.full_like(targets, 1.0 - alpha))
    modulating = torch.pow(torch.clamp(1.0 - pt, min=1e-6), gamma)
    return (alpha_t * modulating * bce).mean()


def _fit_calibration(logits: np.ndarray, labels: np.ndarray) -> tuple[float, float]:
    if logits.size == 0 or labels.size == 0:
        return 1.0, 0.5

    temp_grid_raw = os.environ.get("SMARTGRID_CALIBRATION_TEMPS", "0.8,1.0,1.2,1.5,1.8,2.2")
    threshold_grid_raw = os.environ.get("SMARTGRID_CALIBRATION_THRESHOLDS", "0.40,0.45,0.50,0.55,0.60,0.65")
    try:
        temp_grid = [float(x.strip()) for x in temp_grid_raw.split(",") if x.strip()]
    except Exception:
        temp_grid = [0.8, 1.0, 1.2, 1.5, 1.8, 2.2]
    try:
        threshold_grid = [float(x.strip()) for x in threshold_grid_raw.split(",") if x.strip()]
    except Exception:
        threshold_grid = [0.40, 0.45, 0.50, 0.55, 0.60, 0.65]

    best = (1.0, 0.5)
    best_score = (-1.0, -1.0, 1.0)  # f1, precision, brier (maximize first two, minimize third)

    for temp in temp_grid:
        cal_probs = _sigmoid_np(logits / max(temp, 1e-6))
        brier = float(np.mean((cal_probs - labels) ** 2))
        for threshold in threshold_grid:
            preds = (cal_probs >= threshold).astype(np.float32)
            tp = float(np.sum((labels == 1.0) & (preds == 1.0)))
            fp = float(np.sum((labels == 0.0) & (preds == 1.0)))
            fn = float(np.sum((labels == 1.0) & (preds == 0.0)))
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = (2.0 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
            score = (f1, precision, -brier)
            if score > best_score:
                best_score = score
                best = (float(temp), float(threshold))

    return best

def train_lstm(
    data: np.ndarray,
    labels: np.ndarray,
    window: int,
    model_path: str,
    hidden_size: int = 64,
    num_layers: int = 2,
    dropout: float = 0.2,
    batch_size: int = 64,
    epochs: int = 20,
    lr: float = 1e-3,
    seed: int = 42,
    device: str | None = None,
    verbose: bool = True,
) -> TrainResult:
    """
    Train LSTM anomaly detector on sliding window data.
    
    Paper reference: 80/20 train/val split, supervised binary classification.
    
    Args:
        data: Array of shape (N, features)
        labels: Array of shape (N,) with 0/1 labels
        window: Sliding window size
        model_path: Path to save trained model
        hidden_size: LSTM hidden dimension (default 64)
        num_layers: LSTM layers (default 2)
        dropout: Dropout rate (default 0.2)
        batch_size: Training batch size (default 64)
        epochs: Number of training epochs (default 20)
        lr: Learning rate (default 1e-3)
        seed: Random seed (default 42)
        device: Device ('cpu', 'cuda', or None for auto)
        verbose: Print loss per epoch (default True)
    
    Returns:
        TrainResult with final train/val losses and model path
    """
    torch.manual_seed(seed)
    np.random.seed(seed)

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    # Build dataset and split 80/20
    ds = SlidingWindowDataset(data, labels, window=window)
    n_total = len(ds)
    n_train = int(0.8 * n_total)  # paper: 80/20
    n_val = n_total - n_train

    train_ds, val_ds = random_split(
        ds, [n_train, n_val], generator=torch.Generator().manual_seed(seed)
    )

    # Imbalance controls: oversample attacks + cost-sensitive BCE
    use_oversample = os.environ.get("SMARTGRID_OVERSAMPLE_ATTACKS", "1").strip().lower() in {"1", "true", "yes", "on"}
    use_cost_sensitive = os.environ.get("SMARTGRID_COST_SENSITIVE_LOSS", "1").strip().lower() in {"1", "true", "yes", "on"}
    oversample_scale = float(os.environ.get("SMARTGRID_OVERSAMPLE_POS_MULT", "1.35"))
    pos_weight_scale = float(os.environ.get("SMARTGRID_POS_WEIGHT_SCALE", "1.40"))
    min_pos_weight = float(os.environ.get("SMARTGRID_MIN_POS_WEIGHT", "1.0"))

    train_indices = list(train_ds.indices)
    train_labels = np.asarray([ds.labels[idx + ds.start] for idx in train_indices], dtype=np.float32)
    pos_count = float(np.sum(train_labels > 0.5))
    neg_count = float(len(train_labels) - pos_count)

    sampler = None
    if use_oversample and pos_count > 0 and neg_count > 0:
        w_pos = max(min_pos_weight, (neg_count / max(pos_count, 1.0)) * oversample_scale)
        sample_weights = np.where(train_labels > 0.5, w_pos, 1.0).astype(np.float64)
        sampler = WeightedRandomSampler(weights=torch.from_numpy(sample_weights), num_samples=len(sample_weights), replacement=True)

    train_loader = DataLoader(
        train_ds,
        batch_size=batch_size,
        shuffle=(sampler is None),
        sampler=sampler,
        drop_last=False,
    )
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, drop_last=False)

    # Initialize model
    input_size = data.shape[1]
    model = LSTMAnomalyDetector(
        input_size=input_size,
        hidden_size=hidden_size,
        num_layers=num_layers,
        dropout=dropout,
    ).to(device)

    use_focal = os.environ.get("SMARTGRID_USE_FOCAL_LOSS", "1").strip().lower() in {"1", "true", "yes", "on"}
    focal_gamma = float(os.environ.get("SMARTGRID_FOCAL_GAMMA", "2.0"))
    focal_alpha = float(os.environ.get("SMARTGRID_FOCAL_ALPHA", "0.65"))
    pos_weight = None
    if use_cost_sensitive and pos_count > 0:
        pos_weight_value = max(min_pos_weight, (neg_count / max(pos_count, 1.0)) * pos_weight_scale)
        pos_weight = torch.tensor([pos_weight_value], dtype=torch.float32, device=device)

    def criterion(logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        if use_focal:
            return _focal_bce_with_logits(
                logits,
                targets,
                pos_weight=pos_weight,
                gamma=focal_gamma,
                alpha=focal_alpha,
            )
        return nn.functional.binary_cross_entropy_with_logits(logits, targets, pos_weight=pos_weight)

    optimizer = optim.Adam(model.parameters(), lr=lr)

    def run_epoch(loader, train: bool, collect_outputs: bool = False):
        model.train(train)
        total_loss = 0.0
        count = 0
        all_logits = []
        all_targets = []
        with torch.set_grad_enabled(train):
            for xb, yb in loader:
                xb = xb.to(device)
                yb = yb.to(device)

                logits, probs = model(xb)
                loss = criterion(logits, yb)

                if train:
                    optimizer.zero_grad()
                    loss.backward()
                    optimizer.step()

                total_loss += float(loss.item()) * xb.size(0)
                count += xb.size(0)
                if collect_outputs:
                    all_logits.append(logits.detach().cpu().numpy())
                    all_targets.append(yb.detach().cpu().numpy())
        avg_loss = total_loss / max(count, 1)
        if collect_outputs:
            logits_np = np.concatenate(all_logits, axis=0) if all_logits else np.asarray([], dtype=np.float32)
            targets_np = np.concatenate(all_targets, axis=0) if all_targets else np.asarray([], dtype=np.float32)
            return avg_loss, logits_np, targets_np
        return avg_loss

    last_train = 0.0
    last_val = 0.0
    for ep in range(1, epochs + 1):
        last_train = run_epoch(train_loader, train=True)
        last_val = run_epoch(val_loader, train=False)
        if verbose:
            print(f"[LSTM] epoch {ep}/{epochs} train_loss={last_train:.5f} val_loss={last_val:.5f}")

    _, val_logits, val_targets = run_epoch(val_loader, train=False, collect_outputs=True)
    calibration_temperature, calibration_threshold = _fit_calibration(val_logits, val_targets)

    # Save model with metadata for robust loading
    metadata = {
        "state_dict": model.state_dict(),
        "input_size": input_size,
        "hidden_size": hidden_size,
        "num_layers": num_layers,
        "dropout": dropout,
        "window": window,
        "training_pipeline_version": 2,
        "calibration_temperature": calibration_temperature,
        "calibration_threshold": calibration_threshold,
    }
    target_dir = os.path.dirname(model_path)
    if target_dir:
        os.makedirs(target_dir, exist_ok=True)
    saved_to_disk = False
    try:
        with open(model_path, "wb") as fh:
            torch.save(metadata, fh)
        saved_to_disk = True
    except PermissionError:
        _IN_MEMORY_CHECKPOINTS[model_path] = metadata

    if verbose:
        if saved_to_disk:
            print(f"[LSTM] Model saved to {model_path}")
        else:
            print(f"[LSTM] Model cached in memory for {model_path}")

    return TrainResult(
        model_path=model_path,
        train_loss=last_train,
        val_loss=last_val,
        calibration_temperature=calibration_temperature,
        calibration_threshold=calibration_threshold,
    )
