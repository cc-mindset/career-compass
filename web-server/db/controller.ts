import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_MAX_RETRY = 5;
const MONGO_RETRY_INTERVAL = 5000;

/**
 * MongoDBClient Connection Manager
 * Handles database connection with retry logic
 */
class MongoDBClient {
  private static instance: MongoDBClient;
  private mongoRetriesLeft: number;
  private dbConfig: { url: string; options: any };
  private isConnected: boolean;
  private connectionPromise: Promise<void> | null;

  private constructor(dbConfig: { url: string; options: any }) {
    this.dbConfig = dbConfig;
    this.mongoRetriesLeft = MONGO_MAX_RETRY;
    this.isConnected = false;
    this.connectionPromise = null;
  }

  private disconnected = () => {
    logger.warn("⚠️  MongoDB disconnected");
    this.isConnected = false;
    this.reconnectMongo("MongoDB disconnected.");
  };

  private open = () => {
    this.resetRetryLimit();
    this.isConnected = true;
    logger.info(`✓ MongoDB connected at: ${this.dbConfig.url}`);
  };

  private error = (er: Error) => {
    const { message } = er;
    logger.error("MongoDB connection error:", er);
    this.isConnected = false;
    if (er.name !== "MongoNetworkError") throw new Error(message);
  };

  public static getInstance(dbConfig: {
    url: string;
    options: any;
  }): MongoDBClient {
    if (!MongoDBClient.instance) {
      MongoDBClient.instance = new MongoDBClient(dbConfig);
    }
    return MongoDBClient.instance;
  }

  /**
   * Connect to MongoDB
   * @returns {Promise<void>}
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info("✓ Already connected to MongoDB");
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    logger.info(`Mongo: connecting to: ${this.dbConfig.url}`);

    this.connectionPromise = this.connectMongo();

    await this.connectionPromise;
    this.connectionPromise = null;

    mongoose.connection.on("error", this.error);
    mongoose.connection.on("disconnected", this.disconnected);
    mongoose.connection.on("open", () => this.open());
    mongoose.connection.on("reconnected", () => {
      logger.info("✓ MongoDB reconnected");
      this.isConnected = true;
    });
  }

  private async connectMongo(): Promise<void> {
    if (this.dbConfig.url) {
      await mongoose.connect(this.dbConfig.url, this.dbConfig.options);
    } else {
      logger.error("MongoDB configuration error");
      throw new Error("MongoDB configuration error");
    }
  }

  private resetRetryLimit = () => {
    this.mongoRetriesLeft = MONGO_MAX_RETRY;
    logger.info(
      `Reset MongoDB connection recovery. Retries left: ${this.mongoRetriesLeft}`,
    );
  };

  private reconnectMongo = (message: string) => {
    if (this.mongoRetriesLeft > 0) {
      this.mongoRetriesLeft -= 1;
      setTimeout(() => {
        logger.info(
          `Retrying MongoDB connection. Retries left: ${this.mongoRetriesLeft}`,
        );
        this.connectMongo();
      }, MONGO_RETRY_INTERVAL);
    } else {
      throw new Error(message);
    }
  };

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info("✓ Disconnected from MongoDB");
    } catch (error) {
      logger.error("Error disconnecting from MongoDB:", error);
      throw error;
    }
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  public checkConnection(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  logger.error("❌ MONGODB_URI is not defined in environment variables");
  throw new Error("MONGODB_URI environment variable is required");
}

const dbConfig = {
  url: MONGODB_URI!,
  options: {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 50000,
  },
};

export const mongodbClient = MongoDBClient.getInstance(dbConfig);
