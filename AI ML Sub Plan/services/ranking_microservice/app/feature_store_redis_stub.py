"""Feature store — Redis real-time layer (doc §15). Replace with redis-py + cluster config."""

from __future__ import annotations

from typing import Any


class RedisFeatureStoreStub:
    def __init__(self) -> None:
        self._mem: dict[str, Any] = {}

    def get_features(self, key: str) -> dict[str, Any] | None:
        return self._mem.get(key)

    def set_features(self, key: str, payload: dict[str, Any], ttl_seconds: int = 300) -> None:
        _ = ttl_seconds
        self._mem[key] = payload
