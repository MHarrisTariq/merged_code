## One Platform (single frontend + single backend)

This setup runs:

- `frontend` (one UI service; nginx routes some `/api/*` paths to the car API)
- `backend` (booking NestJS API)
- `car-api` (smart pricing car stack from `smart pricing car/backend` — FastAPI + ML pricing)

`one-platform/frontend` and `one-platform/backend` contain the booking app as base. The **smart pricing car** backend is copied into `one-platform/car-api` and wired so the car UI can call the same HTTP contract under `/api/...` as in the original project.

### Run

From `all merge code/one-platform`:

- `docker compose up --build`
- Open `http://localhost`

### Current structure

- `car-api/` -> smart pricing car FastAPI (`smart pricing car/backend` copy)
- `frontend/` -> real booking frontend codebase
- `frontend/src/modules/car` -> car host UI (dashboard, search, listing, calendar, admin, simulation, audit) aligned with the car API
- `frontend/src/modules/airbnb` -> merged Airbnb frontend sources
- `frontend/src/modules/seo` -> merged SEO frontend sources
- `backend/` -> real booking backend codebase (NestJS)
- `backend/src/modules/airbnb_python` -> merged Airbnb backend sources
- `backend/src/modules/seo_gateway` -> merged SEO api-gateway sources
- `backend/src/modules/subplan_python` -> merged subscription/ranking sources

### Endpoints

- `/` -> single frontend app (routes such as `/car`, `/booking`, …)
- `/api/health`, `/api/bookings`, … -> Nest booking backend (port `3000` in compose)
- `/api/listings`, `/api/pricing-calendar`, `/api/simulate`, `/api/auth/login`, … -> `car-api` (FastAPI, port `8000` internally); nginx strips the `/api` prefix when proxying to Python.

### Local dev (without Docker for car)

1. From `one-platform/car-api`: `pip install -r requirements.txt` then `uvicorn car_rental_api:app --reload --host 127.0.0.1 --port 8000`
2. Set `SWYFT_INTEGRATED_CAR=1` so quote/simulate/admin routes skip API keys (integrated mode).
3. Run Nest on `3000` and Vite on `5173`; Vite proxies car paths to `8000` and the rest to `3000`.

### Notes

- **ML artifacts**: quote/simulate need trained models under `car-api/models/car/model_meta.pkl` (run `python car.py` in `car-api` per upstream docs). Listings, calendar, signals, and settings work from the bundled CSV without models.
- Optional UI password: set `SWYFT_CAR_UI_PASSWORD` in `car-api` to require a password on `POST /api/auth/login`.

