"""
Tabular Q-learning pricing agent (offline training).
State: (demand_level_bucket, supply_pressure_bucket, day_of_week)
Actions: 0 decrease price, 1 hold, 2 increase price
Reward: booking_revenue (0 if not booked)
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any


class QPricingAgent:
    def __init__(self, *, alpha: float = 0.15, gamma: float = 0.9, epsilon: float = 0.1):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.q: dict[tuple[int, int, int, int], list[float]] = {}

    def _state_key(self, demand_level: int, supply_pressure: int, dow: int) -> tuple[int, int, int]:
        return (int(demand_level), int(supply_pressure), int(dow % 7))

    def choose_action(self, state: tuple[int, int, int], training: bool = False) -> int:
        k = self._state_key(*state)
        if k not in self.q:
            self.q[k] = [0.0, 0.0, 0.0]
        if training and random.random() < self.epsilon:
            return random.randint(0, 2)
        return int(max(range(3), key=lambda a: self.q[k][a]))

    def update(self, state: tuple[int, int, int], action: int, reward: float, next_state: tuple[int, int, int]) -> None:
        k = self._state_key(*state)
        nk = self._state_key(*next_state)
        if k not in self.q:
            self.q[k] = [0.0, 0.0, 0.0]
        if nk not in self.q:
            self.q[nk] = [0.0, 0.0, 0.0]
        best_next = max(self.q[nk])
        td_target = reward + self.gamma * best_next
        self.q[k][action] += self.alpha * (td_target - self.q[k][action])

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        serializable = {f"{k[0]},{k[1]},{k[2]}": v for k, v in self.q.items()}
        path.write_text(json.dumps(serializable), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> QPricingAgent:
        agent = cls()
        if not path.is_file():
            return agent
        raw = json.loads(path.read_text(encoding="utf-8"))
        for ks, v in raw.items():
            a, b, c = ks.split(",")
            agent.q[(int(a), int(b), int(c))] = list(v)
        return agent


def train_offline_episodes(transitions: list[dict[str, Any]], *, episodes: int = 500) -> QPricingAgent:
    agent = QPricingAgent()
    for _ in range(episodes):
        for tr in transitions:
            s = (int(tr["demand_level"]), int(tr["supply_pressure"]), int(tr["day_of_week"]))
            a = int(tr["action"])
            r = float(tr.get("booking_revenue", 0.0))
            ns = (int(tr["ndemand"]), int(tr["nsupply"]), int(tr["ndow"]))
            agent.update(s, a, r, ns)
    return agent
