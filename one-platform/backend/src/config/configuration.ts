export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongodbUri:
    process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/swyftbooking',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? '127.0.0.1:9092')
    .split(',')
    .map((s) => s.trim()),
  aiServicesUrl: process.env.AI_SERVICES_URL ?? 'http://127.0.0.1:8000',
});
