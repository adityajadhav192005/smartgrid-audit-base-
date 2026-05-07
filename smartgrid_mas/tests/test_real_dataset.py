import numpy as np

from smartgrid_mas.data.real_dataset import RealDatasetLoadResult, load_real_training_corpus
import smartgrid_mas.data.real_dataset as real_dataset_module


def test_load_real_training_corpus_concatenates_multiple_sources(monkeypatch):
    def fake_loader(path, target_feature_dim, label_column=None, max_rows=None, random_seed=42):
        name = str(path)
        if name.endswith("a.csv"):
            return RealDatasetLoadResult(
                data=np.array([[0.1, 1.0, 0.0, 0.0], [0.2, 1.1, 0.0, 0.0]], dtype=np.float32),
                labels=np.array([0.0, 1.0], dtype=np.float32),
                source_path=name,
                label_column="label",
                original_feature_count=2,
                adapted_feature_count=target_feature_dim,
            )
        return RealDatasetLoadResult(
            data=np.array([[0.4, 1.3, 0.0, 0.0]], dtype=np.float32),
            labels=np.array([1.0], dtype=np.float32),
            source_path=name,
            label_column="label",
            original_feature_count=2,
            adapted_feature_count=target_feature_dim,
        )

    monkeypatch.setattr(real_dataset_module, "load_real_training_data", fake_loader)

    loaded = load_real_training_corpus(
        paths="a.csv;b.csv",
        target_feature_dim=4,
        label_column="label",
    )

    assert loaded.data.shape == (3, 4)
    assert loaded.labels.shape == (3,)
    assert float(loaded.labels.sum()) == 2.0
    assert loaded.source_path == "a.csv;b.csv"
