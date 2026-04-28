from __future__ import annotations

import time
from typing import Any, Literal

from fastapi import FastAPI, Request, Response
from pydantic import BaseModel, Field

from .anomaly_stub import score_event_stub
from .decision_orchestrator import CandidateInput, DecisionOrchestrator, components_to_dict

app = FastAPI(title="Ranking Intelligence Service", version="1.1.0")
_orchestrator = DecisionOrchestrator()

_METRICS = {
    "rank_requests_total": 0,
    "events_ingested_total": 0,
    "anomaly_alerts_total": 0,
    "downrank_ctr_total": 0,
}


class CandidateListing(BaseModel):
    listing_id: str
    host_id: str
    base_score: float
    plan_id: Literal["FREE", "SILVER", "PLATINUM"]
    subscription_status: str
    promotion_weight: float = 1.0
    price: float = 0.0
    listing_quality: float = 0.5
    position_hint: int = 0
    device_type: str = "unknown"
    host_promoted_count: int | None = None
    host_max_promoted_listings: int | None = None


class RankScoreRequest(BaseModel):
    query_id: str
    user_id: str | None = None
    session_id: str | None = None
    device_type: str | None = None
    candidates: list[CandidateListing] = Field(max_length=500)


class RankedItem(BaseModel):
    listing_id: str
    final_score: float
    components: dict[str, float]


class RankScoreResponse(BaseModel):
    ranked: list[RankedItem]
    model_versions: dict[str, str]


class HealthResponse(BaseModel):
    status: str
    version: str


@app.middleware("http")
async def timing_and_latency_header(request: Request, call_next: Any) -> Any:
    """Doc §15: surface latency budget (<50ms target for scoring path)."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.2f}"
    return response


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", version="1.1.0")


@app.get("/metrics")
def prometheus_metrics() -> Response:
    """Minimal metrics (doc §17); extend with prometheus_client in production."""
    lines = [
        "# HELP rank_requests_total Total rank/score requests",
        "# TYPE rank_requests_total counter",
        f"rank_requests_total {_METRICS['rank_requests_total']}",
        "# HELP events_ingested_total Events accepted",
        "# TYPE events_ingested_total counter",
        f"events_ingested_total {_METRICS['events_ingested_total']}",
        "# HELP anomaly_alerts_total Anomaly alerts emitted",
        "# TYPE anomaly_alerts_total counter",
        f"anomaly_alerts_total {_METRICS['anomaly_alerts_total']}",
    ]
    return Response(content="\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")


@app.post("/v1/rank/score", response_model=RankScoreResponse)
def rank_score(body: RankScoreRequest, response: Response) -> RankScoreResponse:
    _METRICS["rank_requests_total"] += 1
    default_device = body.device_type or "unknown"
    cands = [
        CandidateInput(
            listing_id=c.listing_id,
            host_id=c.host_id,
            base_score=c.base_score,
            plan_id=c.plan_id,
            subscription_status=c.subscription_status,
            promotion_weight=c.promotion_weight,
            price=c.price,
            listing_quality=c.listing_quality,
            position_hint=c.position_hint,
            device_type=c.device_type if c.device_type != "unknown" else default_device,
            host_promoted_count=c.host_promoted_count,
            host_max_promoted_listings=c.host_max_promoted_listings,
        )
        for c in body.candidates
    ]
    ordered = _orchestrator.rank(cands, user_id=body.user_id, query_id=body.query_id)
    ranked: list[RankedItem] = []
    for c, sc in ordered:
        if sc.pred_ctr < _orchestrator.cfg.ctr_threshold_downrank:
            _METRICS["downrank_ctr_total"] += 1
        ranked.append(
            RankedItem(
                listing_id=c.listing_id,
                final_score=sc.final_score,
                components=components_to_dict(sc),
            )
        )
    mv = _orchestrator.model_versions.copy()
    response.headers["X-Model-Version"] = mv.get("decision_orchestrator", "1.1.0")
    return RankScoreResponse(ranked=ranked, model_versions=mv)


@app.get("/v1/models/info")
def models_info() -> dict[str, Any]:
    return {"models": _orchestrator.model_versions}


@app.get("/v1/hosts/{host_id}/promote/recommendations")
def promote_recommendations(host_id: str, limit: int = 10) -> dict[str, Any]:
    """Doc §8: ROI suggestions + ranking impact prediction (stub until listings service wired)."""
    return {
        "host_id": host_id,
        "limit": limit,
        "items": [],
        "ranking_impact_prediction_note": "Populate from counterfactual score delta vs organic",
    }


@app.get("/v1/hosts/{host_id}/intelligence/dashboard")
def host_intelligence_dashboard(host_id: str) -> dict[str, Any]:
    """Doc §13: host dashboard — suggestions, expected impressions/clicks, ROI, insights."""
    return {
        "host_id": host_id,
        "suggested_listings_to_promote": [],
        "expected_impressions_7d": None,
        "expected_clicks_7d": None,
        "predicted_roi": None,
        "performance_insights": [
            {
                "listing_id": None,
                "message": "This listing has 35% higher CTR potential if promoted",
                "kind": "ctr_uplift_example",
            }
        ],
    }


class EventIngest(BaseModel):
    idempotency_key: str
    event_type: str
    listing_id: str
    occurred_at: str
    host_id: str | None = None
    user_id: str | None = None
    session_id: str | None = None
    query_hash: str | None = None
    position: int | None = None
    device_type: str | None = None
    click_rate_burst: float | None = None
    ip_entropy: float | None = None


@app.post("/v1/events", status_code=202)
def ingest_event(body: EventIngest) -> dict[str, Any]:
    """Doc §14 + §11: feedback loop ingestion; anomaly → exclude + alert_admin."""
    _METRICS["events_ingested_total"] += 1
    burst = body.click_rate_burst if body.click_rate_burst is not None else 0.0
    ent = body.ip_entropy if body.ip_entropy is not None else 1.0
    ar = score_event_stub(burst, ent)
    out: dict[str, Any] = {
        "status": "accepted",
        "anomaly_score": ar.score,
        "exclude_from_training": ar.exclude_from_training,
    }
    if ar.exclude_from_training:
        _METRICS["anomaly_alerts_total"] += 1
        out["alert_admin"] = True
        out["alert_channel"] = "webhook_stub"
    return out


@app.post("/v1/admin/alerts/test")
def admin_alert_test() -> dict[str, str]:
    """Doc §11: admin alert hook placeholder."""
    return {"status": "noop", "detail": "Wire to PagerDuty/Slack"}

