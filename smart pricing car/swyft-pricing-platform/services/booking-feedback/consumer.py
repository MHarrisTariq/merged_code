"""Consume booking.completed → PostgreSQL bookings; optional Airflow DAG trigger."""

from __future__ import annotations

import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from shared.kafka_client import get_consumer
from streaming.topics import BOOKING_COMPLETED

logger = logging.getLogger(__name__)

_engine: Engine | None = None
_bookings_since_retrain = 0
_last_retrain_count = 0
_lock = threading.Lock()


def _dsn() -> str:
    return os.environ.get(
        "DATABASE_URL_SYNC",
        os.environ.get("DATABASE_URL", "postgresql+psycopg2://swyft:swyft@postgres:5432/swyft"),
    )


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(_dsn(), pool_pre_ping=True)
    return _engine


def insert_booking(row: dict[str, Any]) -> None:
    eng = get_engine()
    raw_bid = row.get("booking_id")
    try:
        bid = uuid.UUID(str(raw_bid)) if raw_bid else uuid.uuid4()
    except ValueError:
        bid = uuid.uuid4()
    lid = str(row.get("listing_id", ""))
    price = float(row.get("price", 0))
    guest_raw = row.get("guest_id") or row.get("user_id")
    guest: uuid.UUID | None
    try:
        guest = uuid.UUID(str(guest_raw)) if guest_raw else None
    except ValueError:
        guest = None
    with eng.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO bookings (booking_id, listing_id, price, booked_at, status, guest_id)
                VALUES (:bid, :lid, :price, NOW(), :status, :guest)
                ON CONFLICT (booking_id) DO NOTHING
                """
            ),
            {
                "bid": bid,
                "lid": lid,
                "price": price,
                "status": str(row.get("status", "completed")),
                "guest": guest,
            },
        )


def maybe_trigger_airflow() -> None:
    global _bookings_since_retrain, _last_retrain_count
    threshold = int(os.environ.get("RETRAIN_BOOKING_THRESHOLD", "100"))
    url = os.environ.get("AIRFLOW_REST_URL", "").strip()
    dag_id = os.environ.get("AIRFLOW_RETRAIN_DAG_ID", "swyft_retrain")
    with _lock:
        _bookings_since_retrain += 1
        if _bookings_since_retrain - _last_retrain_count < threshold:
            return
        _last_retrain_count = _bookings_since_retrain
    if not url:
        logger.info("Airflow URL not set; skip DAG trigger (bookings=%s)", _bookings_since_retrain)
        return
    try:
        import urllib.request

        token = os.environ.get("AIRFLOW_API_TOKEN", "")
        req = urllib.request.Request(
            f"{url.rstrip('/')}/api/v1/dags/{dag_id}/dagRuns",
            data=b'{"conf":{}}',
            headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10)
        logger.info("Triggered Airflow DAG %s", dag_id)
    except Exception:
        logger.exception("Airflow trigger failed")


def run_booking_feedback_loop(stop: threading.Event) -> None:
    consumer = get_consumer(
        BOOKING_COMPLETED,
        group_id="booking-feedback",
        auto_offset_reset="earliest",
    )
    try:
        while not stop.is_set():
            records = consumer.poll(timeout_ms=2000)
            for _tp, batch in records.items():
                for msg in batch:
                    try:
                        data = msg.value
                        if isinstance(data, dict):
                            insert_booking(data)
                            maybe_trigger_airflow()
                    except Exception:
                        logger.exception("booking feedback failed")
    finally:
        consumer.close()
