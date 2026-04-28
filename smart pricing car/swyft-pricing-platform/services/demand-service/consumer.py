"""Consume listing views/clicks, aggregate, emit demand.metrics.updated on interval."""

from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict
from typing import Any

from kafka import KafkaProducer

from shared.config import kafka_bootstrap_servers, kafka_topic_prefix
from shared.kafka_client import get_consumer
from streaming.topics import DEMAND_METRICS_UPDATED, LISTING_CLICKED, LISTING_VIEWED

logger = logging.getLogger(__name__)


def _t(name: str) -> str:
    p = kafka_topic_prefix()
    return f"{p}{name}" if p else name


class DemandAggregator:
    def __init__(self, interval_sec: float = 60.0) -> None:
        self.interval_sec = interval_sec
        self._lock = threading.Lock()
        self._store: dict[str, dict[str, int]] = defaultdict(lambda: {"views": 0, "clicks": 0})
        self._stop = threading.Event()

    def record(self, listing_id: str, kind: str) -> None:
        with self._lock:
            self._store[listing_id][kind] += 1

    def snapshot_and_reset(self) -> dict[str, dict[str, int]]:
        with self._lock:
            snap = {k: dict(v) for k, v in self._store.items()}
            self._store.clear()
        return snap

    def stop(self) -> None:
        self._stop.set()


def _json_producer() -> KafkaProducer:
    import json

    return KafkaProducer(
        bootstrap_servers=kafka_bootstrap_servers(),
        value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
    )


def run_demand_consumer_loop(store: DemandAggregator) -> None:
    consumer = get_consumer(
        LISTING_VIEWED,
        LISTING_CLICKED,
        group_id="demand-service-aggregate",
        auto_offset_reset="earliest",
    )
    logger.info("demand consumer started topics=%s", consumer.subscription())

    try:
        while not store._stop.is_set():
            records = consumer.poll(timeout_ms=2000)
            for _tp, batch in records.items():
                for msg in batch:
                    try:
                        data = msg.value
                        if not isinstance(data, dict):
                            continue
                        lid = str(data.get("listing_id", ""))
                        if not lid:
                            continue
                        topic = msg.topic or ""
                        if LISTING_VIEWED in topic:
                            store.record(lid, "views")
                        elif LISTING_CLICKED in topic:
                            store.record(lid, "clicks")
                    except Exception:
                        logger.exception("demand message handling failed")
    finally:
        consumer.close()


def run_periodic_publish_loop(store: DemandAggregator, interval_sec: float = 60.0) -> None:
    from datetime import date, datetime, timezone

    from shared.fraud_util import fraud_score_for_listing

    producer = _json_producer()
    try:
        while not store._stop.is_set():
            store._stop.wait(interval_sec)
            if store._stop.is_set():
                break
            snap = store.snapshot_and_reset()
            today = date.today().isoformat()
            for listing_id, counts in snap.items():
                views = int(counts.get("views", 0))
                clicks = int(counts.get("clicks", 0))
                conv = (clicks / views) if views else 0.0
                payload: dict[str, Any] = {
                    "listing_id": listing_id,
                    "date": today,
                    "views": views,
                    "clicks": clicks,
                    "bookings": 0,
                    "conversion_rate": round(conv, 6),
                    "fraud_score": fraud_score_for_listing(views=views, clicks=clicks),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                producer.send(_t(DEMAND_METRICS_UPDATED), payload)
            producer.flush()
    finally:
        producer.close()
