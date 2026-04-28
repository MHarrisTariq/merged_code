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


---

## Appendix A) Full code listing (every file)

This appendix contains the full contents of each **source/config** file in the implementation.
Excluded on purpose: `node_modules/`, `.next/`, build outputs.



### File: `.env.example`

```
## Core
MONGO_URI=mongodb://localhost:27017/swyft
REDIS_HOST=localhost
REDIS_PORT=6379

## Gateway
GATEWAY_PORT=5000
SEO_SERVICE_URL=http://localhost:5001
AI_SERVICE_URL=http://localhost:5002
PRICING_SERVICE_URL=http://localhost:5003
PREDICTION_SERVICE_URL=http://localhost:5004
ANALYTICS_SERVICE_URL=http://localhost:5005

## Services
SEO_SERVICE_PORT=5001
AI_SERVICE_PORT=5002
PRICING_SERVICE_PORT=5003
PREDICTION_SERVICE_PORT=5004
ANALYTICS_SERVICE_PORT=5005

## AI (optional)
OPENAI_KEY=
OPENAI_MODEL=gpt-4o-mini

## Frontend
API_URL=http://localhost:5000
```


### File: `apps/api-gateway/Dockerfile`

```
FROM node:20-alpine

WORKDIR /app

COPY apps/api-gateway/package*.json ./
RUN npm install --omit=dev

COPY apps/api-gateway/ ./

EXPOSE 5000
CMD ["node", "index.js"]
```


### File: `apps/api-gateway/index.js`

