"""Shared fraud scoring for demand metrics (no api-gateway dependency)."""

from __future__ import annotations

import os

_SPIKE_MULT = float(os.environ.get("FRAUD_VIEW_SPIKE_MULT", "10.0"))
_REGIONAL_AVG = int(os.environ.get("FRAUD_REGIONAL_AVG_VIEWS", "100"))


def fraud_score_for_listing(*, views: int, clicks: int) -> float:
    if views <= 0:
        return 0.0
    if views > _SPIKE_MULT * _REGIONAL_AVG:
        return min(1.0, views / float(_SPIKE_MULT * _REGIONAL_AVG) * 0.4)
    if clicks > views:
        return 0.5
    return 0.0
