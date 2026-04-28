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

