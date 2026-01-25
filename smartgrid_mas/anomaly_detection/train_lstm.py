from __future__ import annotations
from dataclasses import dataclass
import numpy as np
import torch
from torch.utils.data import DataLoader, random_split
import torch.nn as nn
import torch.optim as optim

from smartgrid_mas.anomaly_detection.lstm_model import LSTMAnomalyDetector
from smartgrid_mas.anomaly_detection.dataset import SlidingWindowDataset

@dataclass
class TrainResult:
    """Result from LSTM training."""
    model_path: str
    train_loss: float
    val_loss: float

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
    train_loader = DataLoader(
        train_ds, batch_size=batch_size, shuffle=True, drop_last=False
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

    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    def run_epoch(loader, train: bool):
        model.train(train)
        total_loss = 0.0
        count = 0
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
        return total_loss / max(count, 1)

    last_train = 0.0
    last_val = 0.0
    for ep in range(1, epochs + 1):
        last_train = run_epoch(train_loader, train=True)
        last_val = run_epoch(val_loader, train=False)
        if verbose:
            print(f"[LSTM] epoch {ep}/{epochs} train_loss={last_train:.5f} val_loss={last_val:.5f}")

    # Save model with metadata for robust loading
    metadata = {
        "state_dict": model.state_dict(),
        "input_size": input_size,
        "hidden_size": hidden_size,
        "num_layers": num_layers,
        "dropout": dropout,
        "window": window,
    }
    torch.save(metadata, model_path)
    if verbose:
        print(f"[LSTM] Model saved to {model_path}")

    return TrainResult(model_path=model_path, train_loss=last_train, val_loss=last_val)
