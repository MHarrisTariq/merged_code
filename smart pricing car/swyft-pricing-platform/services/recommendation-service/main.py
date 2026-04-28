"""Bridge demand metrics → pricing.compute.requested (Kafka only between services)."""

from __future__ import annotations

import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from kafka import KafkaProducer
from prometheus_fastapi_instrumentator import Instrumentator

from shared.config import kafka_bootstrap_servers, kafka_topic_prefix
from shared.kafka_client import get_consumer
from streaming.topics import DEMAND_METRICS_UPDATED, PRICING_COMPUTE_REQUESTED

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("recommendation-service")


def _t(name: str) -> str:
    p = kafka_topic_prefix()
    return f"{p}{name}" if p else name


def _producer() -> KafkaProducer:
    import json

    return KafkaProducer(
        bootstrap_servers=kafka_bootstrap_servers(),
        value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
    )


def run_recommendation_loop(stop: threading.Event) -> None:
    consumer = get_consumer(
        DEMAND_METRICS_UPDATED,
        group_id="recommendation-bridge",
        auto_offset_reset="earliest",
    )
    producer = _producer()
    default_base = float(os.environ.get("DEFAULT_BASE_PRICE", "120"))
    default_min = float(os.environ.get("DEFAULT_MIN_PRICE", "40"))
    default_max = float(os.environ.get("DEFAULT_MAX_PRICE", "400"))
    try:
        while not stop.is_set():
            records = consumer.poll(timeout_ms=2000)
            for _tp, batch in records.items():
                for msg in batch:
                    try:
                        d = msg.value
                        if not isinstance(d, dict):
                            continue
                        lid = str(d.get("listing_id", ""))
                        if not lid:
                            continue
                        views = float(d.get("views", 0) or 0)
                        clicks = float(d.get("clicks", 0) or 0)
                        demand_score = min(1.0, views / 500.0) if views else 0.0
                        supply_score = min(1.0, 1.0 - clicks / max(views, 1.0))
                        fraud = float(d.get("fraud_score", 0) or 0)
                        demand_score = max(0.0, demand_score * (1.0 - 0.5 * fraud))
                        payload = {
                            "listing_id": lid,
                            "base_price": default_base,
                            "min_price": default_min,
                            "max_price": default_max,
                            "demand_score": demand_score,
                            "supply_score": supply_score,
                            "target_date": d.get("date"),
                            "confidence_score": 0.75,
                            "model_version": "bridge-v1",
                            "asset_type": d.get("asset_type", "car"),
                        }
                        producer.send(_t(PRICING_COMPUTE_REQUESTED), payload)
                        producer.flush()
                    except Exception:
                        logger.exception("recommendation bridge failed")
    finally:
        consumer.close()
        producer.close()


_stop = threading.Event()
_thread: threading.Thread | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _thread
    _stop.clear()
    _thread = threading.Thread(target=run_recommendation_loop, args=(_stop,), daemon=True)
    _thread.start()
    yield
    _stop.set()
    if _thread:
        _thread.join(timeout=5)


app = FastAPI(title="Swyft Recommendation Service", version="1.0.0", lifespan=lifespan)
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/health")
def health():
    return {"ok": True, "service": "recommendation-service"}
