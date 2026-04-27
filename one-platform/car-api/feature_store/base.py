from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class FeatureRecord:
    key: str
    features: dict[str, Any]


class FeatureStore(Protocol):
    def get(self, key: str) -> FeatureRecord | None: ...

    def set(self, key: str, features: dict[str, Any], *, ttl_sec: int) -> None: ...

