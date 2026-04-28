"""Deterministic layer: plans, subscription lifecycle, promotion_weight bounds."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .config import ScoringConfig


class PlanId(str, Enum):
    FREE = "FREE"
    SILVER = "SILVER"
    PLATINUM = "PLATINUM"


class SubscriptionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    PENDING = "PENDING"


@dataclass
class DeterministicContext:
    plan_id: str
    subscription_status: str
    promotion_weight: float


def effective_promotion_weight(ctx: DeterministicContext, cfg: ScoringConfig) -> float:
    """AI cannot grant boost if subscription is not active."""
    if ctx.subscription_status != SubscriptionStatus.ACTIVE.value:
        return 0.0
    w = max(0.0, float(ctx.promotion_weight))
    if ctx.plan_id == PlanId.FREE.value:
        return min(w, cfg.min_promotion_weight_free) * 1.0
    if ctx.plan_id == PlanId.SILVER.value:
        return w * cfg.plan_boost_silver
    if ctx.plan_id == PlanId.PLATINUM.value:
        return w * cfg.plan_boost_platinum
    return w
