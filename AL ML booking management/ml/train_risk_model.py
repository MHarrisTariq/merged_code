"""Train LightGBM risk classifier; save to ai-services/models/risk_model.pkl."""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
MODEL_OUT = ROOT / "ai-services" / "models" / "risk_model.pkl"
DATA_DIR = ROOT / "data" / "sample_data"


def simulate(n: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    latency = rng.uniform(0, 5, n)
    sync_delay = rng.uniform(0, 10, n)
    demand = rng.uniform(0, 1, n)
    concurrent = rng.integers(0, 25, n)
    reliability_gap = rng.uniform(0, 0.3, n)
    noise = rng.normal(0, 0.15, n)
    score = (
        0.25 * (latency / 5)
        + 0.2 * (sync_delay / 10)
        + 0.25 * demand
        + 0.2 * (concurrent / 25)
        + 0.1 * reliability_gap
        + noise
    )
    conflict = (score > 0.55).astype(int)
    return pd.DataFrame(
        {
            "time_to_sync": sync_delay,
            "platform_latency": latency,
            "demand_score": demand,
            "concurrent_requests": concurrent,
            "reliability_gap": reliability_gap,
            "conflict": conflict,
        }
    )


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--rows", type=int, default=8000)
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)

    df = simulate(args.rows, args.seed)
    df.to_csv(DATA_DIR / "risk_training.csv", index=False)

    feature_cols = [
        "time_to_sync",
        "platform_latency",
        "demand_score",
        "concurrent_requests",
        "reliability_gap",
    ]
    X = df[feature_cols].values
    y = df["conflict"].values

    try:
        import lightgbm as lgb

        model = lgb.LGBMClassifier(
            n_estimators=400,
            learning_rate=0.05,
            max_depth=6,
            random_state=args.seed,
            verbose=-1,
        )
        model.fit(X, y)
    except Exception:
        from sklearn.ensemble import GradientBoostingClassifier

        model = GradientBoostingClassifier(random_state=args.seed)
        model.fit(X, y)

    joblib.dump(model, MODEL_OUT)
    print(f"Saved model to {MODEL_OUT}")

    try:
        import mlflow

        mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", "file:./mlruns"))
        with mlflow.start_run(run_name="risk_model"):
            mlflow.log_param("rows", args.rows)
            mlflow.log_artifact(str(MODEL_OUT))
    except Exception:
        pass


if __name__ == "__main__":
    main()
