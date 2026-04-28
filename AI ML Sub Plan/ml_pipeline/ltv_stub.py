"""GAP 9 — user lifetime value optimization (advanced)."""

from __future__ import annotations


def lifetime_value_stub(user_bookings_90d: int, revenue_90d: float) -> float:
    """Placeholder LTV until calibrated model exists."""
    return revenue_90d * (1.0 + 0.05 * user_bookings_90d)
