"""Doc §1 — revenue / pricing optimization hook (optional product layer; not same as subscription price)."""

from __future__ import annotations


def suggested_listing_price_stub(base_price: float, demand_index: float) -> float:
    """Placeholder dynamic pricing suggestion; combine with market_dynamics_stub in training."""
    return max(0.0, base_price * (0.95 + 0.1 * min(1.0, demand_index)))
