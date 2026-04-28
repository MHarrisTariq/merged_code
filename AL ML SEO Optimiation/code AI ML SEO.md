## Code AI ML SEO (SwyftBooking) — full implementation + explanation

This document is a **handoff-quality, implementation-grade** explanation of the current codebase under `swyftbooking/` in this workspace.

It covers:
- **Architecture** (microservices + gateway + Next.js SEO frontend)
- **How to run locally** (Docker + non-Docker)
- **All endpoints** (inputs/outputs/errors)
- **Caching strategy** (Redis keys + TTLs)
- **SEO system** (canonical, sitemap, robots, JSON-LD: TravelAction + Breadcrumb + FAQ)
- **AI content generation** (OpenAI optional + fallback)
- **ML/prediction baseline** (trend + recommendation + how to replace with real model)
- **Analytics tracking** (event ingestion)
- **What to extend next** (data pipeline, true ML training, A/B testing)

---

## 1) High-level system architecture

### Components
- **Next.js frontend** (`swyftbooking/apps/frontend`)
  - SEO route pages: `/flights/[slug]`
  - Tracking calls: `POST /api/track` via gateway
  - Price intel: `GET /api/pricing/:route`, `GET /api/predict/:route`
  - SEO infra: `robots.txt`, `sitemap.xml`, canonical tags, JSON-LD

- **API Gateway** (`swyftbooking/apps/api-gateway`)
  - Single entrypoint for browser clients
  - Proxies to microservices
  - Adds:
    - **Rate limiting**
    - **Request IDs**
    - **Basic security headers**
    - **Docs endpoint** (`GET /docs`)

- **SEO Service** (`swyftbooking/services/seo-service`)
  - Reads route records from MongoDB (`routes` collection)
  - Gets AI content from AI service
  - Returns merged SEO payload including:
    - Route metadata
    - AI content
    - FAQs
    - Internal links
  - Provides a **route listing endpoint** used for sitemap generation

- **AI Content Service** (`swyftbooking/services/ai-content-service`)
  - Generates unique-ish SEO paragraph with OpenAI (optional)
  - Always returns fallback if OpenAI not configured or fails
  - Redis caches AI content for 24h by default

- **Pricing Service** (`swyftbooking/services/pricing-service`)
  - Stub pricing (deterministic pseudo-price) + Redis caching (1h default)
  - Ready to swap for real providers (Amadeus/Mondee/etc)

- **Prediction Service** (`swyftbooking/services/prediction-service`)
  - Baseline trend predictor (moving-average style)
  - Fetches current price from Pricing Service
  - Returns:
    - `trend`: rising / dropping / stable
    - `recommendation`: human-facing CTA text

- **Analytics Service** (`swyftbooking/services/analytics-service`)
  - Ingests events (page view, search initiated, booking started, etc.)
  - Writes to MongoDB (`analyticsEvents` collection)

### Data stores
- **MongoDB**: route metadata + analytics events
- **Redis**: caching layer for performance & cost control

---

## 2) How to run the stack

### Option A — Docker (recommended)

From `swyftbooking/`:

```bash
cp .env.example .env
docker compose up --build
```

Then seed Mongo routes **once** (from host machine):

```bash
cd swyftbooking
npm run seed:routes
```

Open:
- Frontend: `http://localhost:3000`
- Gateway health: `http://localhost:5000/health`
- Gateway docs: `http://localhost:5000/docs`

### Option B — No Docker

Start MongoDB + Redis locally, then:

```bash
cd swyftbooking
npm install
npm run seed:routes
npm run dev
```

---

## 3) Environment variables (what matters)

These are defined in `swyftbooking/.env.example`.

- **Mongo/Redis**
  - `MONGO_URI`
  - `REDIS_HOST`, `REDIS_PORT`

- **Gateway**
  - `GATEWAY_PORT`
  - `SEO_SERVICE_URL`, `AI_SERVICE_URL`, `PRICING_SERVICE_URL`, `PREDICTION_SERVICE_URL`, `ANALYTICS_SERVICE_URL`
  - `TRUST_PROXY` (set to `1` if running behind reverse proxy)
  - `RATE_LIMIT_PER_MINUTE` (default 120)
  - `AI_RATE_LIMIT_PER_MINUTE` (default 30)

