"""GAP 12 — streaming updates (Kafka → incremental learning). Stub consumer loop."""

from __future__ import annotations

from collections.abc import Callable


def process_message_stub(payload: dict, handler: Callable[[dict], None]) -> None:
    """Replace with confluent-kafka consumer; handler applies model patch or batch buffer."""
    handler(payload)
