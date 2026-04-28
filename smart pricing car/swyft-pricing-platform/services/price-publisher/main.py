"""Consume pricing.recommendation.generated → PostgreSQL + Redis cache."""

from __future__ import annotations

import logging
import os
import threading
from contextlib import asynccontextmanager
from typing import Any

import redis
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from shared.config import kafka_topic_prefix, redis_url
from shared.kafka_client import get_consumer
from streaming.topics import PRICING_RECOMMENDATION_GENERATED

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("price-publisher")


def _t(name: str) -> str:
    p = kafka_topic_prefix()
    return f"{p}{name}" if p else name


def _dsn() -> str:
    # sync driver for background thread
    return os.environ.get(
        "DATABASE_URL_SYNC",
        os.environ.get("DATABASE_URL", "postgresql+psycopg2://swyft:swyft@postgres:5432/swyft"),
    )


_engine: Engine | None = None
_redis: redis.Redis | None = None


def _get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(_dsn(), pool_pre_ping=True)
    return _engine


def _get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(redis_url())
    return _redis


def persist_recommendation(row: dict[str, Any]) -> None:
    eng = _get_engine()
    r = _get_redis()
    lid = str(row.get("listing_id", ""))
    d = str(row.get("date") or row.get("target_date") or "")
    price = float(row.get("price", 0))
    conf = row.get("confidence_score")
    mv = str(row.get("model_version") or "stream-v1")
    with eng.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO price_calendar (listing_id, date, price, confidence_score, model_version)
                VALUES (:lid, CAST(:d AS date), :price, :conf, :mv)
                ON CONFLICT (listing_id, date)
                DO UPDATE SET
                  price = EXCLUDED.price,
                  confidence_score = EXCLUDED.confidence_score,
                  model_version = EXCLUDED.model_version,
                  updated_at = NOW()
                """
            ),
            {"lid": lid, "d": d, "price": price, "conf": conf, "mv": mv},
        )
    key = f"price:{lid}:{d}"
    r.setex(key, int(os.environ.get("PRICE_CACHE_TTL_SEC", "3600")), str(price))


def run_publisher_loop(stop: threading.Event) -> None:
    consumer = get_consumer(
        PRICING_RECOMMENDATION_GENERATED,
        group_id="price-publisher",
        auto_offset_reset="earliest",
    )
    logger.info("price-publisher listening")
    try:
        while not stop.is_set():
            records = consumer.poll(timeout_ms=2000)
            for _tp, batch in records.items():
                for msg in batch:
                    try:
                        data = msg.value
                        if isinstance(data, dict):
                            persist_recommendation(data)
                    except Exception:
                        logger.exception("persist recommendation failed")
    finally:
        consumer.close()


_stop = threading.Event()
_thread: threading.Thread | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _thread
    _stop.clear()
    _thread = threading.Thread(target=run_publisher_loop, args=(_stop,), daemon=True)
    _thread.start()
    yield
    _stop.set()
    if _thread:
        _thread.join(timeout=5)


app = FastAPI(title="Swyft Price Publisher", version="1.0.0", lifespan=lifespan)
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/health")
def health():
    return {"ok": True, "service": "price-publisher"}
