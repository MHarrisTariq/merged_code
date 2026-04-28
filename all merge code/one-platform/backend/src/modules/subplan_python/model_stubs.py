"""
Placeholder predictors. Replace with MLflow-loaded LightGBM/XGBoost or ONNX.
Training parity: feature keys must match ml_pipeline/feature_contract.yaml
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np


@dataclass
class PredictionContext:
    listing_id: str
    position: int
    device_type: str
    price: float
    listing_quality: float


class CTRModelStub:
    """P(click | listing, position, context) — higher position → higher naive CTR (bias demo)."""

    name = "ctr_stub"

    def predict(self, ctx: PredictionContext) -> float:
        position = max(0, ctx.position)
        position_prior = 1.0 / (1.0 + position * 0.15)
        quality = 0.5 + 0.5 * np.clip(ctx.listing_quality, 0.0, 1.0)
        raw = position_prior * quality * (1.0 - 0.0001 * max(0.0, ctx.price))
        return float(np.clip(raw * 0.12, 0.001, 0.5))


class ConversionModelStub:
    """P(booking | click)."""

    name = "cvr_stub"

    def predict(self, ctx: PredictionContext) -> float:
        q = np.clip(ctx.listing_quality, 0.0, 1.0)
        return float(np.clip(0.05 + 0.15 * q, 0.01, 0.6))


class PersonalizationStub:
    """User-listing affinity in [0, 1]."""

    name = "personalization_stub"

    def weight(self, user_id: str | None, listing_id: str) -> float:
        if not user_id:
            return 0.5
        h = hash(user_id + listing_id) % 10000
        return 0.3 + 0.7 * (h / 10000.0)


def expected_value(pred_ctr: float, pred_cvr: float, price: float) -> float:
    return pred_ctr * pred_cvr * max(price, 0.0)
