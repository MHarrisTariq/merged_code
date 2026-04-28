from __future__ import annotations

from pathlib import Path

from admin_controls import AdminControlsStore


def test_admin_controls_kill_switch_and_region_override(tmp_path: Path):
    store = AdminControlsStore(path=tmp_path / "admin_config.json")
    state = store.set_kill_switch(True)
    assert state["kill_switch"] is True

    store.set_global_caps(min_price_gbp=10.0, max_price_gbp=500.0, max_pct_change=0.15, smoothing_alpha=0.7)
    store.set_region_override(
        "gb",
        {
            "min_price_gbp": 12.0,
            "max_price_gbp": 400.0,
            "max_pct_change": 0.1,
            "smoothing_alpha": 0.9,
            "multiplier": 1.1,
        },
    )
    caps = store.resolve_caps("GB")
    assert caps["min_price_gbp"] == 12.0
    assert caps["multiplier"] == 1.1

