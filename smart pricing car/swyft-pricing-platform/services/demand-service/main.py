"""Demand aggregation service — Kafka in, Kafka out; HTTP only for health."""

from __future__ import annotations

import logging
import os
import threading

from contextlib import asynccontextmanager

from fastapi import FastAPI
from prometheus_client import Counter
from prometheus_fastapi_instrumentator import Instrumentator

from consumer import DemandAggregator, run_demand_consumer_loop, run_periodic_publish_loop

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("demand-service")

REQUESTS = Counter("demand_service_requests_total", "HTTP requests", ["path"])

_store: DemandAggregator | None = None
_threads: list[threading.Thread] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _store, _threads
    interval = float(os.environ.get("DEMAND_PUBLISH_INTERVAL_SEC", "60"))
    _store = DemandAggregator(interval_sec=interval)
    t1 = threading.Thread(target=run_demand_consumer_loop, args=(_store,), daemon=True, name="demand-kafka")
    t2 = threading.Thread(
        target=run_periodic_publish_loop,
        args=(_store, interval),
        daemon=True,
        name="demand-publish",
    )
    _threads = [t1, t2]
    for t in _threads:
        t.start()
    logger.info("demand-service background workers started")
    yield
    if _store:
        _store.stop()
    logger.info("demand-service shutdown")


app = FastAPI(title="Swyft Demand Service", version="1.0.0", lifespan=lifespan)
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/health")
def health():
    return {"ok": True, "service": "demand-service"}
