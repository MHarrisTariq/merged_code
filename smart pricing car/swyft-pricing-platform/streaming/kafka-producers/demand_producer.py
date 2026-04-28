"""Demand-side event producers (views, clicks, bookings)."""

from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from kafka import KafkaProducer

from streaming.topics import BOOKING_COMPLETED, LISTING_CLICKED, LISTING_VIEWED


def _bootstrap() -> str:
    return os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")


def _prefix() -> str:
    return os.environ.get("KAFKA_TOPIC_PREFIX", "").strip()


def _t(name: str) -> str:
    p = _prefix()
    return f"{p}{name}" if p else name


def _producer() -> KafkaProducer:
    return KafkaProducer(
        bootstrap_servers=_bootstrap(),
        value_serializer=lambda v: __import__("json").dumps(v, default=str).encode("utf-8"),
    )


def _envelope(listing_id: str, user_id: str, **extra: Any) -> dict[str, Any]:
    return {
        "listing_id": listing_id,
        "user_id": user_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_id": f"evt_{uuid.uuid4().hex[:16]}",
        **extra,
    }


def send_view_event(data: dict[str, Any]) -> None:
    listing_id = str(data["listing_id"])
    user_id = str(data.get("user_id", "anon"))
    payload = _envelope(listing_id, user_id, asset_type=data.get("asset_type", "car"))
    p = _producer()
    try:
        p.send(_t(LISTING_VIEWED), payload)
        p.flush()
    finally:
        p.close()


def send_click_event(data: dict[str, Any]) -> None:
    listing_id = str(data["listing_id"])
    user_id = str(data.get("user_id", "anon"))
    payload = _envelope(listing_id, user_id, asset_type=data.get("asset_type", "car"))
    p = _producer()
    try:
        p.send(_t(LISTING_CLICKED), payload)
        p.flush()
    finally:
        p.close()


def send_booking_event(data: dict[str, Any]) -> None:
    listing_id = str(data["listing_id"])
    user_id = str(data.get("user_id", "guest"))
    payload = _envelope(
        listing_id,
        user_id,
        price=float(data.get("price", 0)),
        booking_id=str(data.get("booking_id", uuid.uuid4())),
        asset_type=data.get("asset_type", "car"),
    )
    p = _producer()
    try:
        p.send(_t(BOOKING_COMPLETED), payload)
        p.flush()
    finally:
        p.close()
