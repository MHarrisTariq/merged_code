"""Online feature store (Redis)."""

from __future__ import annotations

import json
import os
from typing import Any

import redis

from shared.config import redis_url


def _client() -> redis.Redis:
    return redis.from_url(redis_url())


def get_features(listing_id: str) -> dict[str, Any] | None:
    r = _client()
    raw = r.get(f"features:{listing_id}")
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return json.loads(raw)


def set_features(listing_id: str, features: dict[str, Any], ttl: int = 3600) -> None:
    r = _client()
    r.setex(f"features:{listing_id}", ttl, json.dumps(features, default=str))


def invalidate(listing_id: str) -> None:
    r = _client()
    r.delete(f"features:{listing_id}")
