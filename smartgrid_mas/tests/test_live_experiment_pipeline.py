from __future__ import annotations

from pathlib import Path

from smartgrid_mas.integration.live_experiment_pipeline import LiveExperimentPipeline


def test_live_experiment_pipeline_uses_lstm_checkpoint(monkeypatch):
    model_path = Path("smartgrid_mas") / "data" / "anomaly_inputs" / "lstm_live_scada.pt"
    assert model_path.exists(), f"Expected live LSTM checkpoint at {model_path}"

    monkeypatch.setenv("SMARTGRID_SCADA_USE_EXPERIMENT_PIPELINE", "1")
    monkeypatch.setenv("SMARTGRID_LIVE_LSTM_MODEL_PATH", str(model_path))

    pipeline = LiveExperimentPipeline()
    assert pipeline.status()["lstm_enabled"] is True

    results = pipeline.process_batch(
        [
            {
                "agent_id": "GEN-01",
                "x_phys": [231.0, 50.0, 15.2, 4.0, 3.0],
                "y_cyber": [3.1, 0.004, 0.99, 49.5],
                "bx": [230.0, 50.0, 15.0, 3.0, 3.0],
                "by": [3.0, 0.001, 1.0, 50.0],
                "thx": [12.0, 0.5, 8.0, 2.5, 4.0],
                "thy": [1.5, 0.01, 0.1, 8.0],
                "criticality_weight": 1.0,
                "score_threshold": 3.0,
                "feature_names_phys": ["voltage", "frequency", "current", "power", "response_time"],
                "feature_names_cyber": ["latency", "packet_loss", "integrity", "comm_freq"],
            },
            {
                "agent_id": "SUB-21",
                "x_phys": [229.0, 49.9, 12.4, 181.0, 4.0],
                "y_cyber": [4.4, 0.005, 0.987, 48.5],
                "bx": [230.0, 50.0, 12.0, 180.0, 4.0],
                "by": [4.0, 0.001, 1.0, 50.0],
                "thx": [12.0, 0.5, 10.0, 80.0, 5.0],
                "thy": [1.5, 0.01, 0.1, 8.0],
                "criticality_weight": 0.7,
                "score_threshold": 3.0,
                "feature_names_phys": ["voltage", "frequency", "current", "power", "response_time"],
                "feature_names_cyber": ["latency", "packet_loss", "integrity", "comm_freq"],
            },
            {
                "agent_id": "PMU-51",
                "x_phys": [228.5, 49.8, 0.6, 1.0, 2.0],
                "y_cyber": [2.2, 0.002, 0.996, 50.5],
                "bx": [230.0, 50.0, 0.5, 1.0, 2.0],
                "by": [2.0, 0.001, 1.0, 50.0],
                "thx": [10.0, 0.3, 1.5, 1.5, 3.0],
                "thy": [1.0, 0.01, 0.1, 8.0],
                "criticality_weight": 0.3,
                "score_threshold": 3.0,
                "feature_names_phys": ["voltage", "frequency", "current", "power", "response_time"],
                "feature_names_cyber": ["latency", "packet_loss", "integrity", "comm_freq"],
            },
        ]
    )

    first = results["GEN-01"]
    assert first["pipeline"] == "experiment_live"
    assert 0.0 <= float(first["anomaly_prob"]) <= 1.0
    assert 0.0 <= float(first["attack_type_confidence"]) <= 1.0
    assert first["experiment_details"]["lstm_enabled"] is True
