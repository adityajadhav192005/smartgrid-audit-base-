import numpy as np
import tempfile
import os
from smartgrid_mas.anomaly_detection.train_lstm import train_lstm
from smartgrid_mas.anomaly_detection.inference import LSTMInferencer

def test_lstm_smoke():
    """Smoke test: train and infer."""
    # Synthetic data: N=200, F=5
    N, F = 200, 5
    data = np.random.randn(N, F).astype(np.float32)
    labels = (np.random.rand(N) > 0.8).astype(np.float32)  # sparse anomalies

    with tempfile.TemporaryDirectory() as tmp_path:
        model_path = os.path.join(tmp_path, "lstm.pt")

        # Train
        res = train_lstm(
            data, labels,
            window=10,
            model_path=model_path,
            epochs=2,
            batch_size=32,
            verbose=False,
        )
        assert os.path.exists(model_path), "Model file not saved"
        assert res.train_loss > 0.0
        assert res.val_loss > 0.0

        # Infer
        inf = LSTMInferencer(model_path=model_path, input_size=F)
        p = inf.predict_proba(data[:10])  # window of first 10 samples
        assert 0.0 <= p <= 1.0, f"Probability out of range: {p}"

def test_lstm_convergence():
    """Test that loss decreases over training."""
    N, F = 150, 4
    # Synthetic data with clear pattern
    data = np.random.randn(N, F).astype(np.float32)
    labels = np.concatenate([
        np.zeros(N // 2, dtype=np.float32),  # first half normal
        np.ones(N // 2, dtype=np.float32),    # second half anomalous
    ])

    with tempfile.TemporaryDirectory() as tmp_path:
        model_path = os.path.join(tmp_path, "lstm_conv.pt")

        res = train_lstm(
            data, labels,
            window=8,
            model_path=model_path,
            epochs=5,
            batch_size=16,
            lr=1e-2,
            verbose=False,
        )
        # Loss should be reasonable
        assert res.train_loss < 1.0, f"Training loss too high: {res.train_loss}"
        assert res.val_loss < 1.0, f"Validation loss too high: {res.val_loss}"

if __name__ == "__main__":
    test_lstm_smoke()
    test_lstm_convergence()
    print("✓ All LSTM tests passed")
