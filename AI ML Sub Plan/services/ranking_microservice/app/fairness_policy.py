"""Fairness & guardrails (doc §16): paid advantage without unfair suppression of Free tier."""

from __future__ import annotations

from .deterministic import PlanId


def apply_free_tier_floor(
    score: float,
    plan_id: str,
    *,
    organic_score_baseline: float = 1.0,
    floor_ratio_vs_organic: float = 0.92,
) -> float:
    """
    Doc §16: no unfair suppression of Free users — keep score at least a fraction of an
    organic baseline (tune with product). Paid boosts remain on top via deterministic layer.
    """
    if plan_id != PlanId.FREE.value:
        return score
    floor = floor_ratio_vs_organic * max(organic_score_baseline, 1e-9)
    return max(score, floor)
