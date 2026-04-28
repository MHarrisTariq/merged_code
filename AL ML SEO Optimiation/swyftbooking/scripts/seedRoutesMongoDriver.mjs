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

