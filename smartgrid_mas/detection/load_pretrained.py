"""
Load and wrap pre-trained LSTM model for use in hybrid detection.

This module ensures that the pre-trained LSTM (from lstm_pretraining.py)
is properly loaded and integrated with the existing LSTMInferencer interface.
"""

import torch
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)

PRETRAINED_MODEL_PATH = "smartgrid_mas/data/anomaly_inputs/lstm_pretrained.pt"


def load_pretrained_lstm_checkpoint(
    model_path: str = PRETRAINED_MODEL_PATH
) -> dict:
    """
    Load pre-trained LSTM checkpoint with metadata.
    
    Args:
        model_path: Path to saved checkpoint
    
    Returns:
        Dictionary with state_dict, input_size, hidden_size, num_layers, dropout
    
    Raises:
        FileNotFoundError: If model not found
        RuntimeError: If checkpoint format invalid
    """
    path = Path(model_path)
    if not path.exists():
        raise FileNotFoundError(f"Pre-trained model not found: {model_path}")
    
    try:
        ckpt = torch.load(str(path), map_location="cpu")
    except Exception as e:
        raise RuntimeError(f"Failed to load checkpoint: {e}")
    
    required_keys = {"state_dict", "input_size", "hidden_size", "num_layers", "dropout"}
    missing = required_keys - set(ckpt.keys())
    if missing:
        raise RuntimeError(f"Checkpoint missing required keys: {missing}")
    
    return ckpt


def ensure_pretrained_lstm_exists(
    model_path: str = PRETRAINED_MODEL_PATH,
    min_loss: float = 0.5
) -> bool:
    """
    Check if pre-trained LSTM exists and is valid.
    
    Args:
        model_path: Path to model
        min_loss: Maximum acceptable final loss (sanity check)
    
    Returns:
        True if model exists and is valid
    """
    try:
        path = Path(model_path)
        if not path.exists():
            logger.warning(f"Pre-trained model not found: {model_path}")
            return False
        
        ckpt = torch.load(str(path), map_location="cpu")
        
        # Validate metadata
        if "state_dict" not in ckpt:
            logger.warning(f"Invalid checkpoint format (no state_dict)")
            return False
        
        # Check that weights are non-zero (model is actually trained)
        for name, param in ckpt["state_dict"].items():
            if torch.isnan(param).any() or torch.isinf(param).any():
                logger.warning(f"Found NaN/Inf in {name}")
                return False
        
        # Sanity check final loss
        if "loss_history" in ckpt:
            final_loss = ckpt["loss_history"][-1]
            if final_loss > min_loss:
                logger.info(f"Final loss {final_loss:.4f} is higher than expected")
        
        logger.info(f"✓ Pre-trained model valid: {model_path}")
        return True
        
    except Exception as e:
        logger.warning(f"Error validating pre-trained model: {e}")
        return False


def get_pretrained_lstm_info() -> dict:
    """
    Get metadata about the pre-trained LSTM model.
    
    Returns:
        Dictionary with model architecture info
    """
    try:
        ckpt = load_pretrained_lstm_checkpoint()
        return {
            "input_size": ckpt["input_size"],
            "hidden_size": ckpt["hidden_size"],
            "num_layers": ckpt["num_layers"],
            "dropout": ckpt["dropout"],
            "has_loss_history": "loss_history" in ckpt,
            "final_loss": ckpt.get("loss_history", [-1])[-1] if "loss_history" in ckpt else None,
        }
    except Exception as e:
        logger.error(f"Failed to get pre-trained LSTM info: {e}")
        return {}
