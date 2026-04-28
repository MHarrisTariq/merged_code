"""MongoDB collection shapes (documentation + validation helpers)."""

from __future__ import annotations

from typing import Any, TypedDict


class DemandSignalsDoc(TypedDict, total=False):
    listing_id: str
    date: str
    views: int
    clicks: int
    bookings: int
    conversion_rate: float
    fraud_score: float
    asset_type: str


class SupplyMetricsDoc(TypedDict, total=False):
    region: str
    date: str
    available_listings: int
    avg_price: float
    occupancy_rate: float
    asset_type: str


class PriceAuditLogDoc(TypedDict, total=False):
    listing_id: str
    date: str
    old_price: float
    new_price: float
    reason: list[str]
    timestamp: str
    asset_type: str


COLLECTIONS = {
    "demand_signals": DemandSignalsDoc,
    "supply_metrics": SupplyMetricsDoc,
    "price_audit_log": PriceAuditLogDoc,
}


def validate_demand_signals(doc: dict[str, Any]) -> bool:
    return "listing_id" in doc and "date" in doc
