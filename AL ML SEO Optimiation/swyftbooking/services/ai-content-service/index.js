import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import redis from "../../packages/cache/redis.js";
import { generateSEOContent } from "./aiClient.js";
import { internalAuthMiddleware } from "../../packages/utils/internalAuth.js";
import { uniquenessScore } from "./uniqueness.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(internalAuthMiddleware());

const PORT = Number(process.env.AI_SERVICE_PORT || 5002);
const TTL_SECONDS = Number(process.env.AI_CACHE_TTL_SECONDS || 86400);
const RECENT_POOL_SIZE = Number(process.env.AI_RECENT_POOL_SIZE || 250);
const MIN_UNIQUENESS = Number(process.env.AI_MIN_UNIQUENESS || 0.35); // 0..1
const MAX_REGENERATIONS = Number(process.env.AI_MAX_REGENERATIONS || 3);

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
  const recentKey = `ai:recent:${type}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ content: cached, cached: true, uniqueness_score: null });

    const previous = await redis.lrange(recentKey, 0, RECENT_POOL_SIZE - 1);

    let content = "";
    let score = 0;
    let regen = 0;
    for (let attempt = 0; attempt <= MAX_REGENERATIONS; attempt += 1) {
      content = await generateSEOContent({ from, to, type });
      score = uniquenessScore(content, previous);
      if (score >= MIN_UNIQUENESS) {
        regen = attempt;
        break;
      }
      regen = attempt;
    }

    // Store as recent corpus for similarity checks
    if (content) {
      await redis.lpush(recentKey, content);
      await redis.ltrim(recentKey, 0, RECENT_POOL_SIZE - 1);
    }

    await redis.set(cacheKey, content, "EX", TTL_SECONDS);

    return res.json({
      content,
      cached: false,
      uniqueness_score: Number(score.toFixed(3)),
      regenerated: regen,
      uniqueness_threshold: MIN_UNIQUENESS,
    });
  } catch {
    return res.json({
      content: `Plan your trip from ${from} to ${to} with SwyftBooking. Compare options, watch for price moves, and book when it’s best for you.`,
      cached: false,
      fallback: true,
      uniqueness_score: null,
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AI Content Service running on port ${PORT}`);
});

