"""Smoke tests for HTTP surface — audit evidence that routes respond."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_metrics_text() -> None:
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "rank_requests_total" in r.text


def test_rank_score_returns_model_versions() -> None:
    body = {
        "query_id": "q-audit",
        "user_id": "u1",
        "candidates": [
            {
                "listing_id": "l1",
                "host_id": "h1",
                "base_score": 1.0,
                "plan_id": "FREE",
                "subscription_status": "ACTIVE",
                "price": 99.0,
                "listing_quality": 0.6,
            }
        ],
    }
    r = client.post("/v1/rank/score", json=body)
    assert r.status_code == 200
    data = r.json()
    assert "ranked" in data and len(data["ranked"]) == 1
    assert "model_versions" in data
    assert "X-Model-Version" in r.headers
    assert "X-Process-Time-Ms" in r.headers


def test_host_dashboard() -> None:
    r = client.get("/v1/hosts/h1/intelligence/dashboard")
    assert r.status_code == 200
    assert "performance_insights" in r.json()


def test_events_anomaly_fields() -> None:
    r = client.post(
        "/v1/events",
        json={
            "idempotency_key": "k1",
            "event_type": "CLICK",
            "listing_id": "l1",
            "occurred_at": "2026-04-10T12:00:00Z",
            "click_rate_burst": 0.99,
            "ip_entropy": 0.01,
        },
    )
    assert r.status_code == 202
    j = r.json()
    assert "exclude_from_training" in j
    assert "anomaly_score" in j
