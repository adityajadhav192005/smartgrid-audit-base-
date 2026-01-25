"""
LSTM Offline Pre-training Module
=================================
Generates augmented synthetic dataset and pre-trains LSTM anomaly detector
before online deployment. Significantly improves convergence speed and accuracy.
"""

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from typing import Tuple, List, Optional
import logging

logger = logging.getLogger(__name__)


class AugmentedDatasetGenerator:
    """
    Generates synthetic smart grid time-series data with labeled anomalies.
    
    Scenarios:
    - Normal operation: Baseline metrics with Gaussian noise
    - FDI attack: Voltage/current tampered by 20-45%
    - DoS attack: Communication dropout spikes
    - Fault: Sudden overcurrent or voltage sag
    - Coordinated attack: Cascading failures across agents
    """
    
    def __init__(self, seed: int = 42):
        np.random.seed(seed)
        self.seed = seed
    
    def generate_normal_sequence(self,
                                length: int = 100,
                                n_agents: int = 10,
                                noise_level: float = 0.05) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate normal operation baseline.
        
        Args:
            length: Sequence length (timesteps)
            n_agents: Number of agents
            noise_level: Gaussian noise std dev
        
        Returns:
            (data: [length, n_agents, 7], labels: [length])
            Labels: 0 = normal
        """
        # 7 metrics per agent: voltage, current, frequency, power, temp, latency, cpu
        data = np.zeros((length, n_agents, 7))
        labels = np.zeros(length, dtype=int)
        
        for t in range(length):
            for i in range(n_agents):
                # Baseline values (realistic power grid)
                voltage = 230 + np.random.normal(0, 5)  # 230V ± 5V
                current = 100 + np.random.normal(0, 10)  # 100A ± 10A
                frequency = 50 + np.random.normal(0, 0.1)  # 50Hz ± 0.1Hz
                power = voltage * current * 0.9  # P = V*I*PF
                temp = 25 + np.random.normal(0, 2)  # 25°C ± 2°C
                latency = 50 + np.random.normal(0, 5)  # 50ms ± 5ms
                cpu = 30 + np.random.normal(0, 5)  # 30% ± 5%
                
                data[t, i] = [voltage, current, frequency, power, temp, latency, cpu]
        
        return data, labels
    
    def generate_fdi_attack(self,
                           length: int = 100,
                           n_agents: int = 10,
                           attack_start: int = 30,
                           attack_intensity: float = 0.35) -> Tuple[np.ndarray, np.ndarray]:
        """
        FDI Attack: Tamper with voltage/current readings.
        
        Args:
            length: Sequence length
            n_agents: Number of agents
            attack_start: When attack begins (timestep)
            attack_intensity: Tampering magnitude (0.2-0.45)
        
        Returns:
            (data: [length, n_agents, 7], labels: [length])
            Labels: 0 = normal, 1 = FDI attack
        """
        data, labels = self.generate_normal_sequence(length, n_agents)
        
        # Attack: tamper 30% of agents' voltage/current
        attacked_agents = np.random.choice(n_agents, 
                                          size=max(1, n_agents // 3),
                                          replace=False)
        
        for t in range(attack_start, length):
            for i in attacked_agents:
                # Inject false readings: spike voltage/current
                data[t, i, 0] *= (1 + attack_intensity * np.random.uniform(-1, 1))  # Voltage
                data[t, i, 1] *= (1 + attack_intensity * np.random.uniform(-1, 1))  # Current
                data[t, i, 3] = data[t, i, 0] * data[t, i, 1] * 0.9  # Update power
                labels[t] = 1
        
        return data, labels
    
    def generate_dos_attack(self,
                           length: int = 100,
                           n_agents: int = 10,
                           attack_start: int = 30,
                           attack_duration: int = 20) -> Tuple[np.ndarray, np.ndarray]:
        """
        DoS Attack: Simulate communication timeouts/packet loss.
        
        Args:
            length: Sequence length
            n_agents: Number of agents
            attack_start: When attack begins
            attack_duration: How long attack lasts
        
        Returns:
            (data, labels)
        """
        data, labels = self.generate_normal_sequence(length, n_agents)
        
        # Attack: spike latency and set some reads to NaN (packet loss)
        attack_agents = np.random.choice(n_agents,
                                        size=max(1, n_agents // 4),
                                        replace=False)
        
        for t in range(attack_start, min(attack_start + attack_duration, length)):
            for i in attack_agents:
                data[t, i, 5] = 500 + np.random.normal(0, 100)  # Latency spike
                labels[t] = 1
        
        return data, labels
    
    def generate_fault_scenario(self,
                               length: int = 100,
                               n_agents: int = 10,
                               fault_start: int = 40,
                               fault_type: str = "overcurrent") -> Tuple[np.ndarray, np.ndarray]:
        """
        Physical Fault: Overcurrent, voltage sag, frequency deviation.
        
        Args:
            length: Sequence length
            n_agents: Number of agents
            fault_start: When fault occurs
            fault_type: "overcurrent", "voltage_sag", "freq_deviation"
        
        Returns:
            (data, labels)
        """
        data, labels = self.generate_normal_sequence(length, n_agents)
        
        # Fault propagates to 1-2 agents
        faulty_agents = np.random.choice(n_agents,
                                        size=max(1, n_agents // 5),
                                        replace=False)
        
        for t in range(fault_start, length):
            for i in faulty_agents:
                if fault_type == "overcurrent":
                    data[t, i, 1] *= 1.5  # Current spike
                    data[t, i, 3] *= 1.5  # Power spike
                elif fault_type == "voltage_sag":
                    data[t, i, 0] *= 0.7  # Voltage drops
                    data[t, i, 3] *= 0.7  # Power drops
                elif fault_type == "freq_deviation":
                    data[t, i, 2] -= np.random.uniform(0.2, 0.5)  # Frequency drops
                
                labels[t] = 1
        
        return data, labels
    
    def generate_training_dataset(self, 
                                 num_sequences: int = 1000,
                                 sequence_length: int = 50,
                                 n_agents: int = 10) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate balanced training dataset with multiple anomaly types.
        
        Args:
            num_sequences: Number of sequences to generate
            sequence_length: Length of each sequence
            n_agents: Number of agents per sequence
        
        Returns:
            (X: [num_sequences, sequence_length, n_agents, 7],
             y: [num_sequences, sequence_length])
        """
        all_data = []
        all_labels = []
        
        # 40% normal
        num_normal = int(0.4 * num_sequences)
        for _ in range(num_normal):
            data, labels = self.generate_normal_sequence(sequence_length, n_agents)
            all_data.append(data)
            all_labels.append(labels)
        
        # 20% FDI
        num_fdi = int(0.2 * num_sequences)
        for _ in range(num_fdi):
            data, labels = self.generate_fdi_attack(sequence_length, n_agents)
            all_data.append(data)
            all_labels.append(labels)
        
        # 20% DoS
        num_dos = int(0.2 * num_sequences)
        for _ in range(num_dos):
            data, labels = self.generate_dos_attack(sequence_length, n_agents)
            all_data.append(data)
            all_labels.append(labels)
        
        # 20% Faults
        num_fault = int(0.2 * num_sequences)
        for _ in range(num_fault):
            fault_type = np.random.choice(["overcurrent", "voltage_sag", "freq_deviation"])
            data, labels = self.generate_fault_scenario(sequence_length, n_agents,
                                                       fault_type=fault_type)
            all_data.append(data)
            all_labels.append(labels)
        
        X = np.array(all_data)  # [num_sequences, sequence_length, n_agents, 7]
        y = np.array(all_labels)  # [num_sequences, sequence_length]
        
        return X, y


