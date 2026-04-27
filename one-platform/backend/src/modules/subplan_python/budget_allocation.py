"""Budget Allocation Engine (doc §4 module 5, advanced) — spend vs expected return."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class BudgetAllocationInput:
    budget_cents: int
    expected_cost_per_impression_cents: float
    expected_impressions: int
    roi_score: float


def allocate_spend(inp: BudgetAllocationInput) -> dict[str, float]:
    """Return recommended daily cap fraction [0,1] and expected spend."""
    expected_spend = inp.expected_impressions * inp.expected_cost_per_impression_cents
    cap = min(1.0, inp.budget_cents / max(expected_spend, 1e-6))
    return {"spend_cap_fraction": cap, "expected_spend_cents": expected_spend, "roi_score": inp.roi_score}
