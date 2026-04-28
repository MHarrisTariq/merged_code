from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from events.producer import LOCAL_EVENT_PATH


def read_local_events(*, limit: int = 100) -> list[dict[str, Any]]:
    """
    Lightweight local-consumer helper for development and tests.
    """
    p: Path = LOCAL_EVENT_PATH
    if not p.is_file():
        return []
    lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
    out: list[dict[str, Any]] = []
    for line in lines[-int(limit) :]:
        try:
            out.append(json.loads(line))
        except Exception:
            continue
    return out

