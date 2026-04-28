"""
Revenue optimizer + simulation.

Objective from client requirements:
  expected_revenue(price) = price * booking_probability(price, context)

This module evaluates multiple candidate prices and selects the argmax under
min/max/step constraints (plus optional guardrails).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Callable, Iterable


@dataclass(frozen=True)
class CandidateEvaluation:
    price_gbp: float
    booking_probability: float
    expected_revenue: float


def _frange(start: float, stop: float, step: float) -> Iterable[float]:
    if step <= 0:
        raise ValueError("step must be > 0")
    if stop < start:
        return []
    n = int(math.floor((stop - start) / step)) + 1
    for i in range(n):
        yield start + i * step


def simulate_price_sweep(
    booking: dict[str, Any],
    *,
    min_price_gbp: float,
    max_price_gbp: float,
    step_gbp: float,
    booking_probability_fn: Callable[[dict[str, Any], float], float],
) -> list[CandidateEvaluation]:
    out: list[CandidateEvaluation] = []
    for p in _frange(float(min_price_gbp), float(max_price_gbp), float(step_gbp)):
        p = float(p)
        prob = float(booking_probability_fn(booking, p))
        if prob < 0.0:
            prob = 0.0
        if prob > 1.0:
            prob = 1.0
        out.append(
            CandidateEvaluation(
                price_gbp=p,
                booking_probability=prob,
                expected_revenue=p * prob,
            )
        )
    return out


def optimize_price(
    booking: dict[str, Any],
    *,
    min_price_gbp: float,
    max_price_gbp: float,
    step_gbp: float,
    booking_probability_fn: Callable[[dict[str, Any], float], float],
) -> tuple[CandidateEvaluation, list[CandidateEvaluation]]:
    evals = simulate_price_sweep(
        booking,
        min_price_gbp=min_price_gbp,
        max_price_gbp=max_price_gbp,
        step_gbp=step_gbp,
        booking_probability_fn=booking_probability_fn,
    )
    if not evals:
        raise ValueError("No candidates generated; check min/max/step.")

    best = max(evals, key=lambda e: (e.expected_revenue, e.booking_probability, -e.price_gbp))
    return best, evals

