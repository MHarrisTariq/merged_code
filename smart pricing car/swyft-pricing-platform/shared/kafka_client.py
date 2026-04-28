"""Kafka producer/consumer factory — services use this; no direct HTTP between services."""

from __future__ import annotations

import json
from typing import Any

from kafka import KafkaConsumer, KafkaProducer

from shared.config import kafka_bootstrap_servers, kafka_topic_prefix


def _topic(name: str) -> str:
    p = kafka_topic_prefix()
    return f"{p}{name}" if p else name


def get_producer() -> KafkaProducer:
    return KafkaProducer(
        bootstrap_servers=kafka_bootstrap_servers(),
        value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
    )


def get_consumer(
    *topics: str,
    group_id: str,
    auto_offset_reset: str = "earliest",
) -> KafkaConsumer:
    names = [_topic(t) for t in topics]
    return KafkaConsumer(
        *names,
        bootstrap_servers=kafka_bootstrap_servers(),
        group_id=group_id,
        value_deserializer=lambda b: json.loads(b.decode("utf-8")),
        auto_offset_reset=auto_offset_reset,
        enable_auto_commit=True,
    )


def send_json(producer: KafkaProducer, topic: str, payload: dict[str, Any]) -> None:
    producer.send(_topic(topic), payload)
    producer.flush()


def build_event(
    event_type: str,
    payload: dict[str, Any],
    *,
    trace_id: str | None = None,
) -> dict[str, Any]:
    import uuid
    from datetime import datetime, timezone

    return {
        "schemaVersion": "1.0.0",
        "eventType": event_type,
        "id": f"evt_{uuid.uuid4().hex[:16]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "traceparent": trace_id,
        "payload": payload,
    }
