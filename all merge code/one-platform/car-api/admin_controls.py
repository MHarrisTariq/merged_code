from __future__ import annotations

import json
from pathlib import Path
from typing import Any


STATE_PATH = Path(__file__).resolve().parent / "runtime" / "admin_config.json"


DEFAULT_STATE: dict[str, Any] = {
    "kill_switch": False,
    "global_caps": {
        "min_price_gbp": 5.0,
        "max_price_gbp": 8000.0,
        "max_pct_change": 0.2,
        "smoothing_alpha": 0.8,
    },
    "regions": {},
}


class AdminControlsStore:
    def __init__(self, path: Path | str | None = None):
        self.path = Path(path) if path else STATE_PATH
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.is_file():
            self.save(DEFAULT_STATE)

    def load(self) -> dict[str, Any]:
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                return dict(DEFAULT_STATE)
            out = dict(DEFAULT_STATE)
            out.update(raw)
            return out
        except Exception:
            return dict(DEFAULT_STATE)

    def save(self, state: dict[str, Any]) -> None:
        self.path.write_text(json.dumps(state, indent=2), encoding="utf-8")

    def set_kill_switch(self, enabled: bool) -> dict[str, Any]:
        s = self.load()
        s["kill_switch"] = bool(enabled)
        self.save(s)
        return s

    def set_global_caps(self, *, min_price_gbp: float, max_price_gbp: float, max_pct_change: float, smoothing_alpha: float) -> dict[str, Any]:
        s = self.load()
        s["global_caps"] = {
            "min_price_gbp": float(min_price_gbp),
            "max_price_gbp": float(max_price_gbp),
            "max_pct_change": float(max_pct_change),
            "smoothing_alpha": float(smoothing_alpha),
        }
        self.save(s)
        return s

    def set_region_override(self, region: str, values: dict[str, float]) -> dict[str, Any]:
        s = self.load()
        regions = dict(s.get("regions", {}))
        regions[str(region).strip().lower()] = {
            "min_price_gbp": float(values.get("min_price_gbp", s["global_caps"]["min_price_gbp"])),
            "max_price_gbp": float(values.get("max_price_gbp", s["global_caps"]["max_price_gbp"])),
            "max_pct_change": float(values.get("max_pct_change", s["global_caps"]["max_pct_change"])),
            "smoothing_alpha": float(values.get("smoothing_alpha", s["global_caps"]["smoothing_alpha"])),
            "multiplier": float(values.get("multiplier", 1.0)),
        }
        s["regions"] = regions
        self.save(s)
        return s

    def resolve_caps(self, region: str | None) -> dict[str, float]:
        s = self.load()
        g = dict(s.get("global_caps", {}))
        if region:
            r = str(region).strip().lower()
            region_cfg = s.get("regions", {}).get(r)
            if isinstance(region_cfg, dict):
                merged = dict(g)
                merged.update(region_cfg)
                return merged
        return g

