import IORedis from "ioredis";

const redis = new IORedis({
  port: parseInt(process.env.REDIS_PORT ?? "6379"),
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  maxRetriesPerRequest: null,
});

export { redis };
