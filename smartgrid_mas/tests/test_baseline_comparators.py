"""Tests for baseline detection comparators."""

from __future__ import annotations

import numpy as np
import pytest

from smartgrid_mas.simulation.baseline_comparators import (
    ComparisonResult,
    DeviationOnlyDetector,
    IsolationForestDetector,
    LSTMOnlyDetector,
    OneClassSVMDetector,
)


def test_deviation_only_flags_high_deviation():
    det = DeviationOnlyDetector(threshold=2.0)
    r = det.detect(
        x_phys=np.array([5.0, 5.0, 5.0]),
        y_cyber=np.array([5.0, 5.0, 5.0, 5.0]),
        bx=np.array([1.0, 1.0, 1.0]),
        by=np.array([1.0, 1.0, 1.0, 1.0]),
        thx=np.array([0.1, 0.1, 0.1]),
        thy=np.array([0.1, 0.1, 0.1, 0.1]),
    )
    assert r.flag == 1
    assert r.score > 2.0


def test_deviation_only_passes_normal():
    det = DeviationOnlyDetector(threshold=2.0)
    r = det.detect(
        x_phys=np.array([1.01, 1.02, 0.99]),
        y_cyber=np.array([1.0, 1.0, 1.0, 1.0]),
        bx=np.array([1.0, 1.0, 1.0]),
        by=np.array([1.0, 1.0, 1.0, 1.0]),
        thx=np.array([0.1, 0.1, 0.1]),
        thy=np.array([0.1, 0.1, 0.1, 0.1]),
    )
    assert r.flag == 0


def test_lstm_only_flags_high_prob():
    det = LSTMOnlyDetector(prob_threshold=0.80)
    r = det.detect(0.95)
    assert r.flag == 1
    assert r.score == 0.95


def test_lstm_only_passes_low_prob():
    det = LSTMOnlyDetector(prob_threshold=0.80)
    r = det.detect(0.30)
    assert r.flag == 0


def test_isolation_forest_warmup_returns_zero():
    det = IsolationForestDetector(warmup=10)
    r = det.observe_and_detect(np.array([1.0, 1.0, 1.0]), np.array([1.0, 1.0, 1.0, 1.0]), is_warmup=True)
    assert r.flag == 0


def test_isolation_forest_trains_and_detects():
    det = IsolationForestDetector(warmup=20, contamination=0.05)
    rng = np.random.default_rng(42)
    for i in range(25):
        x = rng.normal(1.0, 0.01, 3)
        y = rng.normal(1.0, 0.01, 4)
        det.observe_and_detect(x, y, is_warmup=i < 20)
    assert det._fitted
    r_normal = det.observe_and_detect(np.array([1.0, 1.0, 1.0]), np.array([1.0, 1.0, 1.0, 1.0]))
    r_anomaly = det.observe_and_detect(np.array([10.0, 10.0, 10.0]), np.array([10.0, 10.0, 10.0, 10.0]))
    assert r_anomaly.score > r_normal.score


def test_one_class_svm_trains_and_detects():
    det = OneClassSVMDetector(warmup=20, nu=0.05)
    rng = np.random.default_rng(42)
    for i in range(25):
        x = rng.normal(1.0, 0.01, 3)
        y = rng.normal(1.0, 0.01, 4)
        det.observe_and_detect(x, y, is_warmup=i < 20)
    assert det._fitted


def test_comparison_result_metrics():
    cr = ComparisonResult("test")
    cr.y_true = [1, 1, 0, 0, 1, 0]
    cr.y_pred = [1, 0, 0, 1, 1, 0]
    assert cr.tp == 2
    assert cr.fp == 1
    assert cr.fn == 1
    assert cr.tn == 2
    assert abs(cr.accuracy - 4 / 6) < 1e-6
    assert abs(cr.recall - 2 / 3) < 1e-6
    assert abs(cr.precision - 2 / 3) < 1e-6
