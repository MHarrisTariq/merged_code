from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PricingDecision:
    recommended_price: float
    confidence_score: float
    explanation_tags: list[str]
    price_components: dict[str, float]


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def build_pricing_decision(
    booking: dict[str, Any],
    *,
    baseline_price_gbp: float,
) -> PricingDecision:
    """
    Deterministic market component layer that complements model-based pricing.
    """

    base = max(float(baseline_price_gbp), 0.01)

    month = int(float(booking.get("start_month", 0) or 0))
    is_weekend = float(booking.get("is_weekend_start", 0.0) or 0.0) > 0
    lead = float(booking.get("date_offset_num", 0.0) or 0.0)
    quality = float(booking.get("quality_score", 6.0) or 6.0)
    ratings_volume = float(booking.get("ratings_volume", 0.0) or 0.0)
    rental_len = float(booking.get("rental_length_num", 1.0) or 1.0)

    demand_factor = 1.0 + (0.08 if is_weekend else 0.0)
    if rental_len <= 2:
        demand_factor += 0.03
    demand_factor = _clamp(demand_factor, 0.9, 1.2)

    if month in {6, 7, 8, 12}:
        seasonality_factor = 1.12
    elif month in {4, 5, 9, 10}:
        seasonality_factor = 1.05
    else:
        seasonality_factor = 0.97 if month else 1.0

    if lead <= 2:
        lead_time_factor = 1.07
    elif lead >= 30:
        lead_time_factor = 0.95
    else:
        lead_time_factor = 1.0

    quality_norm = _clamp((quality - 6.0) / 4.0, -0.5, 0.5)
    quality_factor = 1.0 + 0.12 * quality_norm

    # Higher ratings volume is treated as a competitive-supply pressure proxy.
    if ratings_volume > 2000:
        supply_factor = 0.96
    elif ratings_volume < 200:
        supply_factor = 1.03
    else:
        supply_factor = 1.0

    raw = base * demand_factor * seasonality_factor * lead_time_factor * quality_factor * supply_factor
    recommended = round(float(raw), 2)

    tags: list[str] = []
    if demand_factor > 1.03:
        tags.append("high_demand")
    if seasonality_factor > 1.08:
        tags.append("peak_season")
    if lead_time_factor > 1.03:
        tags.append("short_lead_time")
    if lead_time_factor < 0.98:
        tags.append("early_booking_discount")
    if quality_factor > 1.02:
        tags.append("high_quality_listing")
    if supply_factor < 0.99:
        tags.append("high_competitive_supply")
    if not tags:
        tags.append("standard_market_conditions")

    # Confidence decreases with large deterministic override away from model baseline.
    deviation = abs(recommended - base) / max(base, 1e-6)
    confidence = float(round(_clamp(1.0 - deviation, 0.35, 0.98), 2))

    components = {
        "base_model_price": round(base, 2),
        "demand_factor": round(demand_factor, 4),
        "seasonality_factor": round(seasonality_factor, 4),
        "lead_time_factor": round(lead_time_factor, 4),
        "quality_factor": round(quality_factor, 4),
        "supply_factor": round(supply_factor, 4),
        "engine_price": recommended,
    }

    return PricingDecision(
        recommended_price=recommended,
        confidence_score=confidence,
        explanation_tags=tags,
        price_components=components,
    )

