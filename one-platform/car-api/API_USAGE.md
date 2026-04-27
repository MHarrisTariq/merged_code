# Car rental smart pricing — HTTP API usage

REST API built with **FastAPI**. It loads trained models from `models/car/` and returns an estimated **total trip price in GBP**.

## Prerequisites

1. **Python dependencies**

   ```bash
   pip install -r requirements.txt
   ```

2. **Train models** (creates `models/car/` artifacts, including `model_meta.pkl`)

   ```bash
   python car.py
   ```

   Or production-leaning training (no price-proxy features):

   ```bash
   python car.py --segment
   ```

2b. **(Optional) Train booking-probability model** (only if you have conversion labels)

Provide a CSV with columns:
- `booked` (0/1)
- `price` (shown price)
- optional: `rental_length`, `average`, `start_date`, `is_weekend_start`

```bash
python train_probability.py --data path/to/conversion.csv
python model_registry.py
```

3. **Start the server** from the project directory (same folder as `car_rental_api.py`):

   ```bash
   uvicorn car_rental_api:app --host 127.0.0.1 --port 8000
   ```

   For development (auto-reload on file changes):

   ```bash
   uvicorn car_rental_api:app --reload --host 127.0.0.1 --port 8000
   ```

**Base URL (local default):** `http://127.0.0.1:8000`

### Environment variables

| Variable | Effect |
|----------|--------|
| `API_KEY` | If set, quote routes require header **`X-API-Key`** with the same value (`/health` and `/metrics` stay open). |
| `QUOTE_API_KEY` | Preferred key for quote routes (falls back to `API_KEY` if omitted). |
| `ADMIN_API_KEY` | Required for admin routes using header **`X-Admin-Key`** (`/admin/*`). |
| `REDIS_URL` | If set (e.g. `redis://localhost:6379/0`), quote responses are cached (TTL `QUOTE_CACHE_TTL_SEC`, default **300**). |
| `FALLBACK_PRICE_GBP` | When the model throws, response uses this amount and `source: "fallback"` (default **99.0**). Set `PRICING_STRICT=1` to surface errors instead. |
| `PRICING_DEBUG` | Set to `1` to include `error_class` on fallback responses. |
| `RATE_LIMIT_QUOTE` | Override default **`60/minute`** per IP for single-quote routes (`slowapi`). |
| `RATE_LIMIT_BATCH` | Override default **`30/minute`** for `POST /quote/batch`. |
| `MAX_REQUEST_BYTES` | Reject oversized requests with HTTP `413` (default: `65536`). |

### Docker (API + Redis)

```bash
docker compose up --build
```

Mount your trained `models/car` (see `docker-compose.yml`). See **`docs/FULL_ENGINEERING_SPEC.md`** for full architecture notes.

**Browser tip:** Visiting `/quote` in the address bar sends **GET**, but pricing uses **POST** with a JSON body — you will see instructions at `GET /quote`. For a one-click test in the browser, open **`GET /quote/demo`** instead, or use **`/docs`** → POST `/quote` → **Try it out**.

---

## Interactive documentation

FastAPI exposes OpenAPI automatically:

| URL | Description |
|-----|-------------|
| `http://127.0.0.1:8000/docs` | Swagger UI — try requests in the browser |
| `http://127.0.0.1:8000/redoc` | ReDoc |
| `http://127.0.0.1:8000/metrics` | Prometheus metrics |

---

## Endpoints

### `GET /`

Short index of main routes (`/health`, `/metrics`, `/quote`, `/quote/batch`, `/docs`) and pointers to engineering docs.

---

### `GET /metrics`

Prometheus scrape endpoint (latency, request counts). No API key required by default.

### `GET /health`

Liveness check and whether model files are present.

**Response (200)**

```json
{
  "ok": true,
  "models_dir": "D:\\New Forecasting\\Jira Car\\models\\car",
  "artifacts_ready": true
}
```

- `artifacts_ready` is `true` when `model_meta.pkl` exists under `models_dir`.

---

### `GET /quote`

Does **not** return a price. Returns JSON explaining that **`POST /quote`** is required (browsers use GET when you type the URL).

### `GET /quote/demo`

Runs the same default quote as **`POST /quote/demo`**. Convenient for testing in a browser tab.

---

### `POST /quote`

