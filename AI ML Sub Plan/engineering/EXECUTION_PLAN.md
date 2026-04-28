# Engineering execution plan — AI/ML Promotion & Subscription Intelligence

This folder implements the deliverables requested at the end of **AI ML Subscription Plan.docx**: backlog, schemas, APIs, ranking microservice, ML pipeline skeleton, and state-of-the-art gap closures (architecture + code hooks).

## Artifact index

| Deliverable | Location |
|-------------|----------|
| **Doc → code coverage matrix (full verification)** | `engineering/DOCUMENT_COVERAGE_MATRIX.md` |
| **Formal compliance audit (tests, gaps, sign-off)** | `engineering/AUDIT.md` |
| Jira-style epics, stories, acceptance criteria | `engineering/jira_backlog.yaml` |
| MongoDB JSON schemas + index recommendations | `mongodb/schemas/*.json`, `mongodb/indexes.json` |
| OpenAPI 3 contract | `openapi/openapi.yaml` |
| Ranking + decision orchestrator (FastAPI, &lt;50ms target for scoring path) | `services/ranking_microservice/` |
| ML training stubs, feature contract, IPS helpers, parity check | `ml_pipeline/` |
| Airflow DAG skeleton | `ml_pipeline/airflow/dags/ranking_train_dag.py` |
| State-of-the-art architecture (bandits, causal, governance, gaps) | `engineering/STATE_OF_THE_ART_ARCHITECTURE.md` |

Additional modules aligned with the doc: `budget_allocation.py`, `auto_allocation.py`, `fairness_policy.py`, `promotion_caps.py`, `feature_store_redis_stub.py`, `rl_policy_hook.py` under `services/ranking_microservice/app/`.

## Run the ranking service

```bash
cd services/ranking_microservice
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

- Health: `GET /health`
- Score: `POST /v1/rank/score` (see OpenAPI)
- Models: `GET /v1/models/info`

## Run tests

```bash
cd services/ranking_microservice
pip install pytest
pytest -q
```

## ML pipeline (local)

```bash
cd ml_pipeline
pip install pyyaml
python parity_check.py
python train_ctr.py
python train_cvr.py
```

Set `MLFLOW_TRACKING_URI` to enable optional MLflow logging in train scripts.

## Full code + explanation (Word)

Regenerate the bundled **.docx** (all source files + per-file explanations + completion attestation):

```bash
pip install python-docx
python scripts/build_code_documentation_docx.py
```

Output: `SWYFTBOOKING_AI_ML_Full_Code_and_Explanation.docx` in the project root.

## Next wiring steps (production)

1. Replace `model_stubs.py` with MLflow-loaded models using `feature_contract.yaml`.
2. Connect `POST /v1/events` to Kafka/DB and anomaly pipeline.
3. Configure Airflow variables `ml_pipeline_root`, `ctr_training_path`, `cvr_training_path`.
4. Enable Redis feature store behind a thin client in the orchestrator.