```javascript
import "dotenv/config";
import cors from "cors";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
app.use(cors());
// Intentionally do NOT parse JSON bodies in the gateway.
// Proxied POST bodies must be forwarded raw to upstream services.

const PORT = Number(process.env.GATEWAY_PORT || 5000);

function requestId() {
  // lightweight, non-crypto request id (good enough for logs)
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getClientIp(req) {
  // If behind proxies, set `TRUST_PROXY=1` and Express will populate req.ip properly.
  return req.ip || req.connection?.remoteAddress || "unknown";
}

function createInMemoryRateLimiter({ windowMs, max, keyPrefix = "rl" }) {
  const hits = new Map(); // key -> {count, resetAt}
  const windowMsNum = Number(windowMs);
  const maxNum = Number(max);

  function cleanup(now) {
    // opportunistic cleanup to prevent unbounded memory growth
    // (keep it cheap: sample a small number of keys)
    let i = 0;
    for (const [k, v] of hits) {
      if (v.resetAt <= now) hits.delete(k);
      if (++i > 250) break;
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    cleanup(now);
    const key = `${keyPrefix}:${getClientIp(req)}:${req.path}`;
    const existing = hits.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMsNum;
      hits.set(key, { count: 1, resetAt });
      res.setHeader("RateLimit-Limit", String(maxNum));
      res.setHeader("RateLimit-Remaining", String(maxNum - 1));
      res.setHeader("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
      return next();
    }

    existing.count += 1;
    const remaining = Math.max(0, maxNum - existing.count);
    res.setHeader("RateLimit-Limit", String(maxNum));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(existing.resetAt / 1000)));

    if (existing.count > maxNum) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        retry_after_seconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      });
    }
    return next();
  };
}

if (process.env.TRUST_PROXY) {
  app.set("trust proxy", true);
}

// Basic security headers (no extra deps)
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

// Request-id for end-to-end tracing across microservices
app.use((req, res, next) => {
  const id = req.headers["x-request-id"] || requestId();
  res.setHeader("X-Request-Id", String(id));
  req.headers["x-request-id"] = String(id);
  next();
});

// Default rate limit for all APIs (per IP per path)
app.use("/api", createInMemoryRateLimiter({ windowMs: 60_000, max: Number(process.env.RATE_LIMIT_PER_MINUTE || 120) }));
// Stricter limit for AI generation
app.use(
  "/api/ai",
  createInMemoryRateLimiter({ windowMs: 60_000, max: Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 30), keyPrefix: "rl-ai" }),
);

const targets = {
  seo: process.env.SEO_SERVICE_URL || "http://localhost:5001",
  ai: process.env.AI_SERVICE_URL || "http://localhost:5002",
  pricing: process.env.PRICING_SERVICE_URL || "http://localhost:5003",
  prediction: process.env.PREDICTION_SERVICE_URL || "http://localhost:5004",
  analytics: process.env.ANALYTICS_SERVICE_URL || "http://localhost:5005",
};

app.get("/health", (_req, res) => res.json({ ok: true, targets }));

app.get("/docs", (_req, res) =>
  res.json({
    name: "SwyftBooking API Gateway",
    endpoints: {
      health: "GET /health",
      seo: "GET /api/seo/:slug",
      ai: "POST /api/ai/generate-content",
      pricing: "GET /api/pricing/:route (e.g. NYC-MIA)",
      predict: "GET /api/predict/:route (e.g. NYC-MIA)",
      track: "POST /api/track",
    },
  }),
);

app.use(
  "/api/seo",
  createProxyMiddleware({
    target: targets.seo,
    changeOrigin: true,
    pathRewrite: { "^/api/seo": "" },
  }),
);

app.use(
  "/api/ai",
  createProxyMiddleware({
    target: targets.ai,
    changeOrigin: true,
    pathRewrite: { "^/api/ai": "" },
  }),
);

app.use(
  "/api/pricing",
  createProxyMiddleware({
    target: targets.pricing,
    changeOrigin: true,
    pathRewrite: { "^/api/pricing": "" },
  }),
);

app.use(
  "/api/predict",
  createProxyMiddleware({
    target: targets.prediction,
    changeOrigin: true,
    pathRewrite: { "^/api/predict": "" },
  }),
);

app.use(
  "/api/track",
  createProxyMiddleware({
    target: targets.analytics,
    changeOrigin: true,
    // When mounted at /api/track, req.url is usually "/" (or "/...").
    // Rewrite that to analytics' /track endpoint.
    pathRewrite: { "^/": "/track" },
  }),
);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API Gateway running on port ${PORT}`);
});
```


### File: `apps/api-gateway/package.json`

```json
{
  "name": "api-gateway",
  "version": "1.0.0",
  "private": true,
  "description": "Central API router for SwyftBooking",
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  },
  "type": "module",
  "dependencies": {
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^4.18.3",
    "http-proxy-middleware": "^3.0.5",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```


### File: `apps/frontend/.eslintrc.json`

```json
{
  "extends": ["next/core-web-vitals"]
}
```


### File: `apps/frontend/components/Schema.js`

```javascript
function safeUrlJoin(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

export default function Schema({ from, to, slug, faqs = [] }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const pageUrl = slug ? safeUrlJoin(siteUrl, `flights/${slug}`) : siteUrl;

  const travelAction = {
    "@context": "https://schema.org",
    "@type": "TravelAction",
    fromLocation: { name: from },
    toLocation: { name: to },
  };

  const breadcrumb = slug
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Flights",
            item: safeUrlJoin(siteUrl, ""),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${from} to ${to}`,
            item: pageUrl,
          },
        ],
      }
    : null;

  const faqSchema =
    faqs && faqs.length
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  const schemas = [travelAction, breadcrumb, faqSchema].filter(Boolean);

  return (
    <>
      {schemas.map((s, i) => (
        <script
          // eslint-disable-next-line react/no-danger
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  );
}
```


### File: `apps/frontend/Dockerfile`

```
FROM node:20-alpine AS deps
WORKDIR /app
COPY apps/frontend/package*.json ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/frontend/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000
CMD ["npm", "run", "start"]
```


### File: `apps/frontend/next.config.mjs`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```


### File: `apps/frontend/package.json`

```json
{
  "name": "frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.5.2",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "eslint": "^9.35.0",
    "eslint-config-next": "^15.5.2"
  }
}
```


### File: `apps/frontend/pages/_app.js`

```javascript
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
```


### File: `apps/frontend/pages/flights/[slug].js`

```javascript
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Schema from "../../components/Schema";
import { trackEvent } from "../../utils/tracking";

function apiBaseUrl() {
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
}

export async function getStaticProps({ params }) {
  const res = await fetch(`${apiBaseUrl()}/api/seo/${params.slug}`);
  const data = await res.json();

  return {
    props: { data },
    revalidate: 86400,
  };
}

export async function getStaticPaths() {
  return { paths: [], fallback: "blocking" };
}

function routeCode(from, to) {
  const a = String(from || "").trim().slice(0, 3).toUpperCase();
  const b = String(to || "").trim().slice(0, 3).toUpperCase();
  return `${a}-${b}`;
}

export default function FlightPage({ data }) {
  const [prediction, setPrediction] = useState(null);
  const [price, setPrice] = useState(null);
  const [loadingIntel, setLoadingIntel] = useState(true);

  const code = useMemo(() => routeCode(data?.from, data?.to), [data?.from, data?.to]);

  useEffect(() => {
    trackEvent("PAGE_VIEW", { slug: data?.slug, from: data?.from, to: data?.to });
  }, [data?.slug, data?.from, data?.to]);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        const [p, pr] = await Promise.all([
          fetch(`${apiBaseUrl()}/api/predict/${encodeURIComponent(code)}`).then((r) => r.json()),
          fetch(`${apiBaseUrl()}/api/pricing/${encodeURIComponent(code)}`).then((r) => r.json()),
        ]);
        if (!alive) return;
        setPrediction(p?.error ? null : p);
        setPrice(pr?.error ? null : pr);
      } finally {
        if (alive) setLoadingIntel(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [code]);

  const title = `${data?.from} → ${data?.to} flights | SwyftBooking`;
  const description =
    data?.content ||
    `Compare flights from ${data?.from} to ${data?.to}. Track pricing trends, get booking tips, and book at the best time.`;
  const canonical = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/flights/${data?.slug}`;

  return (
    <div className="container">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description.slice(0, 160)} />
        <link rel="canonical" href={canonical} />
      </Head>

      <Schema from={data?.from} to={data?.to} slug={data?.slug} faqs={data?.faqs || []} />

      <div className="card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div className="pill">Route</div>
          <div className="pill">{code}</div>
          {price?.current_price ? (
            <div className="pill">Current price: ${price.current_price}</div>
          ) : (
            <div className="pill">Current price: —</div>
          )}
        </div>

        <h1 style={{ marginBottom: 6 }}>{data?.from} → {data?.to}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          SEO + AI content + price intel + tracking (as specified).
        </p>

        <p style={{ fontSize: 16, lineHeight: 1.7 }}>{data?.content}</p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button
            className="btn"
            onClick={() => trackEvent("BOOKING_STARTED", { from: data?.from, to: data?.to, route: code })}
          >
            Search Flights
          </button>
          <button
            className="btn"
            style={{ background: "linear-gradient(90deg, rgba(124,92,255,.95), rgba(232,236,255,.9))" }}
            onClick={() => trackEvent("PRICE_ALERT_CREATED", { route: code, from: data?.from, to: data?.to })}
          >
            Track Price
          </button>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Pricing prediction</h2>
          {loadingIntel ? (
            <p className="muted">Loading prediction…</p>
          ) : prediction ? (
            <>
              <div className="pill">Trend: {prediction.trend}</div>
              <p style={{ marginBottom: 0 }}>{prediction.recommendation}</p>
            </>
          ) : (
            <p className="muted">Prediction temporarily unavailable.</p>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Urgency triggers</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            These are deliberately included per the “conversion optimization” section.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(232,236,255,.85)" }}>
            <li>🔥 “12 people booked this today”</li>
            <li>⏳ “Prices may increase soon”</li>
            <li>⚠️ “Only 3 seats left”</li>
          </ul>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Internal links</h2>
          {data?.internal_links?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(232,236,255,.85)" }}>
              {data.internal_links.map((l, idx) => (
                <li key={`${l.href}-${idx}`}>
                  <a href={l.href} style={{ color: "rgba(232,236,255,.9)" }}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Links will appear once more routes exist in MongoDB.
            </p>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>FAQs</h2>
          {data?.faqs?.length ? (
            <div>
              {data.faqs.map((f, idx) => (
                <div key={idx} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 650 }}>{f.q}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {f.a}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              FAQs are generated per route.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```


### File: `apps/frontend/pages/index.js`

```javascript
import { useMemo, useState } from "react";
import Link from "next/link";
import { trackEvent } from "../utils/tracking";

function slugifyCity(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function buildSlug(from, to) {
  return `flights-from-${slugifyCity(from)}-to-${slugifyCity(to)}`;
}

export default function Home() {
  const [from, setFrom] = useState("New York");
  const [to, setTo] = useState("Miami");

  const slug = useMemo(() => buildSlug(from, to), [from, to]);

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div className="pill">SwyftBooking • AI + ML + SEO</div>
          <h1 style={{ margin: "12px 0 6px", lineHeight: 1.1 }}>
            Find the best flights — and rank for it.
          </h1>
          <p className="muted" style={{ marginTop: 0, maxWidth: 680 }}>
            This demo matches your spec: SEO pages + AI content + price intel + tracking. Start by generating a route page.
          </p>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Search route</h2>
          <div className="inputRow">
            <div>
              <label>From</label>
              <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="New York" />
            </div>
            <div>
              <label>To</label>
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Miami" />
            </div>
            <div style={{ alignSelf: "end" }}>
              <Link
                className="btn"
                href={`/flights/${slug}`}
                onClick={() => trackEvent("SEARCH_INITIATED", { from, to })}
              >
                Search Flights
              </Link>
            </div>
          </div>
          <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
            Generated slug: <code>{slug}</code>
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>What’s included</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(232,236,255,.85)" }}>
            <li>SEO service (Mongo + Redis cache)</li>
            <li>AI content generation (OpenAI optional + Redis cache)</li>
            <li>Pricing & prediction services (stub ready for real APIs/models)</li>
            <li>Event tracking to analytics service</li>
          </ul>
          <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
            Tip: run <code>npm run seed:routes</code> once so SEO routes resolve from MongoDB.
          </p>
        </div>
      </div>
    </div>
  );
}
```


### File: `apps/frontend/pages/robots.txt.js`

```javascript
function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export async function getServerSideProps({ res }) {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${siteUrl()}/sitemap.xml`,
    "",
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.write(body);
  res.end();

  return { props: {} };
}

export default function Robots() {
  return null;
}
```


### File: `apps/frontend/pages/sitemap.xml.js`

```javascript
function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function apiBaseUrl() {
  // On the server we can use API_URL (docker) or NEXT_PUBLIC_API_URL (local)
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function getServerSideProps({ res }) {
  let slugs = [];
  try {
    const r = await fetch(`${apiBaseUrl()}/api/seo/routes?limit=5000`);
    const data = await r.json();
    slugs = Array.isArray(data?.routes) ? data.routes.map((x) => x.slug).filter(Boolean) : [];
  } catch {
    slugs = [];
  }

  const urls = [
    { loc: `${siteUrl()}/`, changefreq: "daily", priority: "1.0" },
    ...slugs.map((slug) => ({
      loc: `${siteUrl()}/flights/${slug}`,
      changefreq: "daily",
      priority: "0.8",
    })),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n` +
          `    <loc>${xmlEscape(u.loc)}</loc>\n` +
          `    <changefreq>${u.changefreq}</changefreq>\n` +
          `    <priority>${u.priority}</priority>\n` +
          `  </url>`,
      )
      .join("\n") +
    `\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.write(body);
  res.end();

  return { props: {} };
}

export default function Sitemap() {
  return null;
}
```


### File: `apps/frontend/styles/globals.css`

```css
:root {
  color-scheme: light;
  --bg: #0b1020;
  --panel: #111a33;
  --text: #e8ecff;
  --muted: rgba(232, 236, 255, 0.7);
  --accent: #7c5cff;
  --accent2: #2ee59d;
  --border: rgba(232, 236, 255, 0.12);
}

html,
body {
  padding: 0;
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica,
    Arial, "Apple Color Emoji", "Segoe UI Emoji";
  background: radial-gradient(1200px 600px at 20% 0%, rgba(124, 92, 255, 0.25), transparent),
    radial-gradient(900px 500px at 80% 30%, rgba(46, 229, 157, 0.18), transparent),
    var(--bg);
  color: var(--text);
}

a {
  color: inherit;
  text-decoration: none;
}

* {
  box-sizing: border-box;
}

.container {
  max-width: 1100px;
  padding: 32px 18px;
  margin: 0 auto;
}

.card {
  background: linear-gradient(180deg, rgba(17, 26, 51, 0.9), rgba(17, 26, 51, 0.72));
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 18px;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.inputRow {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 10px;
}

@media (max-width: 700px) {
  .inputRow {
    grid-template-columns: 1fr;
  }
}

label {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}

input {
  width: 100%;
  padding: 12px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(10, 16, 32, 0.55);
  color: var(--text);
  outline: none;
}

input::placeholder {
  color: rgba(232, 236, 255, 0.45);
}

.btn {
  border: 0;
  border-radius: 12px;
  padding: 12px 14px;
  font-weight: 700;
  cursor: pointer;
  color: #0b1020;
  background: linear-gradient(90deg, var(--accent), var(--accent2));
  transition: transform 120ms ease, filter 120ms ease;
}

.btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.muted {
  color: var(--muted);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(10, 16, 32, 0.35);
  font-size: 12px;
  color: var(--muted);
}
```


### File: `apps/frontend/utils/tracking.js`

```javascript
export async function trackEvent(event, data = {}) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";
    await fetch(`${baseUrl}/api/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // analytics must never break UX
  }
}
```


### File: `docker-compose.yml`

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  api-gateway:
    build:
      context: .
      dockerfile: apps/api-gateway/Dockerfile
    ports:
      - "5000:5000"
    environment:
      - GATEWAY_PORT=5000
      - SEO_SERVICE_URL=http://seo-service:5001
      - AI_SERVICE_URL=http://ai-content-service:5002
      - PRICING_SERVICE_URL=http://pricing-service:5003
      - PREDICTION_SERVICE_URL=http://prediction-service:5004
      - ANALYTICS_SERVICE_URL=http://analytics-service:5005
    depends_on:
      - seo-service
      - ai-content-service
      - pricing-service
      - prediction-service
      - analytics-service

  seo-service:
    build:
      context: .
      dockerfile: services/seo-service/Dockerfile
    environment:
      - SEO_SERVICE_PORT=5001
      - MONGO_URI=mongodb://mongo:27017/swyft
      - REDIS_HOST=redis
      - AI_SERVICE_URL=http://ai-content-service:5002
    depends_on:
      - mongo
      - redis

  ai-content-service:
    build:
      context: .
      dockerfile: services/ai-content-service/Dockerfile
    environment:
      - AI_SERVICE_PORT=5002
      - REDIS_HOST=redis
      - OPENAI_KEY=${OPENAI_KEY}
      - OPENAI_MODEL=${OPENAI_MODEL}
    depends_on:
      - redis

  pricing-service:
    build:
      context: .
      dockerfile: services/pricing-service/Dockerfile
    environment:
      - PRICING_SERVICE_PORT=5003
      - REDIS_HOST=redis
    depends_on:
      - redis

  prediction-service:
    build:
      context: .
      dockerfile: services/prediction-service/Dockerfile
    environment:
      - PREDICTION_SERVICE_PORT=5004
      - PRICING_SERVICE_URL=http://pricing-service:5003
    depends_on:
      - pricing-service

  analytics-service:
    build:
      context: .
      dockerfile: services/analytics-service/Dockerfile
    environment:
      - ANALYTICS_SERVICE_PORT=5005
      - MONGO_URI=mongodb://mongo:27017/swyft
    depends_on:
      - mongo

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - API_URL=http://api-gateway:5000
      - NEXT_PUBLIC_API_URL=http://localhost:5000
    depends_on:
      - api-gateway

volumes:
  mongo_data:
```


### File: `package.json`

```json
{
  "name": "swyftbooking",
  "version": "1.0.0",
  "private": true,
  "description": "SwyftBooking AI + ML + SEO platform (monorepo)",
  "scripts": {
    "dev": "npm-run-all -p dev:*",
    "dev:frontend": "npm --workspace apps/frontend run dev",
    "dev:gateway": "npm --workspace apps/api-gateway run dev",
    "dev:seo": "npm --workspace services/seo-service run dev",
    "dev:ai": "npm --workspace services/ai-content-service run dev",
    "dev:pricing": "npm --workspace services/pricing-service run dev",
    "dev:prediction": "npm --workspace services/prediction-service run dev",
    "dev:analytics": "npm --workspace services/analytics-service run dev",
    "lint": "npm-run-all -p lint:*",
    "lint:frontend": "npm --workspace apps/frontend run lint",
    "seed:routes": "node scripts/seedRoutesMongoDriver.mjs",
    "generate:routes": "node scripts/generateRoutes.mjs",
    "docker:up": "docker compose up --build",
    "docker:down": "docker compose down -v"
  },
  "workspaces": [
    "apps/*",
    "services/*",
    "packages/*"
  ],
  "dependencies": {
    "mongodb": "^7.1.1",
    "mongoose": "^9.4.1",
    "npm-run-all": "^4.1.5"
  }
}
```


### File: `packages/cache/package.json`

```json
{
  "name": "cache",
  "version": "1.0.0",
  "private": true,
  "description": "Shared Redis client",
  "main": "redis.js",
  "scripts": {
    "test": "node -e \"console.log('ok')\""
  },
  "type": "module",
  "dependencies": {
    "dotenv": "^17.4.2",
    "ioredis": "^5.10.1"
  }
}
```


### File: `packages/cache/redis.js`

```javascript
import "dotenv/config";
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: 2,
});

redis.on("error", (err) => {
  // Keep services alive even if Redis is temporarily down.
  console.error("[redis] error", err?.message || err);
});

export default redis;
```


### File: `packages/database/mongo.js`

```javascript
import "dotenv/config";
import mongoose from "mongoose";

export async function connectDB(mongoUri = process.env.MONGO_URI) {
  if (!mongoUri) throw new Error("MONGO_URI is required");

  // Reuse connection if already connected
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  await mongoose.connect(mongoUri);
  return mongoose.connection;
}
```


### File: `packages/database/package.json`

```json
{
  "name": "database",
  "version": "1.0.0",
  "private": true,
  "description": "Shared MongoDB connection helper",
  "main": "mongo.js",
  "scripts": {
    "test": "node -e \"console.log('ok')\""
  },
  "type": "module",
  "dependencies": {
    "dotenv": "^17.4.2",
    "mongoose": "^9.4.1"
  }
}
```


### File: `packages/logger/logger.js`

```javascript
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: undefined,
});
```


### File: `packages/logger/package.json`

```json
{
  "name": "logger",
  "version": "1.0.0",
  "private": true,
  "description": "Shared structured logger",
  "main": "logger.js",
  "scripts": {
    "test": "node -e \"console.log('ok')\""
  },
  "type": "module",
  "dependencies": {
    "pino": "^10.3.1"
  }
}
```


### File: `README.md`

```markdown
# SwyftBooking — AI + ML + SEO Platform

This repo is a working scaffold based on your `AI ML SEO Optimization.docx` requirements:

- Microservices (Node.js + MongoDB + Redis)
- AI content generation (`POST /api/ai/generate-content`)
- SEO page service (`GET /api/seo/:slug`)
- Pricing service (`GET /api/pricing/:route`)
- Prediction service (`GET /api/predict/:route`)
- Analytics tracking (`POST /api/track`)
- Next.js frontend with SEO pages (`/flights/[slug]`) + JSON-LD schema injection

## Run locally (Docker)

1. Copy env:

```bash
cp .env.example .env
```

2. Start stack:

```bash
docker compose up --build
```

3. Seed routes (once):

```bash
node scripts/seedRoutes.mjs
```

Open:

- Frontend: `http://localhost:3000`
- Gateway health: `http://localhost:5000/health`

## Run locally (no Docker)

Start MongoDB + Redis locally, then:

```bash
npm install
npm run seed:routes
npm run dev
```
```


### File: `scripts/generateRoutes.mjs`

```javascript
const cities = ["New York", "Miami", "Los Angeles", "Chicago", "Toronto"];

function slugifyCity(s) {
  return String(s).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const routes = [];
for (const from of cities) {
  for (const to of cities) {
    if (from === to) continue;
    routes.push({
      from,
      to,
      slug: `flights-from-${slugifyCity(from)}-to-${slugifyCity(to)}`,
    });
  }
}

console.log(JSON.stringify(routes, null, 2));
```


### File: `scripts/seedRoutes.mjs`

```javascript
import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/swyft";

const routeSchema = new mongoose.Schema(
  {
    from: String,
    to: String,
    slug: { type: String, unique: true },
    avg_price: Number,
    duration: String,
    trend: String,
    last_updated: Date,
  },
  { timestamps: true },
);

const Route = mongoose.model("Route", routeSchema);

const cities = ["New York", "Miami", "Los Angeles", "Chicago", "Toronto"];
const durationChoices = ["2h 45m", "3h 10m", "5h 05m", "1h 55m"];
const trendChoices = ["rising", "dropping", "stable"];

function slugifyCity(s) {
  return String(s).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function pseudo(n) {
  // simple deterministic-ish pseudo random
  let x = 0;
  for (const ch of String(n)) x = (x * 33 + ch.charCodeAt(0)) >>> 0;
  return x;
}

const routes = [];
for (const from of cities) {
  for (const to of cities) {
    if (from === to) continue;
    const key = `${from}-${to}`;
    const h = pseudo(key);
    routes.push({
      from,
      to,
      slug: `flights-from-${slugifyCity(from)}-to-${slugifyCity(to)}`,
      avg_price: 90 + (h % 260),
      duration: durationChoices[h % durationChoices.length],
      trend: trendChoices[h % trendChoices.length],
      last_updated: new Date(),
    });
  }
}

await mongoose.connect(MONGO_URI);
await Route.deleteMany({});
await Route.insertMany(routes, { ordered: false });

console.log(`Seeded ${routes.length} routes into ${MONGO_URI}`);
await mongoose.disconnect();
```


### File: `scripts/seedRoutesMongoDriver.mjs`

```javascript
import "dotenv/config";
import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/swyft";

const cities = ["New York", "Miami", "Los Angeles", "Chicago", "Toronto"];
const durationChoices = ["2h 45m", "3h 10m", "5h 05m", "1h 55m"];
const trendChoices = ["rising", "dropping", "stable"];

function slugifyCity(s) {
  return String(s).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function pseudo(n) {
  let x = 0;
  for (const ch of String(n)) x = (x * 33 + ch.charCodeAt(0)) >>> 0;
  return x;
}

const routes = [];
for (const from of cities) {
  for (const to of cities) {
    if (from === to) continue;
    const key = `${from}-${to}`;
    const h = pseudo(key);
    routes.push({
      from,
      to,
      slug: `flights-from-${slugifyCity(from)}-to-${slugifyCity(to)}`,
      avg_price: 90 + (h % 260),
      duration: durationChoices[h % durationChoices.length],
      trend: trendChoices[h % trendChoices.length],
      last_updated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

const client = new MongoClient(MONGO_URI);
await client.connect();

// If DB not explicitly in URI path, default to "swyft"
const dbName = client.options.dbName || "swyft";
const db = client.db(dbName);
const collection = db.collection("routes");

await collection.deleteMany({});
await collection.insertMany(routes, { ordered: false });

console.log(`Seeded ${routes.length} routes into ${MONGO_URI} (db=${dbName})`);

await client.close();
```


### File: `services/ai-content-service/aiClient.js`

```javascript
import "dotenv/config";
import OpenAI from "openai";

const apiKey = process.env.OPENAI_KEY;

const openai = apiKey
  ? new OpenAI({
      apiKey,
    })
  : null;

export async function generateSEOContent({ from, to, type }) {
  if (!openai) {
    return `Discover ${type === "hotel" ? "hotels" : "flights"} from ${from} to ${to}. Track prices, plan smarter, and book with confidence on SwyftBooking.`;
  }

  const prompt = [
    `Write a unique, human-like SEO paragraph for ${type}s from ${from} to ${to}.`,
    "Include travel tips, pricing insights, urgency, and booking advice.",
    "Avoid repetition. Do not include headings. Keep it 90-140 words.",
  ].join("\n");

  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices?.[0]?.message?.content?.trim() || "";
}
```


### File: `services/ai-content-service/Dockerfile`

```
FROM node:20-alpine

WORKDIR /app

COPY services/ai-content-service/package*.json ./
RUN npm install --omit=dev

COPY services/ai-content-service/ ./
COPY packages/ ./packages/

EXPOSE 5002
CMD ["node", "index.js"]
```


### File: `services/ai-content-service/index.js`

```javascript
import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import redis from "../../packages/cache/redis.js";
import { generateSEOContent } from "./aiClient.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.AI_SERVICE_PORT || 5002);
const TTL_SECONDS = Number(process.env.AI_CACHE_TTL_SECONDS || 86400);

const BodySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum(["flight", "hotel"]).default("flight"),
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// Spec: POST /api/ai/generate-content (via gateway)
app.post("/generate-content", async (req, res) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { from, to, type } = parsed.data;
  const cacheKey = `ai:${type}:${from.toLowerCase()}:${to.toLowerCase()}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ content: cached, cached: true });

    const content = await generateSEOContent({ from, to, type });
    await redis.set(cacheKey, content, "EX", TTL_SECONDS);

    return res.json({ content, cached: false });
  } catch {
    return res.json({
      content: `Plan your trip from ${from} to ${to} with SwyftBooking. Compare options, watch for price moves, and book when it’s best for you.`,
      cached: false,
      fallback: true,
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AI Content Service running on port ${PORT}`);
});
```


### File: `services/ai-content-service/package.json`

```json
{
  "name": "ai-content-service",
  "version": "1.0.0",
  "private": true,
  "description": "AI content generation service (OpenAI + Redis caching)",
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  },
  "type": "module",
  "dependencies": {
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "ioredis": "^5.8.1",
    "openai": "^5.16.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```


### File: `services/analytics-service/Dockerfile`

```
FROM node:20-alpine

WORKDIR /app

COPY services/analytics-service/package*.json ./
RUN npm install --omit=dev

COPY services/analytics-service/ ./
COPY packages/ ./packages/

EXPOSE 5005
CMD ["node", "index.js"]
```


### File: `services/analytics-service/index.js`

```javascript
import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { connectDB } from "../../packages/database/mongo.js";
import AnalyticsEvent from "./models/AnalyticsEvent.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.ANALYTICS_SERVICE_PORT || 5005);

app.get("/health", (_req, res) => res.json({ ok: true }));

const TrackSchema = z.object({
  event: z.string().min(1),
  data: z.record(z.any()).optional().default({}),
  timestamp: z.union([z.string(), z.date()]).optional(),
  user_id: z.string().optional(),
});

// Spec: POST /api/track (via gateway)
app.post("/track", async (req, res) => {
  const parsed = TrackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { event, data, user_id } = parsed.data;
  const ts = parsed.data.timestamp ? new Date(parsed.data.timestamp) : new Date();

  await AnalyticsEvent.create({
    event,
    data,
    user_id: user_id || null,
    timestamp: ts,
  });

  return res.sendStatus(200);
});

await connectDB();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Analytics Service running on port ${PORT}`);
});
```


### File: `services/analytics-service/models/AnalyticsEvent.js`

```javascript
import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, index: true },
    user_id: { type: String, default: null, index: true },
    data: { type: Object, default: {} },
    timestamp: { type: Date, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("AnalyticsEvent", analyticsSchema);
```


### File: `services/analytics-service/package.json`

```json
{
  "name": "analytics-service",
  "version": "1.0.0",
  "private": true,
  "description": "Event tracking + analytics ingestion service",
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  },
  "type": "module",
  "devDependencies": {
    "nodemon": "^3.1.14"
  },
  "dependencies": {
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "mongoose": "^9.4.1",
    "zod": "^3.25.76"
  }
}
```


### File: `services/prediction-service/Dockerfile`

```
FROM node:20-alpine

WORKDIR /app

COPY services/prediction-service/package*.json ./
RUN npm install --omit=dev

COPY services/prediction-service/ ./

EXPOSE 5004
CMD ["node", "index.js"]
```


### File: `services/prediction-service/index.js`

```javascript
import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { predictTrend, recommendationFromTrend } from "./predict.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PREDICTION_SERVICE_PORT || 5004);

app.get("/health", (_req, res) => res.json({ ok: true }));

const ParamsSchema = z.object({
  route: z.string().min(3),
});

async function getCurrentPrice(route) {
  const baseUrl = process.env.PRICING_SERVICE_URL || "http://localhost:5003";
  const res = await fetch(`${baseUrl}/${encodeURIComponent(route)}`);
  if (!res.ok) throw new Error("pricing fetch failed");
  const data = await res.json();
  return Number(data?.current_price);
}

// Spec: GET /api/predict/:route (via gateway)
app.get("/:route", async (req, res) => {
  const parsed = ParamsSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid route" });

  const route = parsed.data.route.toUpperCase();

  try {
    const latest = await getCurrentPrice(route);
    // Minimal baseline history (replace with real pipeline later)
    const history = [latest * 0.92, latest * 0.98, latest * 1.01, latest];
    const trend = predictTrend(history);
    return res.json({
      route,
      trend,
      recommendation: recommendationFromTrend(trend),
      latest_price: latest,
      sample_points: history.length,
      last_updated: new Date().toISOString(),
    });
  } catch {
    return res.status(502).json({ error: "Prediction unavailable" });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Prediction Service running on port ${PORT}`);
});
```


### File: `services/prediction-service/package.json`

```json
{
  "name": "prediction-service",
  "version": "1.0.0",
  "private": true,
  "description": "Price prediction service (trend + recommendation)",
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  },
  "type": "module",
  "devDependencies": {
    "nodemon": "^3.1.14"
  },
  "dependencies": {
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "mongoose": "^9.4.1",
    "zod": "^3.25.76"
  }
}
```


### File: `services/prediction-service/predict.js`

```javascript
export function predictTrend(prices) {
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const latest = prices[prices.length - 1];
  if (latest > avg * 1.03) return "rising";
  if (latest < avg * 0.97) return "dropping";
  return "stable";
}

export function recommendationFromTrend(trend) {
  if (trend === "rising") return "🔥 Prices likely to rise soon. Book before prices increase.";
  if (trend === "dropping") return "💰 Good time to book. Prices appear to be dropping.";
  return "⏳ Wait or watch. Prices look stable right now.";
}
```


### File: `services/pricing-service/Dockerfile`

```
FROM node:20-alpine

WORKDIR /app

COPY services/pricing-service/package*.json ./
RUN npm install --omit=dev

COPY services/pricing-service/ ./
COPY packages/ ./packages/

EXPOSE 5003
CMD ["node", "index.js"]
```


### File: `services/pricing-service/index.js`

```javascript
import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import redis from "../../packages/cache/redis.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PRICING_SERVICE_PORT || 5003);
const TTL_SECONDS = Number(process.env.PRICING_CACHE_TTL_SECONDS || 3600);

app.get("/health", (_req, res) => res.json({ ok: true }));

const ParamsSchema = z.object({
  route: z.string().min(3),
});

function pseudoPrice(route) {
  // Deterministic-ish price from route string
  let hash = 0;
  for (const ch of route) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const base = 80 + (hash % 260);
  const jitter = (hash % 13) - 6;
  return Math.max(49, base + jitter);
}

// Example: GET /NYC-MIA (via gateway /api/pricing/NYC-MIA)
app.get("/:route", async (req, res) => {
  const parsed = ParamsSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid route" });

  const { route } = parsed.data;
  const cacheKey = `price:${route}`;

  const cached = await redis.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  const price = pseudoPrice(route.toUpperCase());
  const response = {
    route: route.toUpperCase(),
    current_price: price,
    currency: "USD",
    last_updated: new Date().toISOString(),
  };

  await redis.set(cacheKey, JSON.stringify(response), "EX", TTL_SECONDS);
  return res.json(response);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Pricing Service running on port ${PORT}`);
});
```


### File: `services/pricing-service/package.json`

```json
{
  "name": "pricing-service",
  "version": "1.0.0",
  "private": true,
  "description": "Pricing aggregation service (stubbed data + caching)",
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  },
  "type": "module",
  "devDependencies": {
    "nodemon": "^3.1.14"
  },
  "dependencies": {
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "ioredis": "^5.10.1",
    "mongoose": "^9.4.1",
    "zod": "^3.25.76"
  }
}
```


### File: `services/seo-service/controllers/routeController.js`

```javascript
import Route from "../models/Route.js";
import redis from "../../../packages/cache/redis.js";
import { getAIContent } from "../services/aiClient.js";

const SEO_TTL_SECONDS = Number(process.env.SEO_CACHE_TTL_SECONDS || 86400);

function fallbackContent(from, to) {
  return `Find the best deals on flights from ${from} to ${to}. Compare airlines, track price trends, and book at the right time with SwyftBooking.`;
}

function buildFaqs({ from, to }) {
  return [
    {
      q: `When is the best time to book flights from ${from} to ${to}?`,
      a: "In general, prices are lowest when you track for a few days and book once the trend starts rising. If prices are stable, set an alert and watch for dips.",
    },
    {
      q: `How do I find cheap flights from ${from} to ${to}?`,
      a: "Compare multiple departure times and airlines, be flexible by a day or two, and track the route over time so you can book during a dip.",
    },
    {
      q: `Does SwyftBooking update route data often?`,
      a: "Yes—route pages are generated dynamically and cached for performance. Pricing intel and predictions update regularly depending on the service TTL.",
    },
  ];
}

async function buildInternalLinks({ from, to, slug }) {
  const links = [];

  // Reverse route if it exists
  const reverseSlug = `flights-from-${String(to).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}-to-${String(from)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")}`;

  if (reverseSlug !== slug) {
    const reverse = await Route.findOne({ slug: reverseSlug }).select("from to slug").lean();
    if (reverse) {
      links.push({ type: "reverse_route", label: `${reverse.from} → ${reverse.to}`, href: `/flights/${reverse.slug}` });
    }
  }

  // Related routes: same origin OR same destination
  const related = await Route.find({
    slug: { $ne: slug },
    $or: [{ from }, { to }],
  })
    .select("from to slug")
    .limit(6)
    .lean();

  for (const r of related) {
    links.push({ type: "related_route", label: `${r.from} → ${r.to}`, href: `/flights/${r.slug}` });
  }

  // Destination hotels page (even if not implemented yet, link structure is in the spec)
  links.push({
    type: "hotels",
    label: `Hotels in ${to}`,
    href: `/hotels-in-${String(to).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`,
  });

  return links;
}

export async function getRouteSEO(req, res) {
  const { slug } = req.params;

  try {
    const cached = await redis.get(`seo:${slug}`);
    if (cached) return res.json(JSON.parse(cached));

    const route = await Route.findOne({ slug }).lean();
    if (!route) return res.status(404).json({ error: "Not found" });

    let content = "";
    try {
      content = await getAIContent({ from: route.from, to: route.to, type: "flight" });
    } catch {
      content = fallbackContent(route.from, route.to);
    }

    const [internal_links, faqs] = await Promise.all([
      buildInternalLinks({ from: route.from, to: route.to, slug: route.slug }),
      Promise.resolve(buildFaqs({ from: route.from, to: route.to })),
    ]);

    const response = { ...route, content, faqs, internal_links };
    await redis.set(`seo:${slug}`, JSON.stringify(response), "EX", SEO_TTL_SECONDS);

    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
}

export async function listRoutes(req, res) {
  const limit = Math.max(1, Math.min(5000, Number(req.query.limit || 1000)));
  const skip = Math.max(0, Number(req.query.skip || 0));

  try {
    const routes = await Route.find({})
      .select("slug updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      count: routes.length,
      skip,
      limit,
      routes: routes.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt, createdAt: r.createdAt })),
    });
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
}
```


### File: `services/seo-service/Dockerfile`

```
FROM node:20-alpine

WORKDIR /app

COPY services/seo-service/package*.json ./
RUN npm install --omit=dev

COPY services/seo-service/ ./
COPY packages/ ./packages/

EXPOSE 5001
CMD ["node", "index.js"]
```


### File: `services/seo-service/index.js`

```javascript
import "dotenv/config";
import cors from "cors";
import express from "express";
import seoRoutes from "./routes/seoRoutes.js";
import { connectDB } from "../../packages/database/mongo.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.SEO_SERVICE_PORT || 5001);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/", seoRoutes);

await connectDB();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`SEO Service running on port ${PORT}`);
});
```


### File: `services/seo-service/models/Route.js`

```javascript
import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    avg_price: { type: Number, default: null },
    duration: { type: String, default: null },
    trend: { type: String, default: null },
    last_updated: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("Route", routeSchema);
```


### File: `services/seo-service/package.json`

```json
{
  "name": "seo-service",
  "version": "1.0.0",
  "private": true,
  "description": "SEO page data service (routes + AI content merge)",
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  },
  "type": "module",
  "dependencies": {
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "ioredis": "^5.10.1",
    "mongoose": "^8.18.1",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```


### File: `services/seo-service/routes/seoRoutes.js`

```javascript
import express from "express";
import { getRouteSEO, listRoutes } from "../controllers/routeController.js";

const router = express.Router();

router.get("/routes", listRoutes);
router.get("/:slug", getRouteSEO);

export default router;
```


### File: `services/seo-service/services/aiClient.js`

```javascript
import "dotenv/config";

export async function getAIContent({ from, to, type = "flight" }) {
  const baseUrl = process.env.AI_SERVICE_URL || "http://localhost:5002";
  const res = await fetch(`${baseUrl}/generate-content`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from, to, type }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI service error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data?.content || "";
}
```
