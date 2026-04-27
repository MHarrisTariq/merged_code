"""
Training entrypoint for booking probability model artifacts.

This is intentionally lightweight: the repo currently does not contain conversion
labels, so training is optional and the serving path has a safe baseline.

If you *do* have labels, provide a CSV with a `booked` column (0/1) and a `price`
column (candidate price shown to the customer). This script will fit a simple
logistic regression and write artifacts to `models/car_probability/`.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from probability_model import DEFAULT_PROB_MODEL_DIR


def _sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-z))


def train_probability(
    csv_path: str | Path,
    *,
    output_dir: str | Path | None = None,
) -> dict:
    p = Path(csv_path)
    df = pd.read_csv(p)
    if "booked" not in df.columns:
        raise ValueError("Training data must include column: booked (0/1)")
    if "price" not in df.columns:
        raise ValueError("Training data must include column: price")

    y = df["booked"].astype(int).values
    price = pd.to_numeric(df["price"], errors="coerce").fillna(df["price"].median()).astype(float).values
    rental_length = (
        pd.to_numeric(df.get("rental_length", 1.0), errors="coerce")
        .fillna(1.0)
        .astype(float)
        .values
    )
    rating = (
        pd.to_numeric(df.get("average", 6.0), errors="coerce")
        .fillna(6.0)
        .astype(float)
        .values
    )
    is_weekend_start = (
        pd.to_numeric(df.get("is_weekend_start", 0.0), errors="coerce")
        .fillna(0.0)
        .astype(float)
        .values
    )

    X = np.column_stack(
        [
            np.log(np.maximum(price, 0.01)),
            np.log(np.maximum(rental_length, 1.0)),
            (rating - 6.0),
            is_weekend_start,
        ]
    )

    clf = LogisticRegression(max_iter=500)
    clf.fit(X, y)

    # Map coefficients to the serving model's names (absolute price form).
    coeffs = {
        "intercept": float(clf.intercept_[0]),
        "log_price": float(clf.coef_[0, 0]),
        "log_rental_length": float(clf.coef_[0, 1]),
        "rating": float(clf.coef_[0, 2]),
        "is_weekend_start": float(clf.coef_[0, 3]),
    }

    # Quick training metrics (not a full eval pipeline).
    p_hat = _sigmoid(clf.decision_function(X))
    brier = float(np.mean((p_hat - y) ** 2))

    out_dir = Path(output_dir) if output_dir else DEFAULT_PROB_MODEL_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "coefficients.json").write_text(json.dumps(coeffs, indent=2), encoding="utf-8")
    (out_dir / "meta.json").write_text(
        json.dumps(
            {
                "name": "LogisticRegression",
                "version": "v1",
                "trained_on": str(p.name),
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "metrics": {"brier": brier, "n": int(len(df))},
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    return {"coefficients": coeffs, "metrics": {"brier": brier, "n": int(len(df))}, "output_dir": str(out_dir)}


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="CSV with columns booked(0/1), price, optional features.")
    ap.add_argument("--out", default=None, help="Output directory (default: models/car_probability)")
    args = ap.parse_args()

    res = train_probability(args.data, output_dir=args.out)
    print(json.dumps(res, indent=2))

