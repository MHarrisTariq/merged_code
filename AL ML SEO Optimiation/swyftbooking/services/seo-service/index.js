import "dotenv/config";
import cors from "cors";
import express from "express";
import seoRoutes from "./routes/seoRoutes.js";
import mongoose from "mongoose";
import { internalAuthMiddleware } from "../../packages/utils/internalAuth.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(internalAuthMiddleware());

const PORT = Number(process.env.SEO_SERVICE_PORT || 5001);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/", seoRoutes);

await mongoose.connect(process.env.MONGO_URI);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`SEO Service running on port ${PORT}`);
});

