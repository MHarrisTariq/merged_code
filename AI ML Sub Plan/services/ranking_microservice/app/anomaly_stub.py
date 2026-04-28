"""Anomaly detection hook — exclude from training; alert admin (AI-ANOMALY)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AnomalyResult:
    score: float
    exclude_from_training: bool


def score_event_stub(click_rate_burst: float, ip_entropy: float) -> AnomalyResult:
    """Trivial heuristic placeholder."""
    raw = 0.6 * min(click_rate_burst, 1.0) + 0.4 * (1.0 - min(ip_entropy, 1.0))
    return AnomalyResult(score=float(raw), exclude_from_training=raw > 0.95)
