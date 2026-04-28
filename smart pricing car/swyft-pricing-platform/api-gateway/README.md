# API Gateway

Public FastAPI surface for Swyft: `/quote`, `/optimize`, `/simulate`, listings, pricing calendar, admin controls, metrics, and JWT login (`/auth/login`, `/auth/refresh`) for the admin UI.

Run with `PYTHONPATH` including the platform root, `services/pricing-engine`, and `services/admin-service`. Models and dataset paths default under `api-gateway/data` and `models/car`.
