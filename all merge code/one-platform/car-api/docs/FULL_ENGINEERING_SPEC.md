# Full engineering specification — closure of client review gaps

This document responds to the **15 “critical gaps”** raised in the client review (*I went through.docx*): it adds **database structure, Kafka payloads, API contracts, infra, runtime strategy, caching, search, feature store, ML deployment, observability, security, resilience, cost, governance, and UI** at a level engineers can implement.

**Scope:** Car-rental smart pricing service in this repo is the **reference implementation**; multi-service architecture below is the **target production** shape.

---

## 1. Database design (MongoDB-oriented)

### Collections (per service boundaries)

| Collection | Service | Purpose | TTL / retention |
|------------|---------|---------|-----------------|
| `listings` | Catalog | Vehicle/listing master: `listingId`, host, location, vehicle class, base price, status | No TTL; soft-delete |
| `price_calendar` | Pricing | Materialized daily price cells: `listingId`, `date`, `currency`, `amount`, `version`, `source` | Hot: 90d TTL on stale versions optional; archive to S3 |
| `pricing_signals` | Demand | Aggregated demand/supply features per `(market, date)` | 30d TTL (recomputed nightly) |
| `quote_audit` | Pricing API | Idempotent quote logs: `quoteId`, request hash, response, latency, model version | 90–180d (compliance) |
| `host_rules` | Pricing | Min/max, buffers, lock windows, kill-switch flags | No TTL |
| `ml_model_registry` | MLOps | `modelName`, `version`, `artifactUri`, `metrics`, `stage` | Permanent metadata |

### Example `price_calendar` document

```json
{
  "_id": ObjectId("..."),
  "listingId": "lst_8f3a2",
  "date": "2026-08-15",
  "currency": "GBP",
  "amount": 112.5,
  "version": 184920,
  "source": "ml_xgb_segment_v3",
  "computedAt": ISODate("2026-03-28T10:00:00Z"),
  "ttlAt": ISODate("2026-06-28T10:00:00Z")
}
```

### Index strategy

| Collection | Index keys | Options |
|------------|------------|---------|
| `price_calendar` | `{ listingId: 1, date: 1 }` | **unique** compound |
| `price_calendar` | `{ date: 1, marketId: 1 }` | For regional sweeps |
| `quote_audit` | `{ quoteId: 1 }` | unique |
| `quote_audit` | `{ createdAt: -1 }` | Query recent |
| `pricing_signals` | `{ marketId: 1, bucketStart: -1 }` | Partial filter on freshness |

### Partitioning / scale

- Shard key candidate for `price_calendar`: `{ listingId: "hashed" }` (even spread) or `{ marketId: 1, date: 1 }` (geo batch jobs).
- Large backfills: write to **stage** collection, **swap** alias in application config (blue/green for data).

---

## 2. Kafka message schemas

- **Format:** JSON with `schemaVersion`, `eventType`, `id`, `timestamp`, `payload`.
- **Versioning:** Semver in `schemaVersion`; consumers ignore unknown fields; breaking changes bump major.

See **`schemas/kafka/`** for machine-readable JSON Schemas.

### Topic list (minimum)

| Topic | Producers | Consumers |
|-------|-----------|-----------|
| `pricing.quote.requested` | API gateway, search | Pricing service |
| `pricing.quote.completed` | Pricing service | Audit, analytics |
| `pricing.calendar.updated` | Pricing batch worker | Search indexer, CDN invalidation |
| `demand.signal.updated` | Analytics | Pricing, forecasting |

### Required vs optional (pattern)

- **Required:** `eventType`, `id`, `timestamp`, `schemaVersion`, `payload.listingId` (where applicable).
- **Optional:** `traceparent`, `userId`, `metadata`.

---

## 3. API request / response structures

### Success: single quote (`POST /quote`)

**Response** (see live OpenAPI `/docs`):

```json
{
  "predicted_total_gbp": 85.84,
  "raw_predicted_gbp": 85.84,
  "clamped": false,
  "currency": "GBP",
  "source": "model",
  "degraded": false,
  "quote_id": "qte_01jq...",
  "model_version": "smart_pricing_segment_models.pkl"
}
```

When **fallback** activates: `source: "fallback"`, `degraded: true`.

### Errors (envelope)

| HTTP | `error.code` | When | body |
|------|--------------|------|------|
| 400 | `bad_request` | Malformed JSON | `{ "error": { "code", "message", "details" } }` |
| 401 | `unauthorized` | Invalid/missing API key | same |
| 422 | `validation_error` | Pydantic validation | `detail` (FastAPI default) + optional envelope |
| 429 | `rate_limited` | Too many requests | `Retry-After` header |
| 503 | `service_unavailable` | Models missing | message + `artifacts_ready: false` |
| 500 | `internal_error` | Unhandled | generic message; request id in logs |

---

## 4. Infrastructure / DevOps

### Recommended AWS layout

- **Compute:** ECS Fargate or EKS (if multi-team); start with **ECS + ALB**.
- **Autoscaling:** CPU > 60% or custom metric `quote_latency_p99` → scale out; min 2 tasks for HA.
- **Secrets:** AWS Secrets Manager (`API_KEYS`, `REDIS_AUTH`, `MONGODB_URI`).
- **CI/CD:** GitHub Actions → build Docker → push ECR → ECS deploy; optional **blue/green** on ALB target groups.

### Kubernetes (minimal)

See **`k8s/README.md`** — Deployment + Service + HPA stub.

---

## 5. Real-time vs batch strategy

