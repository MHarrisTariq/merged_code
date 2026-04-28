from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from ml.rl.q_agent import QPricingAgent, train_offline_episodes


def test_q_agent_update():
    a = QPricingAgent()
    a.update((1, 1, 2), 0, 10.0, (1, 1, 3))
    assert a.choose_action((1, 1, 2), training=False) in (0, 1, 2)


def test_train_offline():
    tr = [
        {"demand_level": 1, "supply_pressure": 1, "day_of_week": 1, "action": 2, "booking_revenue": 5.0, "ndemand": 1, "nsupply": 1, "ndow": 2},
    ]
    agent = train_offline_episodes(tr, episodes=5)
    assert isinstance(agent, QPricingAgent)
