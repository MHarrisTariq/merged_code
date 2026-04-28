"""
Booking probability model (baseline + artifact-backed).

This repo originally predicts price only. The client requirements also need:
  expected_revenue(price) = price * P(book | price, context)

We implement a minimal probability model that:
- Can run immediately (baseline coefficients).
- Can be trained later when real conversion labels exist (artifacts saved under models/).
"""

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DEFAULT_PROB_MODEL_DIR = Path(__file__).resolve().parent / "models" / "car_probability"


def _sigmoid(z: float) -> float:
    # Numerically stable sigmoid.
    if z >= 0:
        ez = math.exp(-z)
        return 1.0 / (1.0 + ez)
    ez = math.exp(z)
    return ez / (1.0 + ez)


def _clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


@dataclass(frozen=True)
class ProbModelMeta:
    name: str
    version: str
    trained_on: str | None = None


class BookingProbabilityModel:
    """
    A lightweight model for P(book | price, context).

    Baseline uses a simple logistic function with interpretable coefficients. If a
    `coefficients.json` artifact exists, it is loaded and used instead.
    """

    def __init__(self, model_dir: Path | str | None = None):
        self.model_dir = Path(model_dir) if model_dir else DEFAULT_PROB_MODEL_DIR
        self.meta = ProbModelMeta(name="BaselineLogit", version="v1")
        self.coeffs: dict[str, float] = self._default_coeffs()

        coeff_path = self.model_dir / "coefficients.json"
        meta_path = self.model_dir / "meta.json"
        if coeff_path.is_file():
            self.coeffs = json.loads(coeff_path.read_text(encoding="utf-8"))
        if meta_path.is_file():
            try:
                m = json.loads(meta_path.read_text(encoding="utf-8"))
                self.meta = ProbModelMeta(
                    name=str(m.get("name", self.meta.name)),
                    version=str(m.get("version", self.meta.version)),
                    trained_on=m.get("trained_on"),
                )
            except Exception:
                # Keep defaults if meta is malformed.
                pass

    @staticmethod
    def _default_coeffs() -> dict[str, float]:
        """
        Baseline coefficients tuned for sane behavior:
        - Higher price lowers probability.
        - Longer rentals slightly lower probability.
        - Better ratings slightly increase probability.
        - Weekends slightly higher probability.
        """

        # NOTE: This is a baseline only. Replace via `train_probability.py` once labels exist.
        return {
            "intercept": -0.2,
            "log_price": -1.1,
            "log_rental_length": -0.15,
            "rating": 0.08,
            "is_weekend_start": 0.12,
        }

    def model_version_label(self) -> str:
        return f"{self.meta.name}:{self.meta.version}"

    def predict_one(
        self,
        booking: dict[str, Any],
        *,
        candidate_price_gbp: float,
        reference_price_gbp: float | None = None,
    ) -> float:
        """
        Compute P(book) for a given candidate price.

        `reference_price_gbp` is optional and, when provided, makes the model respond
        to relative pricing (candidate vs baseline price model output).
        """

        price = max(float(candidate_price_gbp), 0.01)
        rl = max(float(booking.get("rental_length", 1.0) or 1.0), 1.0)
        rating = float(booking.get("average", 6.0) or 6.0)

        # Weekend signal if present as derived flag; else approximate from start_date if user provides it.
        wk = float(booking.get("is_weekend_start", 0.0) or 0.0)

        z = float(self.coeffs.get("intercept", 0.0))

        # Use relative price if reference provided.
        if reference_price_gbp and reference_price_gbp > 0:
            rel = price / float(reference_price_gbp)
            z += float(self.coeffs.get("log_price", -1.0)) * math.log(rel)
        else:
            z += float(self.coeffs.get("log_price", -1.0)) * math.log(price)

        z += float(self.coeffs.get("log_rental_length", 0.0)) * math.log(rl)
        z += float(self.coeffs.get("rating", 0.0)) * (rating - 6.0)
        z += float(self.coeffs.get("is_weekend_start", 0.0)) * wk

        # Optional temperature override for demos.
        temp = float(os.environ.get("PROB_MODEL_TEMPERATURE", "1.0") or 1.0)
        if temp <= 0:
            temp = 1.0

        p = _sigmoid(z / temp)
        return _clamp01(float(p))

