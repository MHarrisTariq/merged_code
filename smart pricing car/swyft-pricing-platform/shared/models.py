"""Shared Pydantic / dataclass models for cross-service payloads."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class DemandMetricPayload(BaseModel):
    listing_id: str
    date: str
    views: int = 0
    clicks: int = 0
    bookings: int = 0
    conversion_rate: float = 0.0
    fraud_score: float = 0.0
    asset_type: Literal["car", "property", "flight", "bundle"] = "car"


class PricingComputePayload(BaseModel):
    listing_id: str
    base_price: float
    min_price: float
    max_price: float
    demand_score: float = 0.0
    supply_score: float = 0.0
    target_date: str | None = None
    confidence_score: float | None = None
    model_version: str | None = None
    asset_type: Literal["car", "property", "flight", "bundle"] = "car"


class PricingRecommendationPayload(BaseModel):
    listing_id: str
    price: float
    date: str | None = None
    confidence_score: float | None = None
    model_version: str | None = None
    asset_type: Literal["car", "property", "flight", "bundle"] = "car"


class ListingEvent(BaseModel):
    listing_id: str
    user_id: str
    timestamp: str
    asset_type: Literal["car", "property", "flight", "bundle"] = "car"
    extra: dict[str, Any] = Field(default_factory=dict)
