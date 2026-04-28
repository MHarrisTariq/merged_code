# Swyft Pricing Platform (distributed)

Monorepo layout under `swyft-pricing-platform/`:

- `api-gateway/` — public HTTP API (`/quote`, `/optimize`, `/simulate`, listings, admin, JWT `/auth/*`)
- `services/*` — Kafka-backed microservices (health + background consumers/producers)
- `streaming/` — topic constants and Kafka producers
- `shared/` — config, Kafka client, DB models, fraud helpers
- `ml/` — training (`ml/elasticity/train.py`), optimization, RL shadow agent, Airflow DAG stub
- `frontend/` — Vite + React + Tailwind admin UI
- `infra/` — Docker, Terraform (AWS), Kubernetes manifests, DB migrations, monitoring samples

## Quick start (Docker Compose)

From repository root (`Jira Car - 4`):

```bash
docker compose -f swyft-pricing-platform/docker-compose.yml up --build
```

- API: `http://localhost:8000` (Swagger `/docs`)
- Kafka: `localhost:9092`, `9093`, `9094` (host ports; containers use `kafka-*:2909x` internally)
- Postgres: `localhost:5432` (`swyft` / `swyft`)
- Redis: `localhost:6379`

Set `ADMIN_UI_JWT_SECRET` and `ADMIN_UI_PASSWORD` on `api-gateway` for the Vite admin login.

## Local API (without Docker)

```powershell
cd swyft-pricing-platform
$env:PYTHONPATH = "$PWD;$PWD\api-gateway;$PWD\services\pricing-engine;$PWD\services\admin-service"
cd api-gateway
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Train models (optional): `python ml/elasticity/car.py` with `PYTHONPATH` set to platform root; artifacts in `models/car/`.

## Tests

```powershell
cd swyft-pricing-platform
$env:PYTHONPATH = "$PWD;$PWD\api-gateway;$PWD\services\pricing-engine;$PWD\services\admin-service"
pytest api-gateway/tests services/pricing-engine/tests services/demand-service/tests -q
```

## Notes

- Inter-service integration is **Kafka-only** (no service-to-service HTTP). The API gateway serves external clients and still runs pricing inference in-process for stable `/quote` latency.
- `listing_id` in Postgres is `TEXT` to support existing `lst_*` identifiers (Word spec used UUID; schema comment in `postgres_schema.sql` explains the deviation).
