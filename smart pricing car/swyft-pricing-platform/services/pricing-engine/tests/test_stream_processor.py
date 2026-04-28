from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from stream_processor import compute_stream_price


def test_compute_stream_price_clamp():
    p = compute_stream_price(100.0, 0.5, 0.5, 50.0, 200.0)
    assert 50.0 <= p <= 200.0
