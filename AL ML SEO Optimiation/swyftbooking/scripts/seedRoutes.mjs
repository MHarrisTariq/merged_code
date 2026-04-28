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

