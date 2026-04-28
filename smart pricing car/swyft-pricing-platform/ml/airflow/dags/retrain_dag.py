"""
Airflow DAG: daily elasticity retrain with deploy-if-better gate.
Requires Airflow variables: SWYFT_REPO_ROOT or run inside container with ml on PYTHONPATH.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from pathlib import Path

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator

default_args = {
    "owner": "swyft",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}


def _evaluate_auc() -> float:
    report = Path(os.environ.get("MODEL_OUT_DIR", "/models")) / "train_report.txt"
    if not report.is_file():
        return 0.0
    for line in report.read_text(encoding="utf-8").splitlines():
        if line.startswith("auc="):
            try:
                return float(line.split("=", 1)[1])
            except ValueError:
                return 0.0
    return 0.0


def deploy_if_better(**context) -> None:
    new_auc = _evaluate_auc()
    cur_file = Path(os.environ.get("CURRENT_AUC_FILE", "/models/current_auc.txt"))
    cur = 0.0
    if cur_file.is_file():
        try:
            cur = float(cur_file.read_text(encoding="utf-8").strip())
        except ValueError:
            cur = 0.0
    if new_auc > cur:
        cur_file.write_text(str(new_auc), encoding="utf-8")


with DAG(
    dag_id="swyft_retrain",
    default_args=default_args,
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["swyft", "ml"],
) as dag:
    extract = BashOperator(
        task_id="extract_data",
        bash_command="echo extract placeholder",
    )
    train = BashOperator(
        task_id="train_model",
        bash_command="python -m ml.elasticity.train || python /opt/swyft/ml/elasticity/train.py",
    )
    evaluate = BashOperator(
        task_id="evaluate",
        bash_command="test -f /models/train_report.txt && cat /models/train_report.txt || true",
    )
    deploy = PythonOperator(
        task_id="deploy_if_better",
        python_callable=deploy_if_better,
    )
    extract >> train >> evaluate >> deploy
