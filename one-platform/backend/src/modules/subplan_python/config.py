from pydantic import BaseModel, Field


class ScoringConfig(BaseModel):
    """
    Doc §5–§7, §12, §16, GAP 7: composite ranking + EV as revenue proxy + fairness + personalization.
    """

    # Doc §7 / GAP 7 — multi-objective: w1*revenue + w2*fairness + w3*CTR (revenue ≈ expected_value)
    w_revenue: float = Field(default=0.45, ge=0, description="Weight on EV = ctr*cvr*price")
    w_fairness: float = Field(default=0.2, ge=0, description="Fairness / UX proxy term")
    w_ctr_term: float = Field(default=0.35, ge=0, description="CTR term in multi-objective")

    # Doc §5 — supporting signals
    w_base: float = Field(default=0.25, ge=0)
    w_quality: float = Field(default=0.12, ge=0)
    w_personalization_blend: float = Field(default=0.05, ge=0, description="Small blend before additive term")

    # Doc §12 — final_score += personalization_weight(user, listing)
    personalization_additive_scale: float = Field(default=0.12, ge=0)

    fairness_proxy_default: float = Field(default=0.5, ge=0, le=1)

    ctr_threshold_downrank: float = Field(default=0.02, ge=0, le=1)
    downrank_factor: float = Field(default=0.85, gt=0, le=1)

    exploration_epsilon: float = Field(default=0.05, ge=0, le=1)
    exploration_noise_scale: float = Field(default=0.02, ge=0)

    min_promotion_weight_free: float = Field(default=1.0, ge=0)
    plan_boost_silver: float = Field(default=1.05, ge=0)
    plan_boost_platinum: float = Field(default=1.12, ge=0)

    # Doc §10 / GAP 11 — RL nudge scale (optional)
    rl_score_delta_scale: float = Field(default=0.02, ge=0)

    # Doc §16 — free tier floor vs organic baseline
    free_tier_organic_baseline: float = Field(default=1.0, ge=0)
    free_tier_floor_ratio: float = Field(default=0.92, ge=0, le=1)


def default_config() -> ScoringConfig:
    return ScoringConfig()
