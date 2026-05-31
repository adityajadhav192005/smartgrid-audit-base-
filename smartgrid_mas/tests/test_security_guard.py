"""Tests for the API security guard.

These cover the failure modes that previously caused the dashboard's
"Invalid or missing API key" 401 to surface, plus the production-mode
fail-fast added to prevent silent use of the dev default in prod.
"""

from __future__ import annotations

import importlib

import pytest
from fastapi import HTTPException

app_module = importlib.import_module("smartgrid_mas.api.app")


def _call_guard(api_key: str | None):
    return app_module._security_guard(x_api_key=api_key, x_timestamp=None, x_nonce=None)


def test_default_dev_key_accepted_when_no_env(monkeypatch):
    monkeypatch.delenv("SMARTGRID_API_KEY", raising=False)
    monkeypatch.delenv("SMARTGRID_ENV", raising=False)
    assert _call_guard("smartgrid-dev-key") == "smartgrid-dev-key"


def test_missing_key_is_401(monkeypatch):
    monkeypatch.delenv("SMARTGRID_API_KEY", raising=False)
    monkeypatch.delenv("SMARTGRID_ENV", raising=False)
    with pytest.raises(HTTPException) as exc:
        _call_guard(None)
    assert exc.value.status_code == 401


def test_wrong_key_is_401(monkeypatch):
    monkeypatch.setenv("SMARTGRID_API_KEY", "the-real-key")
    monkeypatch.delenv("SMARTGRID_ENV", raising=False)
    with pytest.raises(HTTPException) as exc:
        _call_guard("not-the-real-key")
    assert exc.value.status_code == 401


def test_correct_key_passes(monkeypatch):
    monkeypatch.setenv("SMARTGRID_API_KEY", "the-real-key")
    monkeypatch.delenv("SMARTGRID_ENV", raising=False)
    assert _call_guard("the-real-key") == "the-real-key"


def test_production_refuses_unset_key(monkeypatch):
    monkeypatch.setenv("SMARTGRID_ENV", "production")
    monkeypatch.delenv("SMARTGRID_API_KEY", raising=False)
    with pytest.raises(HTTPException) as exc:
        _call_guard("anything")
    assert exc.value.status_code == 500
    assert "must be set" in exc.value.detail.lower()


def test_production_refuses_dev_default(monkeypatch):
    monkeypatch.setenv("SMARTGRID_ENV", "production")
    monkeypatch.setenv("SMARTGRID_API_KEY", "smartgrid-dev-key")
    with pytest.raises(HTTPException) as exc:
        _call_guard("smartgrid-dev-key")
    assert exc.value.status_code == 500


def test_production_accepts_real_key(monkeypatch):
    monkeypatch.setenv("SMARTGRID_ENV", "production")
    monkeypatch.setenv("SMARTGRID_API_KEY", "real-prod-key-xyz")
    assert _call_guard("real-prod-key-xyz") == "real-prod-key-xyz"
