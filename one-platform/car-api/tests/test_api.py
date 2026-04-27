from __future__ import annotations

from fastapi.testclient import TestClient

from car_rental_api import app


def test_simulate_endpoint_works_without_models(monkeypatch):
    """
    Service loads model artifacts from models/car; in CI or fresh clones they may be missing.
    We monkeypatch the internal service getter to avoid coupling this test to training artifacts.
    """

    class _FakeSvc:
        allow_proxies = False

        def quote_row(self, payload: dict):
            # pretend baseline quote
            return {
                "predicted_total_gbp": 100.0,
                "raw_predicted_gbp": 100.0,
                "clamped": False,
                "currency": "GBP",
                "source": "model",
                "degraded": False,
                "quote_id": "qte_test",
                "model_version": "test",
            }

    import car_rental_api as api

    monkeypatch.setattr(api, "get_service", lambda: _FakeSvc())

    client = TestClient(app)
    res = client.post("/simulate", json={"city": "London", "group": "Economy"})
    assert res.status_code == 200
    body = res.json()
    assert "best" in body
    assert "curve" in body
    assert body["count"] >= 1


def test_optimize_endpoint_works_without_models(monkeypatch):
    class _FakeSvc:
        allow_proxies = False

        def quote_row(self, payload: dict):
            return {
                "predicted_total_gbp": 120.0,
                "raw_predicted_gbp": 120.0,
                "clamped": False,
                "currency": "GBP",
                "source": "model",
                "degraded": False,
                "quote_id": "qte_test",
                "model_version": "test",
            }

    import car_rental_api as api

    monkeypatch.setattr(api, "get_service", lambda: _FakeSvc())

    client = TestClient(app)
    res = client.post("/optimize", json={"city": "London", "group": "Economy"})
    assert res.status_code == 200
    body = res.json()
    assert "best" in body
    assert "baseline_quote" in body