class LSTMPretrainedModel(nn.Module):
    """
    LSTM-based anomaly detector pre-trained on synthetic data.
    
    Architecture matches LSTMAnomalyDetector for seamless integration:
    - Input: (batch_size, sequence_length, n_agents * n_metrics)
    - LSTM layers: configurable hidden size and depth
    - Output layer: Linear (logits), Sigmoid applied post-hoc for probs
    """
    
    def __init__(self,
                 input_size: int = 70,  # 10 agents * 7 metrics
                 hidden_size: int = 64,
                 num_layers: int = 2,
                 dropout: float = 0.2):
        super().__init__()
        
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True
        )
        
        # Simple linear layer matching LSTMAnomalyDetector
        self.fc = nn.Linear(hidden_size, 1)
    
    def forward(self, x):
        """
        Args:
            x: (batch_size, sequence_length, input_size)
        
        Returns:
            logits: (batch_size, sequence_length) - raw outputs
            probs: (batch_size, sequence_length) - sigmoid applied
        """
        lstm_out, _ = self.lstm(x)  # (batch, seq_len, hidden_size)
        logits = self.fc(lstm_out).squeeze(-1)  # (batch, seq_len)
        probs = torch.sigmoid(logits)
        return logits, probs


def pretrain_lstm_model(model: LSTMPretrainedModel,
                       X_train: np.ndarray,
                       y_train: np.ndarray,
                       X_val: Optional[np.ndarray] = None,
                       y_val: Optional[np.ndarray] = None,
                       epochs: int = 30,
                       batch_size: int = 32,
                       learning_rate: float = 0.001) -> Tuple[LSTMPretrainedModel, List[float]]:
    """
    Pre-train LSTM on synthetic dataset.
    
    Args:
        model: LSTMPretrainedModel instance
        X_train: Training data [num_sequences, seq_len, n_agents*metrics]
        y_train: Training labels [num_sequences, seq_len]
        X_val: Validation data (optional)
        y_val: Validation labels (optional)
        epochs: Number of training epochs
        batch_size: Batch size
        learning_rate: Adam learning rate
    
    Returns:
        (trained_model, loss_history)
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    
    # Reshape data: flatten agent dimension
    num_seqs, seq_len, n_agents, n_metrics = X_train.shape
    X_train_flat = X_train.reshape(num_seqs, seq_len, -1)
    
    # Create DataLoader
    X_tensor = torch.FloatTensor(X_train_flat)
    y_tensor = torch.FloatTensor(y_train)  # [num_seqs, seq_len]
    
    dataset = TensorDataset(X_tensor, y_tensor)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    
    # Loss and optimizer
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    
    loss_history = []
    
    logger.info(f"Starting LSTM pre-training on device: {device}")
    logger.info(f"Training samples: {len(dataset)}, epochs: {epochs}, batch_size: {batch_size}")
    
    for epoch in range(epochs):
        epoch_loss = 0.0
        
        for X_batch, y_batch in dataloader:
            X_batch = X_batch.to(device)
            y_batch = y_batch.to(device)
            
            # Forward pass
            logits, probs = model(X_batch)
            loss = criterion(probs, y_batch)
            
            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()
        
        avg_loss = epoch_loss / len(dataloader)
        loss_history.append(avg_loss)
        
        if (epoch + 1) % 5 == 0:
            logger.info(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.6f}")
    
    logger.info(f"Pre-training complete. Final loss: {loss_history[-1]:.6f}")
    
    return model.to("cpu"), loss_history


def save_pretrained_model(model: LSTMPretrainedModel, 
                         path: str):
    """Save pre-trained model to disk."""
    torch.save(model.state_dict(), path)
    logger.info(f"Model saved to {path}")


def load_pretrained_model(model_class: type,
                         path: str,
                         device: str = "cpu") -> LSTMPretrainedModel:
    """Load pre-trained model from disk."""
    model = model_class()
    model.load_state_dict(torch.load(path, map_location=device))
    model.eval()
    logger.info(f"Model loaded from {path}")
    return model
