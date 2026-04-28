"""RL hook (doc §10 + GAP 11): optional score nudge from policy — wire real policy later."""

from __future__ import annotations

from dataclasses import dataclass

from .model_stubs import PredictionContext


@dataclass
class RLState:
    ctr: float
    conversion: float
    position: int
    revenue_7d: float


def rl_delta(state: RLState, scale: float) -> float:
    """Map state to [-1, 1] nudge, scaled."""
    if state.ctr < 0.02:
        return scale * 0.5
    return -scale * 0.1


def state_from_predictions(ctx: PredictionContext, pred_ctr: float, pred_cvr: float) -> RLState:
    return RLState(
        ctr=pred_ctr,
        conversion=pred_cvr,
        position=ctx.position,
        revenue_7d=0.0,
    )
