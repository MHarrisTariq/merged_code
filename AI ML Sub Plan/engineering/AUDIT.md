# Compliance audit — AI/ML Promotion & Subscription Intelligence deliverables

**Audit date:** 2026-04-10  
**Scope:** Repository implementation vs. requirements described in **AI ML Subscription Plan.docx** (hybrid deterministic + AI/ML system, gap analysis, and engineering deliverables).  
**Auditor role:** Automated verification + static traceability review (this document).

---

## 1. Executive summary

| Area | Status | Notes |
|------|--------|--------|
| **Requirements traceability** | **Complete** | `DOCUMENT_COVERAGE_MATRIX.md` maps doc §1–§18 and all gaps to files. |
| **Ranking & orchestration** | **Complete (live)** | `decision_orchestrator.py` implements composite scoring, EV objective, caps, fairness floor, RL hook, personalization additive. |
| **API surface** | **Complete (live)** | FastAPI routes implemented; OpenAPI spec present; smoke tests exercise key paths. |
| **Data contracts** | **Complete** | MongoDB JSON schemas + `prediction_feedback`; `feature_contract.yaml` + `parity_check.py`. |
| **ML pipeline skeleton** | **Complete (stubs)** | Training scripts emit manifests; MLflow optional; Airflow DAG skeleton; no real lake data in repo. |
| **Production hardening** | **Out of scope / pending** | Real models, Redis cluster, Kafka, observability stack, PagerDuty, A/B infra — explicitly stubs or backlog. |

**Verdict:** The repository is **complete for a scaffold / Phase-1 engineering package**: every document item has an owned artifact. Items marked **stub** are **intentionally incomplete** until product data and infrastructure are attached; they are listed in §5 (findings).

---

## 2. Audit criteria

1. Every major bullet in the Word doc (objectives, modules §4, §5–§18, gap list) has a **named** code path, schema, or doc.  
2. **Deterministic** rules cannot be silently bypassed in the orchestrator path (subscription inactive → no boost; cap → zero promotion weight).  
3. **API** routes align with **OpenAPI** intent (same resources; parameter naming may differ cosmetically).  
4. **Automated tests** pass (unit + HTTP smoke).  
5. **No silent omissions**: stubs are labeled and tracked.

---

## 3. Methodology & evidence

| Check | Command / action | Result (recorded) |
|-------|------------------|-------------------|
| Unit + API tests | `cd services/ranking_microservice && python -m pytest -q` | **9 passed** |
| Feature contract | `cd ml_pipeline && python parity_check.py` | **ok** (contract_only) |
| App import | `python -c "from app.main import app"` from `services/ranking_microservice` | **ok** |
| Route inventory | FastAPI routes: `/health`, `/metrics`, `/v1/rank/score`, `/v1/models/info`, `/v1/hosts/{host_id}/promote/recommendations`, `/v1/hosts/{host_id}/intelligence/dashboard`, `/v1/events`, `/v1/admin/alerts/test` | **8 functional paths** (+ docs) |

**Evidence files:** `tests/test_orchestrator.py`, `tests/test_api_smoke.py`.

---

## 4. Requirement coverage (high level)

Detailed row-level mapping: **`DOCUMENT_COVERAGE_MATRIX.md`**.

- **§3 Deterministic:** Plans, lifecycle, `promotion_weight`, max promoted cap — `deterministic.py`, `promotion_caps.py`, Mongo schemas.  
- **§5–§7 Ranking / CTR / CVR / EV:** Orchestrator + stubs + multi-objective weights.  
- **§8–§9 Promotion / auto-allocation:** `promotion_optimizer.py`, `auto_allocation.py`, recommendation route.  
- **§10–§12 RL / anomaly / personalization:** `rl_policy_hook.py`, `anomaly_stub.py` + events, additive personalization.  
- **§13 Host dashboard:** `GET .../intelligence/dashboard`.  
- **§14–§15 Feedback & infra:** `prediction_feedback.json`, train scripts, Redis stub, timing header, `/metrics`.  
- **§16–§17 Fairness & KPIs:** `fairness_policy.py`, blocked features, metrics endpoint, backlog KPIs.  
- **Gap analysis (causal, bandits, parity, governance, delayed, market, LTV, fraud, orchestrator, online):** See matrix + `ml_pipeline/` stubs.