Returns a price estimate for one booking. Body is JSON; every field has a default, so you can send a partial body and rely on defaults for the rest.

**Request body** (`application/json`)

All fields align with the training CSV / `QuoteRequest` in `car_rental_api.py`.

| Field | Type | Default (if omitted) | Notes |
|-------|------|----------------------|--------|
| `airport` | string | Heathrow Airport | |
| `airport_iata` | string | LHR | |
| `country` | string | GB | |
| `city` | string | London | |
| `rental_length` | number | 2.0 | Days (or same unit as training data) |
| `start_date` | string | 2023-07-25 | Parseable date, e.g. `YYYY-MM-DD` |
| `start_time` | string | 10:00 | e.g. `HH:MM` |
| `return_date` | string | 2023-07-27 | |
| `return_time` | string | 10:00 | |
| `date_offset` | number | 0.0 | |
| `mileage` | string | 50 miles per rental | Free text; model parses mileage / “unlimited” |
| `group` | string | Economy | Vehicle class, e.g. Mini, Compact, Premium |
| `transmission` | string | Manual | |
| `fuel_type` | string | *(empty)* | |
| `supplier_name` | string | Green Motion | |
| `supplier_loction_type` | string | Shuttle Bus | e.g. Meet & Greet, In Terminal |
| `product_name` | string | Kia Rio | |
| `doors` | number | 4.0 | |
| `seats` | number | 5.0 | |
| `airbags` | number | 1.0 | |
| `aircon` | number | 1.0 | |
| `free_cancellation` | number | 1.0 | |
| `dropoff_time` | number | 8.0 | |
| `pickup_time` | number | 8.0 | |
| `average` | number | 6.9 | Supplier rating-style signals |
| `cleanliness` | number | 7.7 | |
| `condition` | number | 7.9 | |
| `efficiency` | number | 6.9 | |
| `location` | number | 5.8 | |
| `value_for_money` | number | 5.6 | |
| `no_of_ratings` | number | 4909.0 | |
| `deposit_price` | number \| null | null | Only affects models trained **with** price proxies (`python car.py` default demo path). Ignored for `--segment` training. |
| `drive_away_price` | number \| null | null | Same as `deposit_price`. |

**Response (200)**

```json
{
  "predicted_total_gbp": 85.84,
  "recommended_price": 89.12,
  "confidence_score": 0.86,
  "explanation_tags": ["high_demand", "peak_season"],
  "price_components": {
    "base_model_price": 85.84,
    "demand_factor": 1.08,
    "seasonality_factor": 1.12,
    "lead_time_factor": 1.0,
    "quality_factor": 1.02,
    "supply_factor": 1.0,
    "engine_price": 105.0,
    "guardrail_final_price": 89.12
  },
  "raw_predicted_gbp": 85.84,
  "clamped": false,
  "currency": "GBP",
  "source": "model",
  "degraded": false,
  "quote_id": "qte_a1b2c3d4e5f67890",
  "model_version": "XGBoost_SegmentedDaily:segmented",
  "cache_hit": false
}
```

| Field | Meaning |
|-------|---------|
| `predicted_total_gbp` | Final estimate after min/max clamping (see service defaults). |
| `recommended_price` | Final recommended quote after pricing-engine components and guardrails. |
| `confidence_score` | Compact confidence measure for recommendation quality (0-1). |
| `explanation_tags` | Human-readable reasons for recommendation and any guardrails applied. |
| `price_components` | Component-level breakdown (factors and guardrail-adjusted final). |
| `raw_predicted_gbp` | Model output before clamping. |
| `clamped` | `true` if the raw value was outside the allowed range and was clipped. |
| `currency` | Always `GBP` for this dataset. |
| `source` | `model` or `fallback` if `FALLBACK_PRICE_GBP` was used after an error. |
| `degraded` | `true` when `source` is `fallback`. |
| `quote_id` | Correlation id for logs / audit (Kafka `pricing.quote.completed` payload). |
| `model_version` | Meta label from training (`best_name:mode`). |
| `cache_hit` | `true` if the response was served from Redis (`REDIS_URL` set). |

---

### `POST /quote/batch`

Body: `{ "items": [ QuoteRequest, ... ] }` — **1–50** bookings per call (same schema as `POST /quote`).

**Response (200)**

