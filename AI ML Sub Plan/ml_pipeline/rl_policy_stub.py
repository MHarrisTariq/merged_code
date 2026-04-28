"""
Reinforcement learning policy stub (doc §10 Reinforcement Learning — NEXT LEVEL).
State: listing performance, CTR, conversion, position.
Action: increase/decrease boost or reorder.
Reward: bookings + revenue.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class RLState:
    ctr: float
    conversion: float
    position: int
    revenue_7d: float


class RLPolicyStub:
    def select_action(self, state: RLState) -> dict[str, Any]:
        """Return structured action; replace with trained policy later."""
        if state.ctr < 0.02:
            return {"type": "increase_boost", "delta": 0.05}
        return {"type": "hold", "delta": 0.0}
