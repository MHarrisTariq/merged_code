from __future__ import annotations

from probability_model import BookingProbabilityModel


def test_probability_is_between_0_and_1():
    m = BookingProbabilityModel(model_dir=None)
    p = m.predict_one({"rental_length": 2, "average": 7.0}, candidate_price_gbp=100.0, reference_price_gbp=80.0)
    assert 0.0 <= p <= 1.0

