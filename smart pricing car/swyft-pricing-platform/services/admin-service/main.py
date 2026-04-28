"""Admin / audit sidecar — health; audit writes happen via shared audit_store used by API gateway."""

from __future__ import annotations

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="Swyft Admin Service", version="1.0.0")
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/health")
def health():
    return {"ok": True, "service": "admin-service"}
