# SwyftBooking — hybrid channel manager (starter)

Deterministic core (NestJS, MongoDB, Redis locks, Kafka) plus AI services (FastAPI: risk score, availability probability, sync interval, demand).

## Quick start (local)

### Without Docker (in-memory DB + Redis mock)

Use this when you do not have MongoDB or Redis installed. Set `AI_SERVICES_URL` so the API can call the Python service.

1. (Optional) Train the risk model: `python ml/train_risk_model.py`
2. AI API: `cd ai-services && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`
3. Backend (memory mode): `cd backend && npm install && npm run start:dev:memory`  
   Set `AI_SERVICES_URL=http://127.0.0.1:8000` if needed.
4. Frontend: `cd frontend && npm install && npm run dev` (or `npx vite --host 127.0.0.1 --port 5173`)

`SWYFT_DEV_MEMORY=1` uses an in-memory booking list and `ioredis-mock` (no MongoDB/Redis).

### With MongoDB + Redis

1. Start MongoDB and Redis locally (or `docker compose up -d mongo redis` when Docker is running).
2. Train the risk model (optional): `python ml/train_risk_model.py`
3. AI API: `cd ai-services && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`
4. Backend: `cd backend && npm install && npm run start:dev`  
   Set `MONGODB_URI`, `REDIS_URL`, `KAFKA_BROKERS`, `AI_SERVICES_URL` as needed.
5. Frontend: `cd frontend && npm install && npm run dev` — API proxied to `/api`.

## Full stack (Docker Compose)

`docker compose up --build`

- Frontend: port **5173** mapped in compose — check `docker-compose.yml` (service `frontend` uses **80** inside container; host port **5173**).

## Layout

- `backend/` — NestJS booking engine, idempotency, Redis locking, Kafka producers, decision flow calling AI.
- `ai-services/` — FastAPI microservice bundle (`/risk-score`, `/availability-probability`, `/sync-interval`, `/demand-forecast`, `/platform-reliability`).
- `ml/` — LightGBM training script + Airflow DAG stub.
- `streaming/` — Python Kafka helper + topics.
- `infra/k8s/` — Example deployments.
- `data/schemas/` — JSON schema sample for bookings.
