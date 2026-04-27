"""Optional Redis cache for POST /quote responses (REDIS_URL)."""

from __future__ import annotations

import hashlib
import json
import os
from typing import Any

DEFAULT_TTL_SEC = int(os.environ.get("QUOTE_CACHE_TTL_SEC", "300"))


def _normalized_booking_key(booking: dict[str, Any], allow_proxies: bool) -> str:
    payload = {
        "b": booking,
        "proxies": allow_proxies,
    }
    raw = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_redis():
    url = os.environ.get("REDIS_URL")
    if not url:
        return None
    try:
        import redis  # type: ignore
    except ImportError:
        return None
    return redis.from_url(url, decode_responses=True)


def cache_get(booking: dict[str, Any], allow_proxies: bool) -> dict[str, Any] | None:
    r = get_redis()
    if r is None:
        return None
    key = "pricing:quote:v2:" + _normalized_booking_key(booking, allow_proxies)
    try:
        blob = r.get(key)
    except Exception:
        return None
    if not blob:
        return None
    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        return None


def cache_set(booking: dict[str, Any], allow_proxies: bool, value: dict[str, Any]) -> None:
    r = get_redis()
    if r is None:
        return
    key = "pricing:quote:v2:" + _normalized_booking_key(booking, allow_proxies)
    try:
        r.setex(key, DEFAULT_TTL_SEC, json.dumps(value, default=str))
    except Exception:
        pass
