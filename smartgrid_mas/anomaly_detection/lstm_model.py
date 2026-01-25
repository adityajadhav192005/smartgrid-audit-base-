from __future__ import annotations
import torch
import torch.nn as nn

class LSTMAnomalyDetector(nn.Module):
    """
    PyTorch LSTM-based binary classifier for anomaly detection.
    
    Takes multivariate time series and predicts anomaly probability.
    Architecture:
    - LSTM layers (configurable depth, dropout)
    - Last hidden state
    - Fully connected layer to logit
    - Sigmoid to probability
    """
    def __init__(
        self,
        input_size: int,
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x: torch.Tensor):
        """
        Forward pass.
        
        Args:
            x: Tensor of shape (batch, seq_len, input_size)
        
        Returns:
            logits: Tensor of shape (batch,)
            probs: Tensor of shape (batch,) in [0, 1]
        """
        out, (hn, cn) = self.lstm(x)  # out: (batch, seq_len, hidden_size)
        last = out[:, -1, :]  # take last timestep: (batch, hidden_size)
        logits = self.fc(last).squeeze(-1)  # (batch,)
        probs = torch.sigmoid(logits)  # (batch,)
        return logits, probs