| Workload | Mode | SLA | Notes |
|----------|------|-----|-------|
| On-demand quote (guest checkout) | **Real-time** | p99 < 300 ms internal | API → model or cache |
| Full calendar recompute | **Batch** | Complete within 1–4h | Spark/EMR or chunked workers |
| Demand index refresh | **Streaming + micro-batch** | 1–15 min lag | Kafka → Flink or periodic aggregate |

**Cache invalidation:** On `pricing.calendar.updated`, emit event; **search indexer** and **edge CDN** subscribe; TTL safety net (e.g. 15 min).

---

## 6. Caching layer

- **Redis** (cluster): key `quote:v1:{sha256(sorted booking features)}`, TTL **300s** (configurable).
- **CDN:** Static assets only; **not** for personalized quotes.
- **Application:** In-process LRU optional for single-instance dev.

Env: `REDIS_URL=redis://localhost:6379/0` (see `docker-compose.yml`).

---

## 7. Search system integration

- **OpenSearch / Elasticsearch** index: `listings_search` with fields: title, location, class, **fromPrice** (denormalized), availability bitmap summary.
- **On price update:** consume `pricing.calendar.updated` → **partial update** `fromPrice` + `priceVersion` for optimistic UI.
- **Ranking:** separate rank features; price is **not** only signal — blend with quality/host signals per product policy.

---

## 8. Feature store

| Store | Use | Tech options |
|-------|-----|--------------|
| Online | Low-latency features for quote path | Redis / DynamoDB + Feast online store |
| Offline | Training datasets | S3 Parquet + Glue/Athena |
| Sync | Nightly + on-schedule | dbt or Airflow DAG materializes tables |

**Freshness SLA:** Online features **≤ 15 min** behind batch for non-critical; critical counters **streaming**.

---

## 9. ML deployment

| Piece | Recommendation |
|-------|----------------|
| Serving | **Container** (this API) or **SageMaker endpoint** for GPU/scale-out |
| Orchestration | Airflow / MWAA for retrain DAG |
| Retrain | Weekly + trigger on drift metric threshold |
| Labeling | Logged **actual booking price / conversion** as weak labels; human review queue for outliers |
| Registry | `ml_model_registry` collection + S3 versioned artifacts |

Artifacts in this repo: `models/car/*.pkl`.

---

## 10. Observability

| Signal | Tool | Notes |
|--------|------|-------|
| Logs | ELK / OpenSearch / CloudWatch | JSON structured; fields: `trace_id`, `quote_id`, `latency_ms` |
| Metrics | **Prometheus** + Grafana | `/metrics` on API (see `prometheus-fastapi-instrumentator`) |
| Traces | OpenTelemetry → Jaeger/ X-Ray | Propagate `traceparent` from gateway |

**Golden signals:** RPS, error rate, p50/p99 latency, cache hit ratio, **fallback rate**.

---

## 11. Security

| Control | Implementation |
|---------|----------------|
| Auth | Optional **`X-API-Key`** header when `API_KEY` env set |
| mTLS | Service mesh (Istio/Linkerd) in full k8s |
| Rate limit | **60/min per IP** default (`slowapi`; tune via env) |
| API gateway | AWS API Gateway or Kong in prod; path auth + WAF |
| Input validation | Pydantic models + max body size on proxy |

---

## 12. Failure / fallback strategy

| Failure | Behaviour |
|---------|-----------|
| Model load missing | **503**; health shows `artifacts_ready: false` |
| Prediction exception | **`FALLBACK_PRICE_GBP`** (env) returned with `source: "fallback"`, `degraded: true` |
| Redis down | Skip cache; quotes still succeed |
| Kafka down | API **still serves** quotes; **async audit** retried via outbox table or local queue |
| Circuit breaker | After N failures/min per dependency → short-open + fallback (future: `pybreaker`) |

---

## 13. Cost optimization

- Kafka: tiered retention (7d hot topics, 3d debug), compression `lz4`.
- S3 Intelligent-Tiering for model artifacts and historical quotes.
- Scale-to-zero **disabled** for API; use min 2 small tasks + target tracking scaling.
- Batch pricing jobs: **spot** instances for EMR workers.

---

## 14. Data governance / privacy

- **PII:** Minimize in quote audit — hash `userId`, no raw payment data in pricing logs.
- **Retention:** `quote_audit` **90d** default; legal hold flag per tenant.
- **GDPR/CCPA:** Erasure job removes audit rows by `subjectId` mapping.
- **Anonymization:** Training exports **k-anonymize** geo × class buckets.

---

## 15. UI/UX (spec-level wireframes — Figma-ready narrative)

### Host — pricing dashboard

- **Screen A:** Listing card row; columns: base price, **smart range**, next 7d sparkline, **kill switch** toggle.
- **Screen B:** **Explain drawer** — factors (seasonality, demand index, competitor band) as bullet list + confidence bar.
- **Screen C:** Preferences — min/max GBP, **buffer %**, **lock dates** calendar.

### Guest — search + PDP

- **Search results:** Price chip + “total for X days” subline.
- **PDP:** Price breakdown (base, taxes if any, **dynamic adjustment** tooltip).

### Admin

- **Regional controls** table; **fraud flags** queue; **model version** readout per market.

*(Export to Figma: treat each bullet as a frame title; components: Card, Sparkline, Drawer, Toggle, Tooltip.)*

---

## Traceability

Every section above maps to **`CLIENT_GAP_CLOSURE_CHECKLIST.md`** in the repo root with ✅ for **documented** and, where applicable, **implemented in code**.
