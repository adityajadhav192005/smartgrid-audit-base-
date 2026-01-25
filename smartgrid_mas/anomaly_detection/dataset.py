from __future__ import annotations
import numpy as np
import torch
from torch.utils.data import Dataset

class SlidingWindowDataset(Dataset):
    """
    PyTorch Dataset for sliding window time series classification.
    
    Given a sequence of multivariate observations and binary labels,
    produces sliding windows of size W.
    
    For each index i >= W-1:
    - Input X[i] = data[i-W+1:i+1] (shape: W, features)
    - Label y[i] = labels[i]
    """
    
    def __init__(self, data: np.ndarray, labels: np.ndarray, window: int):
        """
        Args:
            data: Array of shape (N, features) with observations
            labels: Array of shape (N,) with 0/1 labels
            window: Window size (must be >= 2)
        """
        self.data = np.asarray(data, dtype=np.float32)
        self.labels = np.asarray(labels, dtype=np.float32).reshape(-1)
        self.window = int(window)

        if self.data.ndim != 2:
            raise ValueError(f"data must be 2D (N, features), got shape {self.data.shape}")
        if self.labels.shape[0] != self.data.shape[0]:
            raise ValueError(f"labels length {self.labels.shape[0]} must match data length {self.data.shape[0]}")
        if self.window < 2:
            raise ValueError(f"window must be >= 2, got {self.window}")

        # Valid samples start from index W-1
        self.start = self.window - 1
        self.length = self.data.shape[0] - self.start
        if self.length <= 0:
            raise ValueError(f"Not enough timesteps ({self.data.shape[0]}) for window size {self.window}")

    def __len__(self):
        return self.length

    def __getitem__(self, idx: int):
        """
        Get a single sample.
        
        Args:
            idx: Index in [0, length)
        
        Returns:
            x: Tensor of shape (window, features)
            y: Tensor scalar (0 or 1)
        """
        i = idx + self.start  # map to data index
        x = self.data[i - self.window + 1 : i + 1]  # (window, features)
        y = self.labels[i]
        return torch.from_numpy(x), torch.tensor(y, dtype=torch.float32)
