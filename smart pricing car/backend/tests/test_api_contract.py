from __future__ import annotations

from fastapi.testclient import TestClient

from car_rental_api import app


def test_quote_includes_required_contract_fields(monkeypatch):
    class _FakeSvc:
        allow_proxies = False

        def quote_row(self, payload: dict):
            return {
                "predicted_total_gbp": 100.0,
                "raw_predicted_gbp": 100.0,
                "clamped": False,
                "currency": "GBP",
                "source": "model",
                "degraded": False,
                "quote_id": "qte_contract",
                "model_version": "test",
            }

    import car_rental_api as api

    monkeypatch.setattr(api, "get_service", lambda: _FakeSvc())
    client = TestClient(app)
    res = client.post("/quote", json={"city": "London", "group": "Economy"})
    assert res.status_code == 200
    body = res.json()
    assert "recommended_price" in body
    assert "confidence_score" in body
    assert "explanation_tags" in body
    assert "price_components" in body
    # Backward compatibility.
    assert "predicted_total_gbp" in body