- **AI**
  - `OPENAI_KEY` (optional; if empty, service uses fallback content)
  - `OPENAI_MODEL` (default `gpt-4o-mini`)

- **Frontend**
  - `API_URL` (server-side API base, docker uses `http://api-gateway:5000`)
  - `NEXT_PUBLIC_API_URL` (browser API base, typically `http://localhost:5000`)
  - `NEXT_PUBLIC_SITE_URL` (canonical/sitemap host, e.g. `https://swyftbooking.com`)

---

## 4) API Gateway (`apps/api-gateway`)

### What it does
- Proxies these routes:
  - `/api/seo/*` → SEO service
  - `/api/ai/*` → AI service
  - `/api/pricing/*` → Pricing service
  - `/api/predict/*` → Prediction service
  - `/api/track` → Analytics service `/track`

### Added production-grade behavior
- **Rate limiting**:
  - Default: 120/min per IP+path
  - AI endpoints: 30/min per IP+path
- **Request IDs**:
  - Adds `X-Request-Id` for correlation across services
- **Security headers**:
  - `X-Content-Type-Options`, `X-Frame-Options`, etc.

---

## 5) SEO Service (`services/seo-service`)

### 5.1 Route SEO endpoint

**Gateway URL**
- `GET /api/seo/:slug`

**Upstream URL**
- `GET /:slug` on SEO service

**Output (example)**

```json
{
  "from": "New York",
  "to": "Miami",
  "slug": "flights-from-new-york-to-miami",
  "avg_price": 220,
  "trend": "rising",
  "last_updated": "2026-04-01T00:00:00.000Z",
  "content": "Generated SEO paragraph...",
  "faqs": [
    { "q": "…", "a": "…" }
  ],
  "internal_links": [
    { "type": "related_route", "label": "New York → Chicago", "href": "/flights/flights-from-new-york-to-chicago" }
  ]
}
```

**Caching**
- Redis key: `seo:{slug}`
- TTL: `SEO_CACHE_TTL_SECONDS` (default 86400 = 24h)

### 5.2 Route listing endpoint (for sitemap)

**Gateway URL**
- `GET /api/seo/routes?limit=5000&skip=0`

**Output**

```json
{
  "count": 20,
  "skip": 0,
  "limit": 1000,
  "routes": [
    { "slug": "flights-from-new-york-to-miami", "updatedAt": "...", "createdAt": "..." }
  ]
}
```

---

## 6) AI Content Service (`services/ai-content-service`)

### Endpoint

**Gateway URL**
- `POST /api/ai/generate-content`

**Body**

```json
{ "from": "New York", "to": "Miami", "type": "flight" }
```

**Response**

```json
{ "content": "…", "cached": false }
```

**Caching**
- Redis key: `ai:{type}:{from}:{to}` (lowercased)
- TTL: `AI_CACHE_TTL_SECONDS` (default 86400)

**Failure behavior**
- If OpenAI missing or fails → returns fallback content (never breaks SEO pages).

---

## 7) Pricing Service (`services/pricing-service`)

### Endpoint
**Gateway URL**
- `GET /api/pricing/:route` (example route code: `NYC-MIA`)

**Response**

```json
{
  "route": "NYC-MIA",
  "current_price": 214,
  "currency": "USD",
  "last_updated": "2026-04-16T12:00:00.000Z"
}
```

**Caching**
- Redis key: `price:{route}`
- TTL: `PRICING_CACHE_TTL_SECONDS` (default 3600)

---

## 8) Prediction Service (`services/prediction-service`)

### Endpoint
**Gateway URL**
- `GET /api/predict/:route`

**Response**

```json
{
  "route": "NYC-MIA",
  "trend": "rising",
  "recommendation": "🔥 Prices likely to rise soon. Book before prices increase.",
  "latest_price": 214,
  "sample_points": 4,
  "last_updated": "2026-04-16T12:00:00.000Z"
}
```

