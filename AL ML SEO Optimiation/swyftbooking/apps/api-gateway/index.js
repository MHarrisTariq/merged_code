import "dotenv/config";
import cors from "cors";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import Redis from "ioredis";
import client from "prom-client";
import { z } from "zod";

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

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: 2,
});

redis.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[gateway:redis] error", err?.message || err);
});

function createRedisRateLimiter({ windowSeconds, max, keyPrefix = "rl" }) {
  const windowSecondsNum = Math.max(1, Number(windowSeconds));
  const maxNum = Math.max(1, Number(max));

  return async function rateLimit(req, res, next) {
    try {
      const ip = getClientIp(req);
      const path = req.baseUrl || req.path || "/";
      const key = `${keyPrefix}:${ip}:${path}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSecondsNum);
      }

      const ttl = await redis.ttl(key);
      const resetAt = Math.floor(Date.now() / 1000) + Math.max(0, ttl);

      res.setHeader("RateLimit-Limit", String(maxNum));
      res.setHeader("RateLimit-Remaining", String(Math.max(0, maxNum - count)));
      res.setHeader("RateLimit-Reset", String(resetAt));

      if (count > maxNum) {
        return res.status(429).json({
          error: "Rate limit exceeded",
          retry_after_seconds: Math.max(1, ttl),
        });
      }
      return next();
    } catch {
      // If limiter fails, don't take the whole platform down.
      return next();
    }
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

// Default rate limit for all APIs (per IP per path) — Redis-backed (scales across instances)
app.use(
  "/api",
  createRedisRateLimiter({
    windowSeconds: 60,
    max: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
    keyPrefix: "rl",
  }),
);
// Stricter limit for AI generation
app.use(
  "/api/ai",
  createRedisRateLimiter({
    windowSeconds: 60,
    max: Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 30),
    keyPrefix: "rl-ai",
  }),
);

const targets = {
  seo: process.env.SEO_SERVICE_URL || "http://localhost:5001",
  ai: process.env.AI_SERVICE_URL || "http://localhost:5002",
  pricing: process.env.PRICING_SERVICE_URL || "http://localhost:5003",
  prediction: process.env.PREDICTION_SERVICE_URL || "http://localhost:5004",
  analytics: process.env.ANALYTICS_SERVICE_URL || "http://localhost:5005",
};

const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

// Basic Prometheus metrics (Phase 1 observability)
client.collectDefaultMetrics();
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests served by gateway",
  labelNames: ["method", "path", "status"],
});

app.use((req, res, next) => {
  res.on("finish", () => {
    const path = req.baseUrl || req.path || "/";
    httpRequestsTotal.inc({ method: req.method, path, status: String(res.statusCode) }, 1);
  });
  next();
});

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

app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

function requireAdminKey(req, res, next) {
  if (!ADMIN_API_KEY) return res.status(503).json({ error: "ADMIN_API_KEY not configured" });
  const provided = String(req.headers["x-admin-key"] || "");
  if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });
  return next();
}

const RouteCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/)
  .transform((s) => s.toUpperCase());

const SlugSchema = z
  .string()
  .min(3)
  .max(200)
  .regex(/^[a-z0-9-]+$/);

function validateParam(schema, key) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.params[key]);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    req.params[key] = parsed.data;
    return next();
  };
}

function proxyCommon({ target, pathRewrite }) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    timeout: Number(process.env.GATEWAY_TIMEOUT_MS || 5000),
    proxyTimeout: Number(process.env.GATEWAY_PROXY_TIMEOUT_MS || 5000),
    onProxyReq: (proxyReq, req) => {
      // propagate request-id + internal token
      const reqId = String(req.headers["x-request-id"] || "");
      if (reqId) proxyReq.setHeader("x-request-id", reqId);
      if (INTERNAL_SERVICE_TOKEN) proxyReq.setHeader("x-internal-token", INTERNAL_SERVICE_TOKEN);
    },
    onError: (_err, _req, res) => {
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "application/json" });
      }
      res.end(JSON.stringify({ error: "Upstream unavailable" }));
    },
  });
}

app.use(
  "/api/seo",
  proxyCommon({ target: targets.seo, pathRewrite: { "^/api/seo": "" } }),
);

app.use(
  "/api/ai",
  proxyCommon({ target: targets.ai, pathRewrite: { "^/api/ai": "" } }),
);

// Protect write endpoints
app.use("/api/pricing/ingest", requireAdminKey);

// Validate hot paths at the edge (reject bad traffic early)
app.use("/api/pricing/history/:route", validateParam(RouteCodeSchema, "route"));
app.use("/api/pricing/:route", validateParam(RouteCodeSchema, "route"));
app.use("/api/predict/:route", validateParam(RouteCodeSchema, "route"));
app.use("/api/seo/:slug", validateParam(SlugSchema, "slug"));

app.use("/api/pricing", proxyCommon({ target: targets.pricing, pathRewrite: { "^/api/pricing": "" } }));

app.use(
  "/api/predict",
  proxyCommon({ target: targets.prediction, pathRewrite: { "^/api/predict": "" } }),
);

// Protect analytics ingestion (write endpoint)
app.use("/api/track", requireAdminKey);
app.use(
  "/api/track",
  proxyCommon({ target: targets.analytics, pathRewrite: { "^/": "/track" } }),
);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API Gateway running on port ${PORT}`);
});

