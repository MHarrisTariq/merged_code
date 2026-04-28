"""Promotion optimization: roi_score = expected_revenue / promotion_cost (doc §8)."""

from __future__ import annotations


def roi_score(expected_revenue: float, promotion_cost: float) -> float:
    if promotion_cost <= 0:
        return float("inf") if expected_revenue > 0 else 0.0
    return expected_revenue / promotion_cost
