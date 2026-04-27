from __future__ import annotations

from optimizer import optimize_price


def test_optimize_price_picks_best_expected_revenue():
    booking = {"rental_length": 2}

    # Make probability drop linearly with price.
    def prob_fn(_b: dict, p: float) -> float:
        return max(0.0, min(1.0, 1.0 - p / 100.0))

    best, evals = optimize_price(
        booking,
        min_price_gbp=10.0,
        max_price_gbp=90.0,
        step_gbp=10.0,
        booking_probability_fn=prob_fn,
    )

    assert len(evals) == 9
    assert best.price_gbp == 50.0
    assert best.expected_revenue == max(e.expected_revenue for e in evals)