---

## 5. Findings & limitations (production)

These are **not** failures of the scaffold; they are **explicit next steps** before production traffic.

| ID | Finding | Severity | Mitigation |
|----|---------|----------|------------|
| F-1 | CTR/CVR are **heuristic stubs**, not LightGBM/XGBoost trained on lake data | High | Replace `model_stubs.py` loaders with MLflow artifacts; enforce `feature_contract.yaml` parity in CI. |
| F-2 | **Data lake / Redis / Kafka** not running in repo | High | Deploy infra; replace `feature_store_redis_stub.py`, wire `train_ctr.py` paths. |
| F-3 | **Events** accepted in-process; no durable store or idempotency store | High | Persist to Mongo/Kafka; dedupe by `idempotency_key`. |
| F-4 | **Anomaly / admin alerts** return JSON flags only | Medium | Integrate PagerDuty/Slack (`/v1/admin/alerts/test` placeholder). |
| F-5 | **50ms latency SLO** not enforced by load test or autoscaling | Medium | Add load tests, profiling, autoscaling; monitor `X-Process-Time-Ms`. |
| F-6 | **Canary / rollback** partially covered (headers + registry schema); no automated promotion pipeline | Medium | Wire MLflow stages + deployment pipeline. |
| F-7 | **OpenAPI** path params use `hostId` in YAML vs `host_id` in FastAPI — client-compatible, cosmetic | Low | Align names if strict codegen required. |
| F-8 | **Source `.docx`** not always present in workspace glob (may live only on disk) | Low | Keep canonical requirements file under version control with the repo. |

---

## 6. OpenAPI ↔ implementation alignment

| OpenAPI path | Implemented | Notes |
|--------------|-------------|--------|
| `/health` | Yes | |
| `/v1/rank/score` | Yes | Headers `X-Model-Version`, `X-Process-Time-Ms` |
| `/v1/hosts/{hostId}/promote/recommendations` | Yes | Path param `host_id` in code |
| `/v1/events` | Yes | Extra fields `click_rate_burst`, `ip_entropy` for anomaly |
| `/v1/models/info` | Yes | |
| `/metrics` | Yes | |
| `/v1/hosts/{hostId}/intelligence/dashboard` | Yes | |
| `/v1/admin/alerts/test` | Yes | POST stub |

---

## 7. Sign-off checklist (release gate)

Use this before calling the package “production-ready”:

- [ ] ML models trained and registered; serving loads from MLflow (or equivalent).  
- [ ] Feature parity CI green on sampled rows (`parity_check.py` with real samples).  
- [ ] Events durable + idempotent; feedback collection populates `prediction_feedback` (or analytics DB).  
- [ ] Redis (or equivalent) online feature path live.  
- [ ] Alerts wired for anomaly and model drift.  
- [ ] Load / latency SLO validated under expected QPS.  
- [ ] Security review (authn/z on APIs, PII handling for user features).  

---

## 8. Conclusion

**All scoped engineering deliverables from the requirements document are represented in the repository** with traceability in `DOCUMENT_COVERAGE_MATRIX.md`. **Automated tests pass (9 tests).** Remaining work is **operational and data-science integration** (F-1–F-6), not missing specification items in the scaffold.

**Audit outcome:** **PASS** for *engineering completeness of the specification package*; **CONDITIONAL** for *production readiness* pending F-1–F-6.

---

*Regenerate this audit after major doc or architecture changes; re-run `pytest` and `parity_check.py` and update §3.*
