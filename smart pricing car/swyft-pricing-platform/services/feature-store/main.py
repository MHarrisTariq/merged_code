"""Feature store HTTP API (Redis-backed) — health + optional debug endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel

from redis_store import get_features, invalidate, set_features

app = FastAPI(title="Swyft Feature Store", version="1.0.0")
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


class FeaturesPayload(BaseModel):
    features: dict[str, Any]
    ttl: int = 3600


@app.get("/health")
def health():
    return {"ok": True, "service": "feature-store"}


@app.get("/features/{listing_id}")
def read_features(listing_id: str):
    data = get_features(listing_id)
    if data is None:
        raise HTTPException(status_code=404, detail="not found")
    return {"listing_id": listing_id, "features": data}


@app.put("/features/{listing_id}")
def write_features(listing_id: str, body: FeaturesPayload):
    set_features(listing_id, body.features, ttl=body.ttl)
    return {"ok": True}


@app.delete("/features/{listing_id}")
def del_features(listing_id: str):
    invalidate(listing_id)
    return {"ok": True}
