"""GAP 10 — graph-based fraud signal (user–listing–booking graph)."""

from __future__ import annotations


def graph_fraud_score_stub(edge_count_suspicious: int) -> float:
    return min(1.0, edge_count_suspicious / 10.0)
