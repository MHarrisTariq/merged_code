from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GuardrailConfig:
    min_price_gbp: float
    max_price_gbp: float
    max_pct_change: float = 0.2
    smoothing_alpha: float = 0.8


def apply_guardrails(
    candidate_price_gbp: float,
    *,
    baseline_price_gbp: float,
    cfg: GuardrailConfig,
) -> tuple[float, list[str], dict[str, float]]:
    """
    Clamp by absolute bounds + bounded daily change + light smoothing.
    """

    flags: list[str] = []
    p = float(candidate_price_gbp)
    base = max(float(baseline_price_gbp), 0.01)

    # Limit relative change from baseline.
    pct = max(0.0, float(cfg.max_pct_change))
    lo_rel = base * (1.0 - pct)
    hi_rel = base * (1.0 + pct)
    if p < lo_rel:
        p = lo_rel
        flags.append("clamped_max_downward_change")
    if p > hi_rel:
        p = hi_rel
        flags.append("clamped_max_upward_change")

    # Smooth toward baseline to reduce volatility.
    alpha = min(1.0, max(0.0, float(cfg.smoothing_alpha)))
    p = alpha * p + (1.0 - alpha) * base
    if alpha < 1.0:
        flags.append("smoothed_vs_baseline")

    # Hard floor/cap.
    if p < cfg.min_price_gbp:
        p = float(cfg.min_price_gbp)
        flags.append("clamped_min_price")
    if p > cfg.max_price_gbp:
        p = float(cfg.max_price_gbp)
        flags.append("clamped_max_price")

    final_price = round(float(p), 2)
    details = {
        "baseline_price_gbp": round(base, 2),
        "candidate_price_gbp": round(float(candidate_price_gbp), 2),
        "final_price_gbp": final_price,
        "max_pct_change": float(cfg.max_pct_change),
        "smoothing_alpha": float(cfg.smoothing_alpha),
    }
    return final_price, flags, details

