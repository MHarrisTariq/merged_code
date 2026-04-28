# Document → repository coverage matrix

This matrix maps **every numbered requirement and gap** in `AI ML Subscription Plan.docx` to concrete artifacts in this folder. “Stub” means interface or placeholder until data/services exist; “live” means implemented in the ranking path.

| Doc reference | Requirement | Implementation |
|---------------|-------------|----------------|
| §1 Objective | ROI, dynamic ranking, learn from funnel, automation, insights (incl. pricing optimization) | Orchestrator + events + dashboard + `pricing_stub.py` |
| §2 Principle | Deterministic + AI layers | `deterministic.py` + `decision_orchestrator.py` |
| §3 Deterministic | Plan limits, max promoted, lifecycle, promotion_weight, tracking | `deterministic.py`, `promotion_caps.py`, Mongo `subscriptions.json`, `promoted_listings.json`, `listing_events.json` |
| §4 Modules 1–7 | All seven AI modules | Ranking, CTR/CVR stubs, `promotion_optimizer.py`, `budget_allocation.py`, `anomaly_stub.py`, recommendations + dashboard routes |
| §5 Smart ranking | `f(base, promotion_weight, pred_ctr, pred_cvr, quality, personalization, exploration)` | `decision_orchestrator.py` + `components_to_dict` |
| §6 CTR | P(click\|…), features, LightGBM/XGBoost, threshold downrank | `model_stubs.py`, `train_ctr.py`, `feature_contract.yaml` (ctr_doc), `ctr_threshold_downrank` in config |
| §7 CVR + EV | P(booking\|click), EV = ctr×cvr×price as objective | `expected_value()` + `multi_objective` uses EV as revenue term |
| §8 Promotion optimization | ROI, suggestions, ranking impact | `promotion_optimizer.py`, ROI recommendations response fields in OpenAPI |
| §9 Auto-allocation | Platinum rotate / replace | `auto_allocation.py` |
| §10 RL | State, action, reward | `rl_policy_hook.py` + RL delta in orchestrator |
| §11 Anomaly | Fake clicks, bots, spikes, exclude, alert | `anomaly_stub.py`, `/v1/events` with `alert_admin`, `exclude_from_training` |
| §12 Personalization | `final_score += personalization_weight` | Additive `personalization_additive_scale * perso` after boost |
| §13 Host dashboard | Suggestions, expected impressions/clicks, ROI, insights | `GET /v1/hosts/{id}/intelligence/dashboard` |
| §14 Feedback loop | Predicted vs actual CTR/CVR | `mongodb/schemas/prediction_feedback.json`, train scripts log to MLflow |
| §15 ML infra | Redis, lake, Airflow, MLflow, FastAPI &lt;50ms | `feature_store_redis_stub.py`, `train_*.py`, `airflow/dags/`, `X-Process-Time-Ms` header |
| §16 Fairness | Paid advantage, no unfair Free suppression, no bias | `fairness_policy.py` (free floor), blocked features in `feature_contract.yaml` |
| §17 Metrics | Business + ML KPIs | `/metrics` counters; backlog KPI list |
| §18 Architecture | Query → candidates → features → models → rank → deterministic → track → retrain | Described in `STATE_OF_THE_ART_ARCHITECTURE.md` + orchestrator order |

## Gap analysis (same document)

| Gap | Topic | Implementation |
|-----|--------|----------------|
| GAP 1 | Causal IPS / doubly robust | `ml_pipeline/causal/ips_weights.py` |
| GAP 2 | Exploration / bandits | `bandit_policy.py`, `exploration_epsilon` in config |
| GAP 3 | Position bias / PBM / DBN | `position_hint` + `position_models/README.md` |
| GAP 4 | Feature parity | `feature_contract.yaml`, `parity_check.py` |
| GAP 5 | Governance / rollback / A/B | `X-Model-Version`, `model_registry.json`, MLflow in train scripts |
| GAP 6 | Delayed feedback | `delayed_feedback.py` + survival note |
| GAP 7 | Multi-objective revenue / fairness / CTR | `w_revenue`, `w_fairness`, `w_ctr_term` in `config.py` |
| GAP 8 | Market dynamics | `market_dynamics_stub.py` |
| GAP 9 | LTV | `ltv_stub.py` |
| GAP 10 | Fraud / adversarial | `anomaly_stub.py`, `graph_fraud_stub.py` |
| GAP 11 | Decision orchestrator | `decision_orchestrator.py` (includes RL hook) |
| GAP 12 | Online learning | `kafka_consumer_stub.py` |

## Advanced tiers (document §3)

| Topic | Implementation |
|--------|----------------|
| Embeddings / graph / sequences | Backlog `GAP-ADV-ML`, `feature_contract` optional fields |
| Contextual bandits | `bandit_policy.py` (`LinUCBPlaceholder`) |

---

**Verification:** Run `pytest` in `services/ranking_microservice` (includes API smoke tests) and `python ml_pipeline/parity_check.py`. Formal audit report: `engineering/AUDIT.md`. Re-extract doc text if the `.docx` changes and re-diff this matrix.
