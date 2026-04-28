"""Pricing engine service — health/metrics + background Kafka stream processor."""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from stream_processor import run_stream_processor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("pricing-engine")

_stop = threading.Event()
_worker: threading.Thread | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker
    _stop.clear()
    _worker = threading.Thread(target=run_stream_processor, args=(_stop,), daemon=True, name="pricing-stream")
    _worker.start()
    logger.info("pricing-engine stream worker started")
    yield
    _stop.set()
    if _worker:
        _worker.join(timeout=5)
    logger.info("pricing-engine stopped")


app = FastAPI(title="Swyft Pricing Engine", version="1.0.0", lifespan=lifespan)
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/health")
def health():
    import os
    from pathlib import Path

    from car_rental_service import DEFAULT_MODEL_DIR

    ready = (Path(os.environ.get("MODEL_DIR", str(DEFAULT_MODEL_DIR))) / "model_meta.pkl").is_file()
    return {"ok": True, "service": "pricing-engine", "artifacts_ready": ready}
