"""Enforce max promoted listings per host (doc §3 deterministic foundation)."""

from __future__ import annotations


def clip_promotion_weight_by_cap(
    promotion_weight: float,
    host_promoted_count: int | None,
    host_max_promoted_listings: int | None,
) -> float:
    """If host is at or above cap, strip paid promotion weight (cannot exceed plan limits)."""
    if host_max_promoted_listings is None or host_promoted_count is None:
        return promotion_weight
    if host_promoted_count >= host_max_promoted_listings:
        return 0.0
    return promotion_weight
