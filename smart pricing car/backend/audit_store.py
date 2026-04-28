from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AUDIT_PATH = Path(__file__).resolve().parent / "runtime" / "quote_audit.jsonl"


def append_audit(record: dict[str, Any], *, path: Path | str | None = None) -> None:
    p = Path(path) if path else AUDIT_PATH
    p.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(record)
    payload["audit_ts"] = datetime.now(timezone.utc).isoformat()
    try:
        with p.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, default=str) + "\n")
    except Exception:
        # Audit failures should not fail pricing requests.
        return

