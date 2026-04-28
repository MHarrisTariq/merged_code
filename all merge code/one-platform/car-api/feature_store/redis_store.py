from __future__ import annotations

import json
import os
from typing import Any

from feature_store.base import FeatureRecord, FeatureStore


def _get_redis():
    url = os.environ.get("REDIS_URL")
    if not url:
        return None
    try:
        import redis  # type: ignore
    except ImportError:
        return None
    return redis.from_url(url, decode_responses=True)


class RedisFeatureStore(FeatureStore):
    def __init__(self, *, namespace: str = "pricing:features:v1"):
        self.namespace = namespace

    def _k(self, key: str) -> str:
        return f"{self.namespace}:{key}"

    def get(self, key: str) -> FeatureRecord | None:
        r = _get_redis()
        if r is None:
            return None
        try:
            blob = r.get(self._k(key))
        except Exception:
            return None
        if not blob:
            return None
        try:
            feats = json.loads(blob)
        except json.JSONDecodeError:
            return None
        return FeatureRecord(key=key, features=dict(feats))

    def set(self, key: str, features: dict[str, Any], *, ttl_sec: int) -> None:
        r = _get_redis()
        if r is None:
            return
        try:
            r.setex(self._k(key), int(ttl_sec), json.dumps(features, default=str))
        except Exception:
            return

