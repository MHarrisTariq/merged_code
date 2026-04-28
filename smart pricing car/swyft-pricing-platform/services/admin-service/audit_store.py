from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _audit_path() -> Path:
    raw = os.environ.get("SWYFT_AUDIT_PATH", "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parent / "runtime" / "quote_audit.jsonl"


AUDIT_PATH = _audit_path()


def append_audit(record: dict[str, Any], *, path: Path | str | None = None) -> None:
    p = Path(path) if path else _audit_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(record)
    payload["audit_ts"] = datetime.now(timezone.utc).isoformat()
    try:
        with p.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, default=str) + "\n")
    except Exception:
        # Audit failures should not fail pricing requests.
        return

