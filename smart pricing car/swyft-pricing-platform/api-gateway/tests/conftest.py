from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parents[2]
_api = Path(__file__).resolve().parents[1]
_pe = _root / "services" / "pricing-engine"
_adm = _root / "services" / "admin-service"
for p in (_root, _api, _pe, _adm):
    s = str(p)
    if s not in sys.path:
        sys.path.insert(0, s)
