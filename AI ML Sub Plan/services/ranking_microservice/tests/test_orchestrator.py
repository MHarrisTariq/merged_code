from app.decision_orchestrator import CandidateInput, DecisionOrchestrator


def test_platinum_higher_effective_promotion_than_free():
    orch = DecisionOrchestrator()
    free = CandidateInput(
        listing_id="a",
        host_id="h1",
        base_score=1.0,
        plan_id="FREE",
        subscription_status="ACTIVE",
        promotion_weight=1.0,
        price=100.0,
        listing_quality=0.5,
        position_hint=0,
    )
    plat = CandidateInput(
        listing_id="b",
        host_id="h1",
        base_score=1.0,
        plan_id="PLATINUM",
        subscription_status="ACTIVE",
        promotion_weight=1.0,
        price=100.0,
        listing_quality=0.5,
        position_hint=0,
    )
    sf = orch.score_one(free, user_id=None, query_id="q")
    sp = orch.score_one(plat, user_id=None, query_id="q")
    assert sp.effective_promotion_weight > sf.effective_promotion_weight


def test_expired_subscription_zeroes_promo_weight_effect():
    orch = DecisionOrchestrator()
    c = CandidateInput(
        listing_id="x",
        host_id="h1",
        base_score=1.0,
        plan_id="PLATINUM",
        subscription_status="EXPIRED",
        promotion_weight=2.0,
        price=50.0,
        listing_quality=0.8,
        position_hint=1,
    )
    sc = orch.score_one(c, user_id=None, query_id="q")
    assert sc.effective_promotion_weight == 0.0


def test_max_promoted_listings_caps_promotion_weight():
    orch = DecisionOrchestrator()
    at_cap = CandidateInput(
        listing_id="cap",
        host_id="h1",
        base_score=1.0,
        plan_id="SILVER",
        subscription_status="ACTIVE",
        promotion_weight=1.5,
        price=80.0,
        listing_quality=0.6,
        host_promoted_count=5,
        host_max_promoted_listings=5,
    )
    sc = orch.score_one(at_cap, user_id=None, query_id="q")
    assert sc.effective_promotion_weight == 0.0


def test_expected_value_in_components():
    orch = DecisionOrchestrator()
    c = CandidateInput(
        listing_id="ev",
        host_id="h1",
        base_score=1.0,
        plan_id="FREE",
        subscription_status="ACTIVE",
        promotion_weight=1.0,
        price=200.0,
        listing_quality=0.7,
    )
    sc = orch.score_one(c, user_id="u1", query_id="q1")
    assert sc.expected_value >= 0.0
    assert sc.multi_objective > 0.0
