const Redis = require("ioredis");

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis
  .connect()
  .then(() => console.log("[redis] Connected"))
  .catch((err) => console.warn("[redis] Connection failed: ", err.message));

redis.on("error", (err) => {
  console.warn("[redis] Error: ", err.message);
});

const KEYS = {
  ACTIVE_CONTEST: "contest:active",
  PREV_WINNERS: "contest:prev-winners",
};

module.exports = {
  redis,
  KEYS,
};
