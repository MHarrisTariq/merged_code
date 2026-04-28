from __future__ import annotations

import sys
from pathlib import Path

_plat = Path(__file__).resolve().parents[3]
_svc = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_plat))
sys.path.insert(0, str(_svc))

from fastapi.testclient import TestClient

from main import app


def test_health():
    c = TestClient(app)
    r = c.get("/health")
    assert r.status_code == 200
    assert r.json().get("ok") is True
