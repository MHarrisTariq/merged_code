"""
Real-time decision orchestrator (doc §5, §7, §10–12, §18; GAP 7, GAP 11):
CTR → CVR → EV → multi-objective (revenue/fairness/CTR) → base/quality/personalization blend
→ exploration → deterministic promotion_weight (plan + caps) → CTR threshold downrank
→ additive personalization (§12) → free-tier fairness floor (§16) → optional RL nudge (§10).
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any

from .config import ScoringConfig, default_config
from .deterministic import DeterministicContext, effective_promotion_weight
from .fairness_policy import apply_free_tier_floor
from .model_stubs import (
    CTRModelStub,
    ConversionModelStub,
    PersonalizationStub,
    PredictionContext,
    expected_value,
)
from .promotion_caps import clip_promotion_weight_by_cap
from .rl_policy_hook import rl_delta, state_from_predictions


@dataclass
class CandidateInput:
    listing_id: str
    host_id: str
    base_score: float
    plan_id: str
    subscription_status: str
    promotion_weight: float
    price: float
    listing_quality: float
    position_hint: int = 0
    device_type: str = "unknown"
    host_promoted_count: int | None = None
    host_max_promoted_listings: int | None = None


@dataclass
class ScoreComponents:
    base_score: float
    pred_ctr: float
    pred_cvr: float
    expected_value: float
    multi_objective: float
    personalization_blend: float
    personalization: float
    personalization_additive: float
    exploration_delta: float
    rl_delta: float
    ai_composite: float
    effective_promotion_weight: float
    final_score: float


class DecisionOrchestrator:
    def __init__(
        self,
        cfg: ScoringConfig | None = None,
        ctr: CTRModelStub | None = None,
        cvr: ConversionModelStub | None = None,
        perso: PersonalizationStub | None = None,
    ) -> None:
        self.cfg = cfg or default_config()
        self.ctr = ctr or CTRModelStub()
        self.cvr = cvr or ConversionModelStub()
        self.perso = perso or PersonalizationStub()
        self.model_versions = {
            "ctr": self.ctr.name,
            "conversion": self.cvr.name,
            "personalization": self.perso.name,
            "rl_policy": "rl_policy_hook_1.0.0",
            "decision_orchestrator": "1.1.0",
        }

    def score_one(
        self,
        c: CandidateInput,
        *,
        user_id: str | None,
        query_id: str,
        rng: random.Random | None = None,
    ) -> ScoreComponents:
        rng = rng or random.Random(hash(query_id + c.listing_id) % (2**32))
        ctx = PredictionContext(
            listing_id=c.listing_id,
            position=c.position_hint,
            device_type=c.device_type,
            price=c.price,
            listing_quality=c.listing_quality,
        )
        pred_ctr = self.ctr.predict(ctx)
        pred_cvr = self.cvr.predict(ctx)
        ev = expected_value(pred_ctr, pred_cvr, c.price)
        perso = self.perso.weight(user_id, c.listing_id)

        fairness_proxy = self.cfg.fairness_proxy_default
        # Doc §7 + GAP 7: w1*revenue + w2*fairness + w3*CTR (revenue proxy = EV)
        multi_objective = (
            self.cfg.w_revenue * ev
            + self.cfg.w_fairness * fairness_proxy
            + self.cfg.w_ctr_term * pred_ctr
        )

        support = (
            self.cfg.w_base * c.base_score
            + self.cfg.w_quality * c.listing_quality
            + self.cfg.w_personalization_blend * perso
        )

        exploration_delta = 0.0
        if rng.random() < self.cfg.exploration_epsilon:
            exploration_delta = rng.uniform(0, self.cfg.exploration_noise_scale)

        ai_pre_rl = multi_objective + support + exploration_delta

        rl_state = state_from_predictions(ctx, pred_ctr, pred_cvr)
        rl_d = rl_delta(rl_state, self.cfg.rl_score_delta_scale)
        ai_composite = ai_pre_rl + rl_d

        pw = clip_promotion_weight_by_cap(
            c.promotion_weight,
            c.host_promoted_count,
            c.host_max_promoted_listings,
        )
        det = DeterministicContext(
            plan_id=c.plan_id,
            subscription_status=c.subscription_status,
            promotion_weight=pw,
        )
        eff_promo = effective_promotion_weight(det, self.cfg)

        boosted = ai_composite * eff_promo if eff_promo > 0 else ai_composite * 0.25

        if pred_ctr < self.cfg.ctr_threshold_downrank:
            boosted *= self.cfg.downrank_factor

        # Doc §12: additive personalization_weight
        perso_add = self.cfg.personalization_additive_scale * perso
        after_perso = boosted + perso_add

        # Doc §16: fairness floor for Free tier
        final = apply_free_tier_floor(
            after_perso,
            c.plan_id,
            organic_score_baseline=self.cfg.free_tier_organic_baseline,
            floor_ratio_vs_organic=self.cfg.free_tier_floor_ratio,
        )

        return ScoreComponents(
            base_score=c.base_score,
            pred_ctr=pred_ctr,
            pred_cvr=pred_cvr,
            expected_value=ev,
            multi_objective=multi_objective,
            personalization_blend=self.cfg.w_personalization_blend * perso,
            personalization=perso,
            personalization_additive=perso_add,
            exploration_delta=exploration_delta,
            rl_delta=rl_d,
            ai_composite=ai_composite,
            effective_promotion_weight=eff_promo,
            final_score=final,
        )

    def rank(
        self,
        candidates: list[CandidateInput],
        *,
        user_id: str | None,
        query_id: str,
    ) -> list[tuple[CandidateInput, ScoreComponents]]:
        scored: list[tuple[CandidateInput, ScoreComponents]] = []
        for c in candidates:
            sc = self.score_one(c, user_id=user_id, query_id=query_id)
            scored.append((c, sc))
        scored.sort(key=lambda x: x[1].final_score, reverse=True)
        return scored


def components_to_dict(sc: ScoreComponents) -> dict[str, Any]:
    return {
        "base_score": sc.base_score,
        "pred_ctr": sc.pred_ctr,
        "pred_cvr": sc.pred_cvr,
        "expected_value": sc.expected_value,
        "multi_objective": sc.multi_objective,
        "personalization_blend": sc.personalization_blend,
        "personalization": sc.personalization,
        "personalization_additive": sc.personalization_additive,
        "exploration_delta": sc.exploration_delta,
        "rl_delta": sc.rl_delta,
        "ai_composite": sc.ai_composite,
        "effective_promotion_weight": sc.effective_promotion_weight,
        "final_score": sc.final_score,
    }
