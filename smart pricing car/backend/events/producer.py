from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


LOCAL_EVENT_PATH = Path(__file__).resolve().parents[1] / "runtime" / "events.jsonl"


class EventProducer:
    def __init__(self):
        self.bootstrap = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "").strip()
        self.topic_prefix = os.environ.get("KAFKA_TOPIC_PREFIX", "").strip()
        self._kafka_producer = None
        if self.bootstrap:
            try:
                from kafka import KafkaProducer  # type: ignore

                self._kafka_producer = KafkaProducer(
                    bootstrap_servers=self.bootstrap,
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                )
            except Exception:
                self._kafka_producer = None

    def _topic(self, topic: str) -> str:
        return f"{self.topic_prefix}{topic}" if self.topic_prefix else topic

    @staticmethod
    def build_event(event_type: str, payload: dict[str, Any], *, trace_id: str | None = None) -> dict[str, Any]:
        return {
            "schemaVersion": "1.0.0",
            "eventType": event_type,
            "id": f"evt_{uuid.uuid4().hex[:16]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "traceparent": trace_id,
            "payload": payload,
        }

    def publish(self, topic: str, event: dict[str, Any]) -> None:
        if self._kafka_producer is not None:
            try:
                self._kafka_producer.send(self._topic(topic), event)
                return
            except Exception:
                pass

        # Local queue fallback.
        LOCAL_EVENT_PATH.parent.mkdir(parents=True, exist_ok=True)
        try:
            with LOCAL_EVENT_PATH.open("a", encoding="utf-8") as f:
                f.write(json.dumps({"topic": topic, "event": event}, default=str) + "\n")
        except Exception:
            return