```json
{
  "results": [ /* same shape as single quote */ ],
  "count": 2
}
```

Rate limit default: **30 requests/minute** per IP (separate from single-quote limit).

**Errors**

| Status | When |
|--------|------|
| `401` | `API_KEY` env is set and `X-API-Key` is missing or wrong. |
| `429` | Rate limit exceeded (`slowapi`). |
| `503` | Model artifacts missing — train with `python car.py` first. Message explains the missing path. |

---

### `POST /quote/demo`

Same as `POST /quote` with the full default `QuoteRequest` body. Useful for smoke tests and tools like `curl -X POST .../quote/demo`.

**Response:** Same shape as `POST /quote`.

---

### `POST /optimize`

Computes an **expected-revenue optimal** price by scanning candidate prices and maximizing:

\[
\text{expected\_revenue}(p) = p \times \Pr(\text{book} \mid p, x)
\]

It returns:
- the **baseline quote** from the existing price model
- the **best candidate price** and its booking probability + expected revenue

**Request body**: same as `POST /quote`, plus:

| Field | Type | Default | Notes |
|------|------|---------|------|
| `min_price_gbp` | number | 5.0 | Lower bound for the scan |
| `max_price_gbp` | number | 8000.0 | Upper bound for the scan |
| `step_gbp` | number | 5.0 | Candidate step size |
| `window_pct` | number | 0.5 | Scan band around baseline (e.g. 0.5 → \(\pm50\%\)) |

---

### `POST /simulate`

Same scan as `/optimize`, but returns the **full curve** (`price_gbp`, `booking_probability`, `expected_revenue`) so you can plot revenue curves and explain decisions.

---

### Admin endpoints (`/admin/*`)

All admin endpoints require `X-Admin-Key` with `ADMIN_API_KEY` configured.

| Method | Path | Purpose |
|------|------|---------|
| `GET` | `/admin/config` | Read current kill-switch, global caps, and regional overrides |
| `POST` | `/admin/kill-switch` | Enable/disable dynamic pricing globally |
| `POST` | `/admin/global-caps` | Set min/max, max percent change, smoothing |
| `POST` | `/admin/region-override` | Set region-specific caps and multiplier |

---

## Example requests

### cURL

```bash
curl -s -X POST "http://127.0.0.1:8000/quote" ^
  -H "Content-Type: application/json" ^
  -d "{\"city\": \"London\", \"group\": \"Economy\", \"rental_length\": 3, \"start_date\": \"2023-08-01\", \"start_time\": \"09:00\", \"return_date\": \"2023-08-04\", \"return_time\": \"09:00\", \"supplier_name\": \"Hertz\", \"product_name\": \"Vauxhall Corsa\"}"
```

On macOS/Linux, use single quotes around the JSON and adjust line continuation.

### PowerShell (`Invoke-RestMethod`)

```powershell
$body = @{
  city = "London"
  group = "Premium"
  rental_length = 5
  start_date = "2023-08-01"
  start_time = "10:00"
  return_date = "2023-08-06"
  return_time = "10:00"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8000/quote" -Method Post -Body $body -ContentType "application/json"
```

### JavaScript (`fetch`)

```javascript
const res = await fetch("http://127.0.0.1:8000/quote", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    city: "London",
    group: "Compact",
    rental_length: 2,
    start_date: "2023-07-25",
    start_time: "10:00",
    return_date: "2023-07-27",
    return_time: "10:00",
  }),
});
const data = await res.json();
console.log(data.predicted_total_gbp);
```

---

## Python client (same process, no HTTP)

For batch jobs or libraries, you can call the service directly:

```python
from car_rental_service import CarRentalPricingService

svc = CarRentalPricingService()
print(svc.quote_row({"city": "London", "group": "Economy", "rental_length": 2.0, ...}))
```

See `car_rental_service.py` for `quote_dataframe` and `BOOKING_INPUT_COLUMNS`.

---

## Notes

- **Training mode must match usage:** If you trained with `python car.py --segment`, do not expect `deposit_price` / `drive_away_price` to influence predictions (those columns are dropped in that pipeline).
- **First request** loads models into memory; subsequent requests reuse the cached `CarRentalPricingService` instance.
- **CORS** is not configured in the default app. If you call the API from a browser on another origin, add CORS middleware in `car_rental_api.py` or put a reverse proxy in front.
