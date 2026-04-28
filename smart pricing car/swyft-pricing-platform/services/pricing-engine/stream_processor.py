"""Stream pricing: consume pricing.compute.requested → pricing.recommendation.generated."""

from __future__ import annotations

import logging
import threading
from datetime import date, datetime, timezone
from typing import Any

from kafka import KafkaProducer

from shared.config import kafka_bootstrap_servers, kafka_topic_prefix
from shared.kafka_client import get_consumer
from streaming.topics import PRICING_COMPUTE_REQUESTED, PRICING_RECOMMENDATION_GENERATED

logger = logging.getLogger(__name__)


def _t(name: str) -> str:
    p = kafka_topic_prefix()
    return f"{p}{name}" if p else name


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def compute_stream_price(
    base: float,
    demand_score: float,
    supply_score: float,
    min_price: float,
    max_price: float,
) -> float:
    price = base * (1 + demand_score * 0.1) * (1 - supply_score * 0.05)
    return _clamp(price, min_price, max_price)


def _producer() -> KafkaProducer:
    import json

    return KafkaProducer(
        bootstrap_servers=kafka_bootstrap_servers(),
        value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
    )


def run_stream_processor(stop_event: threading.Event) -> None:
    consumer = get_consumer(
        PRICING_COMPUTE_REQUESTED,
        group_id="pricing-engine-stream",
        auto_offset_reset="earliest",
    )
    producer = _producer()
    logger.info("pricing stream processor listening on %s", PRICING_COMPUTE_REQUESTED)
    try:
        while not stop_event.is_set():
            records = consumer.poll(timeout_ms=2000)
            for _tp, batch in records.items():
                for msg in batch:
                    try:
                        data = msg.value
                        if not isinstance(data, dict):
                            continue
                        asset_type = data.get("asset_type", "car")
                        base = float(data.get("base_price", 0))
                        dscore = float(data.get("demand_score", 0))
                        sscore = float(data.get("supply_score", 0))
                        lo = float(data.get("min_price", 0))
                        hi = float(data.get("max_price", base or 1))
                        if hi < lo:
                            lo, hi = hi, lo
                        price = compute_stream_price(base, dscore, sscore, lo, hi)
                        out: dict[str, Any] = {
                            "listing_id": str(data.get("listing_id", "")),
                            "price": round(price, 2),
                            "date": data.get("target_date") or date.today().isoformat(),
                            "confidence_score": data.get("confidence_score"),
                            "model_version": data.get("model_version", "stream-v1"),
                            "asset_type": asset_type,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                        producer.send(_t(PRICING_RECOMMENDATION_GENERATED), out)
                        producer.flush()
                    except Exception:
                        logger.exception("stream pricing failed")
    finally:
        consumer.close()
        producer.close()
