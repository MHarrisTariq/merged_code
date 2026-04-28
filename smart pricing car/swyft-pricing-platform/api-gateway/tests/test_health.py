from __future__ import annotations

from fastapi.testclient import TestClient

from car_rental_api import app


def test_health_ok():
    c = TestClient(app)
    r = c.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body.get("ok") is True
