"""
Contextual bandit policy interface (GAP-EXPLORE).
Pluggable: epsilon-greedy now; swap for LinUCB / Thompson without changing API.
"""

from __future__ import annotations

import random
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class BanditState:
    epsilon: float


class BanditPolicy(ABC):
    @abstractmethod
    def should_explore(self, rng: random.Random) -> bool:
        pass


class EpsilonGreedyPolicy(BanditPolicy):
    def __init__(self, epsilon: float) -> None:
        self.state = BanditState(epsilon=epsilon)

    def should_explore(self, rng: random.Random) -> bool:
        return rng.random() < self.state.epsilon


class LinUCBPlaceholder(BanditPolicy):
    """Placeholder for LinUCB — implement arm features + A matrix update."""

    def should_explore(self, rng: random.Random) -> bool:
        _ = rng
        return False
