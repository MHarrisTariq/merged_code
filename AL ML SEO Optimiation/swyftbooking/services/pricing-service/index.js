import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import redis from "../../packages/cache/redis.js";
import mongoose from "mongoose";
import PriceSnapshot from "./models/PriceSnapshot.js";
import { internalAuthMiddleware } from "../../packages/utils/internalAuth.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(internalAuthMiddleware());

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

// Phase-1 data pipeline: persist daily snapshots (even if pricing is still stubbed).
// This gives Prediction Service real historical series to work with.
const IngestSchema = z.object({
  route: z.string().min(3),
  date_checked: z.union([z.string(), z.date()]).optional(),
  departure_date: z.union([z.string(), z.date()]).optional().nullable(),
  price: z.number().positive(),
  airline: z.string().optional().nullable(),
  currency: z.string().optional().default("USD"),
  source: z.string().optional().default("stub"),
  days_before_departure: z.number().int().optional().nullable(),
});

app.post("/ingest", async (req, res) => {
  const parsed = IngestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const d = parsed.data;
  const routeUpper = d.route.toUpperCase();
  const dateChecked = d.date_checked ? new Date(d.date_checked) : new Date();
  const dayKey = new Date(Date.UTC(dateChecked.getUTCFullYear(), dateChecked.getUTCMonth(), dateChecked.getUTCDate()));

  // Dedup strategy (Phase 1):
  // For each route+day+source, keep the most recent snapshot.
  const result = await PriceSnapshot.updateOne(
    { route: routeUpper, source: d.source, date_checked: { $gte: dayKey, $lt: new Date(dayKey.getTime() + 24 * 3600 * 1000) } },
    {
      $set: {
        route: routeUpper,
        source: d.source,
        date_checked: dateChecked,
        departure_date: d.departure_date ? new Date(d.departure_date) : null,
        price: d.price,
        airline: d.airline || null,
        currency: d.currency,
        days_before_departure: d.days_before_departure ?? null,
      },
    },
    { upsert: true },
  );

  return res.status(201).json({ ok: true, upserted: Boolean(result.upsertedId) });
});

// Get recent history for a route (used by prediction service).
app.get("/history/:route", async (req, res) => {
  const parsed = ParamsSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid route" });

  const route = parsed.data.route.toUpperCase();
  const limit = Math.max(1, Math.min(365, Number(req.query.limit || 60)));

  const items = await PriceSnapshot.find({ route })
    .select("date_checked price currency airline source")
    .sort({ date_checked: -1 })
    .limit(limit)
    .lean();

  return res.json({
    route,
    count: items.length,
    items: items.map((x) => ({
      date_checked: x.date_checked,
      price: x.price,
      currency: x.currency,
      airline: x.airline,
      source: x.source,
    })),
  });
});

await mongoose.connect(process.env.MONGO_URI);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Pricing Service running on port ${PORT}`);
});

