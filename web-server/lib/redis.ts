import { createClient } from "redis";

const sleep = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms));
let redisAvailable = false;

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: false, //already handling reconnection manually
  },
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});

export const connectRedis = async (retries = 2) => {
  // if (!redisClient.isOpen) {
  //     await redisClient.connect();
  // }
  if (redisClient.isOpen) {
    redisAvailable = true;
    return true;
  }
  for (let i = 1; i <= retries; i++) {
    try {
      await redisClient.connect();
      redisAvailable = true;
      return true;
    } catch (e) {
      if (i < retries) await sleep(2000);
    }
  }
  redisAvailable = false;
  return false;
};

export const isRedisAvailable = () => redisAvailable;

export const getRedisClient = () => {
  return redisClient;
};

//not using now but may be useful in future
export const disconnectRedis = async () => {
  if (redisClient.isOpen) {
    await redisClient.disconnect();
  }
};
export const safeGet = async (key: string) => {
  if (!redisAvailable) return null;
  try {
    return await redisClient.get(key);
  } catch {
    return null;
  }
};

export const safeSet = async (key: string, value: string, ttl: number) => {
  if (!redisAvailable) return null;
  try {
    return await redisClient.set(key, value, { EX: ttl });
  } catch {
    return null;
  }
};

export default redisClient;
