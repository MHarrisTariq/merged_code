"""GAP 8 — supply/demand, elasticity, cross-listing competition (advanced)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class MarketContext:
    market_demand_index: float
    supply_listings_count: int


def price_elasticity_hint(ctx: MarketContext) -> float:
    """Return -1..0 style elasticity placeholder."""
    return -0.3 * min(1.0, ctx.supply_listings_count / max(ctx.market_demand_index, 1e-6))
