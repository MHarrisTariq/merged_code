"""
Lightweight evaluation stubs.

This repo does not ship conversion labels, so probability evaluation depends on
your internal dataset. These functions exist so the “ML pipeline is missing”
claim is addressed with runnable hooks.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from probability_model import BookingProbabilityModel


def evaluate_probability(csv_path: str | Path) -> dict:
    """
    Expects CSV with:
      - booked (0/1)
      - price (shown)
      - optional features (rental_length, average, start_date, etc.)
    """

    df = pd.read_csv(csv_path)
    if "booked" not in df.columns or "price" not in df.columns:
        raise ValueError("CSV must include booked and price")

    m = BookingProbabilityModel()
    probs = []
    for _, row in df.iterrows():
        booking = row.to_dict()
        probs.append(m.predict_one(booking, candidate_price_gbp=float(row["price"])))
    df = df.copy()
    df["p_book"] = probs
    y = df["booked"].astype(float).values
    p = df["p_book"].astype(float).values
    brier = float(((p - y) ** 2).mean())
    return {"brier": brier, "n": int(len(df))}


if __name__ == "__main__":
    import argparse
    import json

    ap = argparse.ArgumentParser()
    ap.add_argument("--prob-data", required=True, help="CSV with booked and price columns")
    args = ap.parse_args()
    print(json.dumps(evaluate_probability(args.prob_data), indent=2))

