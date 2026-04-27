"""Auto-Allocation Engine (doc §9): Platinum — rotate promotions when performance drops."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ListingPerformance:
    listing_id: str
    ctr_7d: float
    conversion_7d: float


def should_replace_listing(
    perf: ListingPerformance,
    *,
    ctr_floor: float = 0.01,
    cvr_floor: float = 0.02,
) -> bool:
    """If listing_performance drops below floor, trigger replace_with_better_listing()."""
    return perf.ctr_7d < ctr_floor or perf.conversion_7d < cvr_floor


def replace_with_better_listing(
    candidates: list[ListingPerformance],
    active_listing_id: str,
) -> str | None:
    """Pick next best candidate not currently active (stub selection = max ctr)."""
    others = [p for p in candidates if p.listing_id != active_listing_id]
    if not others:
        return None
    best = max(others, key=lambda p: p.ctr_7d)
    return best.listing_id
