"""Publish synthetic supply metrics on an interval (Kafka)."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from kafka import KafkaProducer
from prometheus_fastapi_instrumentator import Instrumentator

from shared.config import kafka_bootstrap_servers, kafka_topic_prefix
from streaming.topics import SUPPLY_METRICS_UPDATED

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("supply-service")


def _t(name: str) -> str:
    p = kafka_topic_prefix()
    return f"{p}{name}" if p else name


_stop = threading.Event()


def _publisher_loop() -> None:
    producer = KafkaProducer(
        bootstrap_servers=kafka_bootstrap_servers(),
        value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
    )
    interval = float(os.environ.get("SUPPLY_PUBLISH_INTERVAL_SEC", "120"))
    region = os.environ.get("DEFAULT_SUPPLY_REGION", "london")
    try:
        while not _stop.is_set():
            payload = {
                "region": region,
                "date": time.strftime("%Y-%m-%d", time.gmtime()),
                "available_listings": int(os.environ.get("SUPPLY_AVAILABLE", "230")),
                "avg_price": float(os.environ.get("SUPPLY_AVG_PRICE", "145")),
                "occupancy_rate": float(os.environ.get("SUPPLY_OCCUPANCY", "0.72")),
                "asset_type": "car",
            }
            producer.send(_t(SUPPLY_METRICS_UPDATED), payload)
            producer.flush()
            _stop.wait(interval)
    finally:
        producer.close()


_thread: threading.Thread | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _thread
    _stop.clear()
    _thread = threading.Thread(target=_publisher_loop, daemon=True)
    _thread.start()
    yield
    _stop.set()
    if _thread:
        _thread.join(timeout=5)


app = FastAPI(title="Swyft Supply Service", version="1.0.0", lifespan=lifespan)
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/health")
def health():
    return {"ok": True, "service": "supply-service"}
