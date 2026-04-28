"""SwyftBooking AI layer: risk, availability probability, sync interval, demand."""
from __future__ import annotations

import math
import os
from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

MODEL_DIR = Path(__file__).resolve().parent / "models"
RISK_MODEL_PATH = MODEL_DIR / "risk_model.pkl"


class RiskScoreRequest(BaseModel):
    listing_id: str
    platform: str = "generic"
    time_to_sync: float = Field(ge=0, default=2.0)
    platform_latency: float = Field(ge=0, default=1.0)
    demand_score: float = Field(ge=0, le=1, default=0.5)
    concurrent_requests: int = Field(ge=0, default=0)
    platform_reliability: float = Field(ge=0, le=1, default=0.9)


class RiskScoreResponse(BaseModel):
    risk_score: float
    action: str
    lock_duration_sec: int


class AvailabilityProbRequest(BaseModel):
    listing_id: str
    last_sync_seconds_ago: float = 60.0
    platform_latency: float = 1.0
    api_success_rate: float = 0.95
    booking_frequency: float = 0.3
    listing_popularity: float = 0.5
    traffic_spike: float = 0.0


class AvailabilityProbResponse(BaseModel):
    availability_probability: float
    block_temporarily: bool
    trigger_priority_sync: bool


class SyncIntervalRequest(BaseModel):
    demand_score: float = Field(ge=0, le=1, default=0.5)
    risk_score: float = Field(ge=0, le=1, default=0.3)
    platform_reliability: float = Field(ge=0, le=1, default=0.9)
    traffic_volume: float = Field(ge=0, default=1.0)


class SyncIntervalResponse(BaseModel):
    sync_interval_seconds: float


class DemandForecastRequest(BaseModel):
    listing_id: str
    hour_of_day: int = Field(ge=0, le=23, default=12)
    seasonality: float = Field(ge=0, le=1, default=0.5)
    traffic: float = Field(ge=0, default=1.0)


class DemandForecastResponse(BaseModel):
    demand_score: float


def _load_risk_model():
    if RISK_MODEL_PATH.exists():
        return joblib.load(RISK_MODEL_PATH)
    return None


def _risk_features(req: RiskScoreRequest) -> np.ndarray:
    return np.array(
        [
            [
                req.time_to_sync,
                req.platform_latency,
                req.demand_score,
                float(req.concurrent_requests),
                1.0 - req.platform_reliability,
            ]
        ],
        dtype=np.float64,
    )


def _heuristic_risk(req: RiskScoreRequest) -> float:
    lat = min(req.platform_latency / 5.0, 1.0)
    sync = min(req.time_to_sync / 10.0, 1.0)
    demand = req.demand_score
    conc = min(req.concurrent_requests / 20.0, 1.0)
    rel = 1.0 - req.platform_reliability
    raw = 0.25 * lat + 0.2 * sync + 0.25 * demand + 0.2 * conc + 0.1 * rel
    return float(max(0.0, min(1.0, raw)))


def _action_from_score(score: float) -> tuple[str, int]:
    if score > 0.8:
        return "HARD_LOCK", 60
    if score > 0.5:
        return "SOFT_LOCK", 30
    return "ALLOW", 10


app = FastAPI(title="SwyftBooking AI Services", version="1.0.0")
_risk_model = _load_risk_model()


@app.get("/health")
def health():
    return {"status": "ok", "risk_model_loaded": _risk_model is not None}


@app.post("/risk-score", response_model=RiskScoreResponse)
def risk_score(req: RiskScoreRequest):
    if _risk_model is not None:
        try:
            proba = _risk_model.predict_proba(_risk_features(req))[0]
            score = float(proba[1] if len(proba) > 1 else proba[0])
        except Exception:
            score = _heuristic_risk(req)
    else:
        score = _heuristic_risk(req)
    action, lock_sec = _action_from_score(score)
    lock_duration = lock_sec
    if os.getenv("AI_DYNAMIC_LOCK", "1") == "1":
        lock_duration = int(max(10, min(120, round(lock_sec * (0.5 + score)))))
    return RiskScoreResponse(
        risk_score=score, action=action, lock_duration_sec=lock_duration
    )


@app.post("/availability-probability", response_model=AvailabilityProbResponse)
def availability_probability(req: AvailabilityProbRequest):
    stale = min(req.last_sync_seconds_ago / 300.0, 1.0)
    lat = min(req.platform_latency / 5.0, 1.0)
    fail = 1.0 - req.api_success_rate
    traffic = min(req.traffic_spike + req.listing_popularity * 0.3, 1.0)
    p = 1.0 - (0.25 * stale + 0.2 * lat + 0.25 * fail + 0.15 * traffic)
    p = float(max(0.05, min(0.99, p)))
    block = p < 0.85
    return AvailabilityProbResponse(
        availability_probability=p,
        block_temporarily=block,
        trigger_priority_sync=block or p < 0.92,
    )


@app.post("/sync-interval", response_model=SyncIntervalResponse)
def sync_interval(req: SyncIntervalRequest):
    if req.demand_score > 0.9:
        return SyncIntervalResponse(sync_interval_seconds=1.0)
    if req.risk_score > 0.7:
        return SyncIntervalResponse(sync_interval_seconds=3.0)
    base = 120.0 * (1.1 - req.platform_reliability)
    base = max(5.0, min(300.0, base))
    if req.traffic_volume > 2.0:
        base /= 2.0
    return SyncIntervalResponse(sync_interval_seconds=round(base, 2))


@app.post("/demand-forecast", response_model=DemandForecastResponse)
def demand_forecast(req: DemandForecastRequest):
    hour_factor = 0.5 + 0.5 * math.sin((req.hour_of_day - 6) * math.pi / 12)
    hour_factor = max(0.0, min(1.0, hour_factor))
    demand = 0.4 * hour_factor + 0.35 * req.seasonality + 0.25 * min(req.traffic / 5.0, 1.0)
    return DemandForecastResponse(demand_score=float(max(0.0, min(1.0, demand))))


class PlatformReliabilityRequest(BaseModel):
    api_success_rate: float = Field(ge=0, le=1, default=0.95)
    average_latency_ms: float = Field(ge=0, default=200.0)
    failure_rate: float = Field(ge=0, le=1, default=0.02)
    timeout_rate: float = Field(ge=0, le=1, default=0.01)


@app.post("/platform-reliability")
def platform_reliability(req: PlatformReliabilityRequest):
    lat_pen = min(req.average_latency_ms / 2000.0, 0.5)
    score = (
        req.api_success_rate
        * (1.0 - req.failure_rate * 2)
        * (1.0 - req.timeout_rate * 2)
        - lat_pen
    )
    return {"platform_score": float(max(0.0, min(1.0, score)))}
