# Position-aware click models (GAP 3)

The requirements document references **PBM** (Position-Based Model) and **DBN** (Dynamic Bayesian Network) for position bias correction when training CTR models.

- Include **position** as an explicit feature at minimum (`feature_contract.yaml` → `context.position`).
- For production, evaluate cascade models (PBM/DBN) or joint learning with propensity scores; pair with **IPS** weights in `../causal/ips_weights.py`.

See also: `../causal/ips_weights.py` for inverse propensity scoring during training.
