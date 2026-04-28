"""Canonical Kafka topic names for Swyft Pricing Platform."""

SEARCH_IMPRESSION = "search.impression"
LISTING_VIEWED = "listing.viewed"
LISTING_CLICKED = "listing.clicked"
BOOKING_COMPLETED = "booking.completed"
DEMAND_METRICS_UPDATED = "demand.metrics.updated"
SUPPLY_METRICS_UPDATED = "supply.metrics.updated"
PRICING_COMPUTE_REQUESTED = "pricing.compute.requested"
PRICING_RECOMMENDATION_GENERATED = "pricing.recommendation.generated"
PRICING_CALENDAR_UPDATED = "pricing.calendar.updated"

ALL_TOPICS = [
    SEARCH_IMPRESSION,
    LISTING_VIEWED,
    LISTING_CLICKED,
    BOOKING_COMPLETED,
    DEMAND_METRICS_UPDATED,
    SUPPLY_METRICS_UPDATED,
    PRICING_COMPUTE_REQUESTED,
    PRICING_RECOMMENDATION_GENERATED,
    PRICING_CALENDAR_UPDATED,
]
