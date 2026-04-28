from __future__ import annotations

from pathlib import Path

from events.consumer import read_local_events
from events.producer import EventProducer


def test_event_producer_local_queue_fallback(monkeypatch, tmp_path: Path):
    import events.producer as pmod

    monkeypatch.setenv("KAFKA_BOOTSTRAP_SERVERS", "")
    monkeypatch.setattr(pmod, "LOCAL_EVENT_PATH", tmp_path / "events.jsonl")

    producer = EventProducer()
    event = producer.build_event("pricing.quote.requested", {"city": "London"})
    producer.publish("pricing.quote.requested", event)

    rows = read_local_events(limit=10)
    # consumer reads default path; read file directly from patched path for deterministic assertion
    lines = (tmp_path / "events.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(lines) >= 1
    assert "pricing.quote.requested" in lines[-1]
    assert isinstance(rows, list)

