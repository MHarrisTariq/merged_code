import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { predictTrend, recommendationFromTrend } from "./predict.js";
import { internalAuthMiddleware } from "../../packages/utils/internalAuth.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(internalAuthMiddleware());

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

async function getPriceHistory(route) {
  const baseUrl = process.env.PRICING_SERVICE_URL || "http://localhost:5003";
  const res = await fetch(`${baseUrl}/history/${encodeURIComponent(route)}?limit=60`);
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  // oldest -> newest
  return items
    .map((x) => Number(x?.price))
    .filter((n) => Number.isFinite(n))
    .reverse();
}

// Spec: GET /api/predict/:route (via gateway)
app.get("/:route", async (req, res) => {
  const parsed = ParamsSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid route" });

  const route = parsed.data.route.toUpperCase();

  try {
    const latest = await getCurrentPrice(route);
    const hist = await getPriceHistory(route);
    // If no history yet, fall back to a minimal baseline series.
    const history = hist.length >= 4 ? hist : [latest * 0.92, latest * 0.98, latest * 1.01, latest];
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

