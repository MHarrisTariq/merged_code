"""Delayed feedback utilities — time-decayed rewards and attribution windows (GAP-DELAY)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class AttributionConfig:
    booking_window_days: int = 14


def within_attribution(
    click_time: datetime,
    booking_time: datetime,
    cfg: AttributionConfig | None = None,
) -> bool:
    cfg = cfg or AttributionConfig()
    delta = booking_time - click_time
    return timedelta(0) <= delta <= timedelta(days=cfg.booking_window_days)


def decay_weight(elapsed_days: float, half_life_days: float = 7.0) -> float:
    """Exponential decay for reward weighting."""
    import math

    return math.exp(-math.log(2) * elapsed_days / half_life_days)


# GAP 6 — survival / time-to-booking models can replace fixed windows for late conversions.
