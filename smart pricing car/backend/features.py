from __future__ import annotations

from datetime import datetime
from typing import Any


def derive_request_features(booking: dict[str, Any]) -> dict[str, Any]:
    """
    Canonical lightweight feature derivation for online paths.

    This is intentionally small; the heavy feature matrix for the price model
    remains in `car.prepare_features`.
    """

    out: dict[str, Any] = {}
    start_date = booking.get("start_date")
    if start_date:
        try:
            d = datetime.fromisoformat(str(start_date))
            out["start_dayofweek"] = d.weekday()
            out["is_weekend_start"] = 1.0 if d.weekday() >= 5 else 0.0
            out["start_month"] = d.month
        except Exception:
            pass
    date_offset = booking.get("date_offset")
    if date_offset is not None:
        try:
            out["date_offset_num"] = float(date_offset)
        except Exception:
            pass

    try:
        out["quality_score"] = float(booking.get("average", 6.0) or 6.0)
    except Exception:
        out["quality_score"] = 6.0

    try:
        out["rental_length_num"] = float(booking.get("rental_length", 1.0) or 1.0)
    except Exception:
        out["rental_length_num"] = 1.0

    try:
        out["ratings_volume"] = float(booking.get("no_of_ratings", 0.0) or 0.0)
    except Exception:
        out["ratings_volume"] = 0.0
    return out

