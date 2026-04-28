from __future__ import annotations

from guardrails import GuardrailConfig, apply_guardrails


def test_guardrails_clamp_and_smooth():
    cfg = GuardrailConfig(min_price_gbp=50.0, max_price_gbp=150.0, max_pct_change=0.2, smoothing_alpha=0.8)
    final_price, flags, details = apply_guardrails(
        250.0,
        baseline_price_gbp=100.0,
        cfg=cfg,
    )
    assert final_price <= 150.0
    assert details["baseline_price_gbp"] == 100.0
    assert "clamped_max_upward_change" in flags

