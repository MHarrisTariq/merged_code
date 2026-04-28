"""
Inverse Propensity Scoring (IPS) helpers for causal-style training (GAP-CAUSAL).
Replace propensity P(position | context) with a real model; this module shows weight caps.
"""

from __future__ import annotations

import numpy as np


def ips_weight(propensity: float, clip_min: float = 0.01, clip_max: float = 10.0) -> float:
    p = float(np.clip(propensity, clip_min, 1.0))
    w = 1.0 / p
    return float(np.clip(w, clip_min, clip_max))


def doubly_robust_residual(ips_weight: float, outcome: float, imputed_mean: float) -> float:
    """Simple DR-style residual for documentation; extend with full DR estimator in production."""
    return ips_weight * (outcome - imputed_mean) + imputed_mean
