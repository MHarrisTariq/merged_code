from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib

from car_rental_service import DEFAULT_MODEL_DIR
from probability_model import DEFAULT_PROB_MODEL_DIR, BookingProbabilityModel


REGISTRY_PATH = Path(__file__).resolve().parent / "models" / "registry.json"


def _safe_load_joblib(p: Path) -> Any | None:
    try:
        return joblib.load(p)
    except Exception:
        return None


def snapshot_registry() -> dict[str, Any]:
    price_meta = _safe_load_joblib(DEFAULT_MODEL_DIR / "model_meta.pkl") or {}
    prob = BookingProbabilityModel(DEFAULT_PROB_MODEL_DIR)

    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "price_model": {
            "dir": str(DEFAULT_MODEL_DIR),
            "meta": price_meta,
        },
        "probability_model": {
            "dir": str(DEFAULT_PROB_MODEL_DIR),
            "version": prob.model_version_label(),
        },
    }


def write_registry(path: str | Path | None = None) -> str:
    out = Path(path) if path else REGISTRY_PATH
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(snapshot_registry(), indent=2), encoding="utf-8")
    return str(out)


if __name__ == "__main__":
    p = write_registry()
    print(f"Wrote registry: {p}")

