# State-of-the-art upgrade — architecture (from gap analysis)

This document implements the “upgrade to state-of-the-art AI system” items from **AI ML Subscription Plan.docx**: causal inference, exploration, bias correction, parity, governance, delayed feedback, multi-objective balance, fraud hooks, orchestration, and phased advanced ML.

## 1. Contextual bandits (GAP-EXPLORE)

- **Current code:** `services/ranking_microservice/app/bandit_policy.py` (epsilon-greedy; LinUCB placeholder).
- **Integration:** `decision_orchestrator.py` applies exploration noise when epsilon triggers; swap policy class without changing HTTP API.

## 2. Causal inference (GAP-CAUSAL)

- **Training:** `ml_pipeline/causal/ips_weights.py` — IPS weights with clipping; extend with learned propensity P(position | context) and doubly robust estimators.
- **Objective:** Train on IPS-weighted outcomes to approximate P(click | do(rank=k)) offline.

## 3. Position bias (GAP-BIAS)

- **Requirement:** Include `position` in CTR training (`feature_contract.yaml`); consider PBM/DBN as model class upgrade.
- **Serving:** Pass `position_hint` from the ranking request for aligned inference.

## 4. Feature parity (GAP-PARITY)

- **Contract:** `ml_pipeline/feature_contract.yaml`
- **CI:** `ml_pipeline/parity_check.py` compares training vs serving JSON samples; fails build on mismatch.

## 5. Model governance (GAP-GOV)

- **Headers:** `X-Model-Version` on `/v1/rank/score` responses.
- **Registry:** `mongodb/schemas/model_registry.json` mirrors MLflow for ops queries; MLflow remains source of truth.

## 6. Delayed feedback (GAP-DELAY)

- **Approach:** Configurable booking attribution window; backfill late conversions into labels (see backlog `AI-FEEDBACK`, `GAP-DELAY`).

## 7. Multi-objective optimization (GAP 7)

- **Weights:** `ScoringConfig` in `app/config.py` — extend with explicit fairness proxy and host satisfaction when metrics exist.

## 8. Fraud / adversarial (GAP-FRAUD)

- **Hook:** `app/anomaly_stub.py`; production replaces with graph/sequence fraud models; can gate `exclude_from_training` on events.

## 9. Decision orchestrator (GAP-ORCH)

- **Implementation:** `app/decision_orchestrator.py` — fixed stage order: CTR → CVR → EV → personalization → exploration → deterministic promotion → CTR threshold downrank.

## 10. Online learning (GAP-ONLINE)

- **Status:** ADR placeholder in backlog only; Kafka → incremental updates is a separate hardening phase.

## 11. Advanced ML (embeddings, graph, sequences)

- **Approach:** Optional listing embedding column in feature store; graph and session models as separate training jobs — see backlog `GAP-ADV-ML`.

## Reference flow (from requirements doc)

Search query → candidate listings → feature store → AI models (CTR, CVR, personalization) → ranking engine → deterministic promotion constraints → results → tracking → feedback → retraining.
