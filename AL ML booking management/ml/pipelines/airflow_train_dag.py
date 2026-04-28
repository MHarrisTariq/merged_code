"""Airflow DAG stub: wire to your Airflow deployment; trains risk model daily."""
from datetime import datetime

# Install apache-airflow in your orchestration environment, then place this under dags/

try:
    from airflow import DAG
    from airflow.operators.python import PythonOperator
except ImportError:
    DAG = None


def _train():
    import subprocess
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    script = root / "ml" / "train_risk_model.py"
    subprocess.check_call([sys.executable, str(script)])


if DAG is not None:
    with DAG(
        dag_id="swyft_risk_model_training",
        start_date=datetime(2024, 1, 1),
        schedule_interval="@daily",
        catchup=False,
        tags=["swyftbooking", "ml"],
    ) as dag:
        PythonOperator(task_id="train_risk_model", python_callable=_train)
