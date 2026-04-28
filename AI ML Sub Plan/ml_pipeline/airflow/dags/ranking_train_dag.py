"""
Airflow DAG: daily CTR + CVR training, drift check hook, MLflow promotion (skeleton).
Set AIRFLOW_HOME and place project on PYTHONPATH; adjust paths for your deployment.
"""

from __future__ import annotations

from datetime import datetime, timedelta

try:
    from airflow import DAG
    from airflow.operators.bash import BashOperator
except ImportError:
    DAG = None  # type: ignore[misc, assignment]


if DAG is not None:
    default_args = {
        "owner": "ml-platform",
        "depends_on_past": False,
        "email_on_failure": False,
        "retries": 1,
        "retry_delay": timedelta(minutes=10),
    }

    with DAG(
        dag_id="ranking_models_daily",
        default_args=default_args,
        start_date=datetime(2026, 1, 1),
        schedule="@daily",
        catchup=False,
        tags=["ranking", "ctr", "cvr"],
    ) as dag:
        train_ctr = BashOperator(
            task_id="train_ctr",
            bash_command="python {{ var.value.ml_pipeline_root }}/train_ctr.py --data-path {{ var.value.ctr_training_path }}",
        )
        train_cvr = BashOperator(
            task_id="train_cvr",
            bash_command="python {{ var.value.ml_pipeline_root }}/train_cvr.py --data-path {{ var.value.cvr_training_path }}",
        )
        parity = BashOperator(
            task_id="parity_check",
            bash_command="python {{ var.value.ml_pipeline_root }}/parity_check.py",
        )
        [train_ctr, train_cvr] >> parity
