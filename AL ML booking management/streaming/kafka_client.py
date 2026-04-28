"""Kafka helpers aligned with backend topics (Python side / batch jobs)."""
import json
import os
from typing import Any

try:
    from kafka import KafkaProducer
except ImportError:
    KafkaProducer = None  # type: ignore

TOPICS = {
    "BOOKING_CREATED": "booking.created",
    "BOOKING_UPDATED": "booking.updated",
    "BOOKING_CANCELLED": "booking.cancelled",
    "BOOKING_MODIFIED": "booking.modified",
    "SYNC_REQUESTED": "sync.requested",
    "SYNC_COMPLETED": "sync.completed",
    "RISK_EVALUATED": "risk.evaluated",
}


def get_producer():
    if KafkaProducer is None:
        raise RuntimeError("install kafka-python: pip install kafka-python")
    brokers = os.environ.get("KAFKA_BROKERS", "127.0.0.1:9092")
    return KafkaProducer(
        bootstrap_servers=[b.strip() for b in brokers.split(",")],
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
    )


def send_event(topic: str, payload: dict[str, Any]) -> None:
    p = get_producer()
    p.send(topic, payload)
    p.flush()