### Baseline model logic (Phase 1)
- Builds a tiny synthetic history around the latest price
- Compares latest against average with thresholds:
  - \(latest > avg * 1.03\) → rising
  - \(latest < avg * 0.97\) → dropping
  - otherwise stable

### How to upgrade to Phase 2 (real ML)
- In pricing service: store daily snapshots in Mongo (`prices` collection)
- Add ingestion job (cron) to pull real provider data
- Train a model (LightGBM/XGBoost) in a Python service
- Prediction service becomes an API wrapper around the ML service

---

## 9) Analytics Service (`services/analytics-service`)

### Endpoint
**Gateway URL**
- `POST /api/track`

**Body**

```json
{
  "event": "PAGE_VIEW",
  "data": { "slug": "flights-from-new-york-to-miami" },
  "timestamp": "2026-04-16T12:00:00.000Z"
}
```

**Response**
- `200 OK` (no body)

**Design rule**
- Tracking should **never** break UX. Frontend swallows errors.

---

## 10) Frontend SEO implementation (`apps/frontend`)

### 10.1 SEO route page
- Path: `pages/flights/[slug].js`
- Uses:
  - `getStaticProps` (ISR) with 24h revalidate
  - `<link rel="canonical" … />`
  - `<meta name="description" … />`
  - JSON-LD via `components/Schema.js`
  - Fetches:
    - `/api/pricing/:route`
    - `/api/predict/:route`
  - Sends analytics events:
    - `PAGE_VIEW`
    - `BOOKING_STARTED`
    - `PRICE_ALERT_CREATED`

### 10.2 JSON-LD Schema engine
`components/Schema.js` injects:
- `TravelAction` (route context)
- `BreadcrumbList` (Home → Flights → route)
- `FAQPage` (from SEO service `faqs`)

### 10.3 robots.txt
- Path: `pages/robots.txt.js`
- Output:
  - `Allow: /`
  - `Sitemap: {NEXT_PUBLIC_SITE_URL}/sitemap.xml`

### 10.4 sitemap.xml
- Path: `pages/sitemap.xml.js`
- Fetches slugs from: `GET /api/seo/routes`
- Emits `<urlset>` listing `/` and `/flights/{slug}`

---

## 11) Redis caching keys and TTLs (summary)

- **AI content**: `ai:{type}:{from}:{to}` → 24h default
- **SEO merged payload**: `seo:{slug}` → 24h default
- **Pricing snapshot**: `price:{route}` → 1h default

Why:
- SEO page loads fast
- AI costs controlled
- Pricing stays fresh enough for conversion messaging

---

## 12) Quick test commands (curl)

```bash
# Gateway docs
curl http://localhost:5000/docs

# SEO data
curl http://localhost:5000/api/seo/flights-from-new-york-to-miami

# AI content
curl -X POST http://localhost:5000/api/ai/generate-content ^
  -H "content-type: application/json" ^
  -d "{\"from\":\"New York\",\"to\":\"Miami\",\"type\":\"flight\"}"

# Pricing
curl http://localhost:5000/api/pricing/NYC-MIA

# Prediction
curl http://localhost:5000/api/predict/NYC-MIA

# Tracking
curl -X POST http://localhost:5000/api/track ^
  -H "content-type: application/json" ^
  -d "{\"event\":\"PAGE_VIEW\",\"data\":{\"slug\":\"flights-from-new-york-to-miami\"}}"
```

---

## 13) What is still “Phase 2” (planned upgrades)

This scaffold is intentionally built so each upgrade is a clean swap:

- **Real pricing providers**: replace deterministic `pseudoPrice()` with Amadeus/Mondee integration + persistence.
- **True ML**: add Python model service and persist labeled training data.
- **Enterprise SEO**:
  - canonical URL rules for multiple page types
  - hreflang/i18n
  - sitemap sharding + sitemap index
  - richer schemas (Review/Offer/Flight) once real data exists
- **Observability**:
  - centralized logging, tracing, p95 metrics
  - alerting on cache miss spikes and provider failures

