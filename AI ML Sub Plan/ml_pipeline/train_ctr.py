"""
CTR training entrypoint — LightGBM/XGBoost when data lake + labels are wired.
Writes MLflow run and exports artifact path for registry promotion.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Train CTR model")
    parser.add_argument("--data-path", default="", help="Parquet or path prefix in lake")
    parser.add_argument("--experiment", default="swyftbooking_ctr")
    parser.add_argument("--out", default="artifacts/ctr", help="Local artifact directory")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": "ctr",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "data_path": args.data_path or None,
        "experiment": args.experiment,
        "status": "stub_no_data",
        "note": "Replace with LightGBM fit + MLflow log_model when dataset is available",
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))

    if os.environ.get("MLFLOW_TRACKING_URI"):
        try:
            import mlflow

            mlflow.set_experiment(args.experiment)
            with mlflow.start_run():
                mlflow.log_param("data_path", args.data_path)
                mlflow.log_dict(manifest, "manifest.json")
                mlflow.log_artifact(str(out / "manifest.json"))
        except Exception as e:
            print(f"MLflow optional logging skipped: {e}")


if __name__ == "__main__":
    main()
