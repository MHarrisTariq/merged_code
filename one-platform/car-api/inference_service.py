from __future__ import annotations

from typing import Any, Callable

from admin_controls import AdminControlsStore
from audit_store import append_audit
from events.producer import EventProducer
from features import derive_request_features
from guardrails import GuardrailConfig, apply_guardrails
from optimizer import optimize_price, simulate_price_sweep
from pricing_engine import build_pricing_decision
from probability_model import BookingProbabilityModel


class InferenceService:
    def __init__(
        self,
        *,
        prob_model: BookingProbabilityModel,
        admin_store: AdminControlsStore | None = None,
        event_producer: EventProducer | None = None,
    ):
        self.prob_model = prob_model
        self.admin_store = admin_store or AdminControlsStore()
        self.event_producer = event_producer or EventProducer()

    @staticmethod
    def _booking_region(booking: dict[str, Any]) -> str | None:
        v = booking.get("country") or booking.get("city")
        return str(v).strip().lower() if v else None

    def _guardrail_cfg(self, booking: dict[str, Any]) -> tuple[GuardrailConfig, float]:
        region = self._booking_region(booking)
        caps = self.admin_store.resolve_caps(region)
        multiplier = float(caps.get("multiplier", 1.0))
        cfg = GuardrailConfig(
            min_price_gbp=float(caps.get("min_price_gbp", 5.0)),
            max_price_gbp=float(caps.get("max_price_gbp", 8000.0)),
            max_pct_change=float(caps.get("max_pct_change", 0.2)),
            smoothing_alpha=float(caps.get("smoothing_alpha", 0.8)),
        )
        return cfg, multiplier

    def quote(self, booking: dict[str, Any], *, base_quote: dict[str, Any]) -> dict[str, Any]:
        state = self.admin_store.load()
        features = derive_request_features(booking)
        booking_with_features = {**booking, **features}
        baseline = float(base_quote["predicted_total_gbp"])

        if state.get("kill_switch", False):
            decision = build_pricing_decision(booking_with_features, baseline_price_gbp=baseline)
            recommended = baseline
            guard_flags = ["kill_switch_active"]
            guardrail = {"final_price_gbp": baseline}
        else:
            decision = build_pricing_decision(booking_with_features, baseline_price_gbp=baseline)
            cfg, multiplier = self._guardrail_cfg(booking_with_features)
            candidate = float(decision.recommended_price) * multiplier
            recommended, guard_flags, guardrail = apply_guardrails(
                candidate,
                baseline_price_gbp=baseline,
                cfg=cfg,
            )

        out = {
            **base_quote,
            "recommended_price": round(float(recommended), 2),
            "confidence_score": float(decision.confidence_score),
            "explanation_tags": list(decision.explanation_tags) + guard_flags,
            "price_components": {
                **decision.price_components,
                "guardrail_final_price": round(float(recommended), 2),
            },
            "guardrail": guardrail,
        }

        self.event_producer.publish(
            "pricing.quote.completed",
            self.event_producer.build_event(
                "pricing.quote.completed",
                {
                    "quote_id": out.get("quote_id"),
                    "source": out.get("source"),
                    "model_version": out.get("model_version"),
                    "recommended_price": out.get("recommended_price"),
                    "currency": out.get("currency", "GBP"),
                },
                trace_id=str(out.get("quote_id")),
            ),
        )

        append_audit(
            {
                "quote_id": out.get("quote_id"),
                "source": out.get("source"),
                "model_version": out.get("model_version"),
                "recommended_price": out.get("recommended_price"),
                "confidence_score": out.get("confidence_score"),
                "explanation_tags": out.get("explanation_tags"),
            }
        )
        return out

    def optimize(
        self,
        booking: dict[str, Any],
        *,
        base_quote: dict[str, Any],
        min_price_gbp: float,
        max_price_gbp: float,
        step_gbp: float,
        window_pct: float,
    ) -> dict[str, Any]:
        booking_with_features = {**booking, **derive_request_features(booking)}
        base_price = float(base_quote["predicted_total_gbp"])
        w = float(window_pct)
        min_p = max(float(min_price_gbp), base_price * (1.0 - w))
        max_p = min(float(max_price_gbp), base_price * (1.0 + w))

        def prob_fn(b: dict[str, Any], candidate: float) -> float:
            return self.prob_model.predict_one(b, candidate_price_gbp=candidate, reference_price_gbp=base_price)

        best, evals = optimize_price(
            booking_with_features,
            min_price_gbp=min_p,
            max_price_gbp=max_p,
            step_gbp=float(step_gbp),
            booking_probability_fn=prob_fn,
        )
        decision = build_pricing_decision(booking_with_features, baseline_price_gbp=base_price)

        return {
            "baseline_quote": base_quote,
            "prob_model_version": self.prob_model.model_version_label(),
            "range": {"min_price_gbp": min_p, "max_price_gbp": max_p, "step_gbp": float(step_gbp)},
            "best": {
                "price_gbp": best.price_gbp,
                "booking_probability": best.booking_probability,
                "expected_revenue": best.expected_revenue,
            },
            "recommended_price": round(float(best.price_gbp), 2),
            "confidence_score": decision.confidence_score,
            "explanation_tags": decision.explanation_tags,
            "price_components": decision.price_components,
            "optimization_candidates": len(evals),
        }

    def simulate(
        self,
        booking: dict[str, Any],
        *,
        base_quote: dict[str, Any],
        min_price_gbp: float,
        max_price_gbp: float,
        step_gbp: float,
        window_pct: float,
    ) -> dict[str, Any]:
        booking_with_features = {**booking, **derive_request_features(booking)}
        base_price = float(base_quote["predicted_total_gbp"])
        w = float(window_pct)
        min_p = max(float(min_price_gbp), base_price * (1.0 - w))
        max_p = min(float(max_price_gbp), base_price * (1.0 + w))

        def prob_fn(b: dict[str, Any], candidate: float) -> float:
            return self.prob_model.predict_one(b, candidate_price_gbp=candidate, reference_price_gbp=base_price)

        evals = simulate_price_sweep(
            booking_with_features,
            min_price_gbp=min_p,
            max_price_gbp=max_p,
            step_gbp=float(step_gbp),
            booking_probability_fn=prob_fn,
        )
        best = max(evals, key=lambda e: (e.expected_revenue, e.booking_probability, -e.price_gbp))
        decision = build_pricing_decision(booking_with_features, baseline_price_gbp=base_price)
        return {
            "baseline_quote": base_quote,
            "prob_model_version": self.prob_model.model_version_label(),
            "range": {"min_price_gbp": min_p, "max_price_gbp": max_p, "step_gbp": float(step_gbp)},
            "best": {
                "price_gbp": best.price_gbp,
                "booking_probability": best.booking_probability,
                "expected_revenue": best.expected_revenue,
            },
            "curve": [
                {
                    "price_gbp": e.price_gbp,
                    "booking_probability": e.booking_probability,
                    "expected_revenue": e.expected_revenue,
                }
                for e in evals
            ],
            "count": len(evals),
            "recommended_price": round(float(best.price_gbp), 2),
            "confidence_score": decision.confidence_score,
            "explanation_tags": decision.explanation_tags,
            "price_components": decision.price_components,
        }

