"""Price grid search using trained LightGBM classifier."""

from __future__ import annotations

from typing import Any

import numpy as np

from ml.elasticity.train import FEATURE_COLS

try:
    import lightgbm as lgb
except ImportError:
    lgb = None  # type: ignore


def optimize_price(
    model: Any,
    base_features: dict[str, float],
    min_price: float,
    max_price: float,
    *,
    step: float = 5.0,
) -> tuple[float, float, list[dict[str, float]]]:
    if lgb is None or model is None:
        curve = []
        best_p, best_r = min_price, 0.0
        p = min_price
        while p <= max_price:
            rev = p * 0.5
            curve.append({"price": p, "p_book": 0.5, "expected_revenue": rev})
            if rev >= best_r:
                best_r, best_p = rev, p
            p += step
        return best_p, best_r, curve

    curve: list[dict[str, float]] = []
    best_price = min_price
    best_revenue = -1.0
    p = float(min_price)
    while p <= float(max_price):
        row = dict(base_features)
        row["price"] = float(p)
        X = np.array([[float(row.get(c, 0.0)) for c in FEATURE_COLS]])
        prob = float(model.predict(X)[0])
        er = p * prob
        curve.append({"price": p, "p_book": prob, "expected_revenue": er})
        if er > best_revenue:
            best_revenue = er
            best_price = p
        p += step
    return best_price, best_revenue, curve
