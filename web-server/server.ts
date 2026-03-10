import dotenv from "dotenv";
import { tokenBudget } from "./lib/openai.js";

// Load environment variables FIRST before any other imports
dotenv.config();
tokenBudget.logLimits();

import http from "http";
import { initializeWebSocket } from "./lib/websocket.js";
import { connectRedis } from "./lib/redis.js";
import { app } from "./app";
import { mongodbClient } from "./db/controller.js";
import { processQueue } from "./utils/serverQueue.js";

const server = http.createServer(app);

const wsEnabled = initializeWebSocket(server); // Initialize WebSocket
if (!wsEnabled) {
  console.warn(
    "⚠️  Running without WebSocket support - falling back to polling",
  );
}

//Connect to Redis and MongoDB on startup
(async function startServer() {
  try {
    console.log("Connecting to MongoDB...");
    await mongodbClient.connect();
    console.log("Connected to MongoDB");

    console.log("Connecting to Redis...");
    const redisConnected = await connectRedis();
    if (redisConnected) {
      console.log("Connected to Redis");
      console.log("Starting queue processor...");
      processQueue();
    } else {
      console.warn("Redis unavailable. Running without cache and queue.");
    }

    // Log final status summary
    console.log("═══════════════════════════════════════");
    console.log(`✓ MongoDB: Connected`);
    console.log(
      `${redisConnected ? "✓" : "✗"} Redis: ${redisConnected ? "Connected" : "Unavailable (using fallback)"}`,
    );
    console.log(
      `${wsEnabled ? "✓" : "✗"} WebSocket: ${wsEnabled ? "Enabled" : "Disabled (using polling)"}`,
    );
    console.log("═══════════════════════════════════════");
  } catch (error) {
    console.error("Error connecting to databases:", error);
    process.exit(1);
  }
})();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`✓ Server running at ${PORT}`);
});
