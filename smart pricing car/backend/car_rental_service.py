"""
Car rental smart-pricing service: load trained artifacts from models/car and quote trip totals (GBP).
Requires running car.py training first (writes model_meta.pkl, encoders, and estimators).
"""

from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from car import (
    prepare_features,
    postprocess_raw_predictions,
    predict_segmented_totals,
)

# Columns expected by prepare_features() before drops (NaN-filled if omitted in API requests).
BOOKING_INPUT_COLUMNS = [
    "airport",
    "airport_iata",
    "country",
    "city",
    "rental_length",
    "start_date",
    "start_time",
    "return_date",
    "return_time",
    "date_offset",
    "mileage",
    "group",
    "transmission",
    "fuel_type",
    "supplier_name",
    "supplier_loction_type",
    "product_name",
    "doors",
    "seats",
    "airbags",
    "aircon",
    "free_cancellation",
    "dropoff_time",
    "pickup_time",
    "average",
    "cleanliness",
    "condition",
    "efficiency",
    "location",
    "value_for_money",
    "no_of_ratings",
    "deposit_price",
    "drive_away_price",
]

DEFAULT_MODEL_DIR = Path(__file__).resolve().parent / "models" / "car"


def _align_feature_matrix(X: pd.DataFrame, feature_cols: list[str]) -> pd.DataFrame:
    missing = [c for c in feature_cols if c not in X.columns]
    if missing:
        for c in missing:
            X[c] = 0.0
    return X[feature_cols].copy()


class CarRentalPricingService:
    """Load artifacts from a training run and produce total rental price estimates."""

    def __init__(self, model_dir: Path | str | None = None):
        self.model_dir = Path(model_dir) if model_dir else DEFAULT_MODEL_DIR
        if not (self.model_dir / "model_meta.pkl").is_file():
            raise FileNotFoundError(
                f"No model_meta.pkl in {self.model_dir}. Train first: python car.py"
            )

        self.meta: dict[str, Any] = joblib.load(self.model_dir / "model_meta.pkl")
        self.feature_cols: list[str] = joblib.load(self.model_dir / "feature_columns.pkl")
        self.encoders: dict = joblib.load(self.model_dir / "category_encoders.pkl")
        self.mode = self.meta.get("mode", "single")
        self.allow_proxies = bool(
            self.meta.get("allow_price_proxies", self.meta.get("demo_mode", False))
        )
        self.best_name = str(self.meta.get("best_name", "XGBoost"))

        if self.mode == "segmented":
            self.seg_models = joblib.load(self.model_dir / "smart_pricing_segment_models.pkl")
            self.global_model = joblib.load(self.model_dir / "smart_pricing_global_model.pkl")
            self.segment_cols: list[str] = list(self.meta["segment_cols"])
            self._main_model = None
            self._scaler = None
        elif self.best_name == "LSTM_LogTarget":
            import tensorflow as tf

            self._main_model = tf.keras.models.load_model(
                self.model_dir / "smart_pricing_lstm.keras"
            )
            self._scaler = joblib.load(self.model_dir / "feature_scaler.pkl")
            self.seg_models = None
            self.global_model = None
            self.segment_cols = []
        else:
            self._main_model = joblib.load(self.model_dir / "smart_pricing_model.pkl")
            self._scaler = None
            self.seg_models = None
            self.global_model = None
            self.segment_cols = []

    def model_version_label(self) -> str:
        return f"{self.meta.get('best_name', 'unknown')}:{self.mode}"

    def _prepare_X(self, df: pd.DataFrame) -> pd.DataFrame:
        X_all, _ = prepare_features(
            df,
            allow_price_proxies=self.allow_proxies,
            cat_encoders=self.encoders,
            for_inference=True,
            verbose=False,
        )
        if "price" in X_all.columns:
            X_all = X_all.drop(columns=["price"])
        return _align_feature_matrix(X_all, self.feature_cols)

    def quote_row(self, booking: dict[str, Any], *, min_gbp: float = 5.0, max_gbp: float = 8000.0) -> dict[str, Any]:
        quote_id = f"qte_{uuid.uuid4().hex[:16]}"
        mv = self.model_version_label()

        try:
            row = {k: booking.get(k) for k in BOOKING_INPUT_COLUMNS}
            df = pd.DataFrame([row])
            X = self._prepare_X(df)

            if self.mode == "segmented":
                raw_pred = float(
                    predict_segmented_totals(X, self.seg_models, self.global_model, self.segment_cols)[0]
                )
            elif self.best_name == "LSTM_LogTarget":
                arr = self._scaler.transform(X.values).reshape(len(X), 1, len(self.feature_cols))
                raw_out = self._main_model.predict(arr, verbose=0).reshape(-1)
                raw_pred = float(postprocess_raw_predictions("LSTM_LogTarget", raw_out, X)[0])
            else:
                raw_vec = self._main_model.predict(X)
                raw_pred = float(postprocess_raw_predictions(self.best_name, raw_vec, X)[0])

            capped = float(np.clip(raw_pred, min_gbp, max_gbp))
            return {
                "predicted_total_gbp": round(capped, 2),
                "raw_predicted_gbp": round(raw_pred, 2),
                "clamped": capped != raw_pred,
                "currency": "GBP",
                "source": "model",
                "degraded": False,
                "quote_id": quote_id,
                "model_version": mv,
            }
        except Exception as e:
            logging.exception("quote_row failed quote_id=%s", quote_id)
            if os.environ.get("PRICING_STRICT", "").lower() in ("1", "true", "yes"):
                raise
            fb = float(os.environ.get("FALLBACK_PRICE_GBP", "99.0"))
            out: dict[str, Any] = {
                "predicted_total_gbp": round(fb, 2),
                "raw_predicted_gbp": round(fb, 2),
                "clamped": False,
                "currency": "GBP",
                "source": "fallback",
                "degraded": True,
                "quote_id": quote_id,
                "model_version": mv,
            }
            if os.environ.get("PRICING_DEBUG", "").lower() in ("1", "true", "yes"):
                out["error_class"] = type(e).__name__
            return out

    def quote_dataframe(self, df: pd.DataFrame, *, min_gbp: float = 5.0, max_gbp: float = 8000.0) -> pd.DataFrame:
        df = df.copy()
        for c in BOOKING_INPUT_COLUMNS:
            if c not in df.columns:
                df[c] = np.nan
        X = self._prepare_X(df)

        if self.mode == "segmented":
            preds = predict_segmented_totals(X, self.seg_models, self.global_model, self.segment_cols)
        elif self.best_name == "LSTM_LogTarget":
            arr = self._scaler.transform(X.values).reshape(len(X), 1, len(self.feature_cols))
            raw_out = self._main_model.predict(arr, verbose=0).reshape(-1)
            preds = postprocess_raw_predictions("LSTM_LogTarget", raw_out, X)
        else:
            preds = postprocess_raw_predictions(self.best_name, self._main_model.predict(X), X)

        preds = np.clip(np.asarray(preds, dtype=float), min_gbp, max_gbp)
        out = df.copy()
        out["predicted_total_gbp"] = np.round(preds, 2)
        return out
