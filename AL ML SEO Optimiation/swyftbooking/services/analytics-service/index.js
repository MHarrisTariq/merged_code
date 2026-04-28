import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import mongoose from "mongoose";
import AnalyticsEvent from "./models/AnalyticsEvent.js";
import { internalAuthMiddleware } from "../../packages/utils/internalAuth.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(internalAuthMiddleware());

const PORT = Number(process.env.ANALYTICS_SERVICE_PORT || 5005);

app.get("/health", (_req, res) => res.json({ ok: true }));

const TrackSchema = z.object({
  event: z.string().min(1),
  data: z.record(z.any()).optional().default({}),
  timestamp: z.union([z.string(), z.date()]).optional(),
  user_id: z.string().optional(),
});

// Phase-1 batching (avoid write-per-event at higher volume)
const buffer = [];
const BATCH_SIZE = Number(process.env.ANALYTICS_BATCH_SIZE || 200);
const FLUSH_INTERVAL_MS = Number(process.env.ANALYTICS_FLUSH_INTERVAL_MS || 2000);
let flushing = false;

async function flush() {
  if (flushing) return;
  if (!buffer.length) return;
  flushing = true;
  try {
    const batch = buffer.splice(0, BATCH_SIZE);
    if (!batch.length) return;
    await AnalyticsEvent.insertMany(batch, { ordered: false });
  } finally {
    flushing = false;
  }
}

setInterval(() => {
  flush().catch(() => {});
}, FLUSH_INTERVAL_MS).unref?.();

// Spec: POST /api/track (via gateway)
app.post("/track", async (req, res) => {
  const parsed = TrackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { event, data, user_id } = parsed.data;
  const ts = parsed.data.timestamp ? new Date(parsed.data.timestamp) : new Date();

  buffer.push({
    event,
    data,
    user_id: user_id || null,
    timestamp: ts,
  });
  if (buffer.length >= BATCH_SIZE) {
    flush().catch(() => {});
  }

  return res.sendStatus(200);
});

await mongoose.connect(process.env.MONGO_URI);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Analytics Service running on port ${PORT}`);
});

