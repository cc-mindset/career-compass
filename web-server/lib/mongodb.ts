import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

/**
 * MongoDB Connection Manager
 * Handles database connection with retry logic
 */
class MongoDBClient {
  private isConnected: boolean;
  private connectionPromise: Promise<void> | null;

  constructor() {
    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Connect to MongoDB
   * @returns {Promise<void>}
   */
  async connect(): Promise<void> {
    // Return existing connection if already connected
    if (this.isConnected) {
      logger.info('✓ Already connected to MongoDB');
      return;
    }

    // Return existing connection promise if connection is in progress
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
      logger.error('❌ MONGODB_URI is not defined in environment variables');
      throw new Error('MONGODB_URI environment variable is required');
    }

    try {
      this.connectionPromise = mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }).then(() => {
        // Connection successful, but we'll handle setting isConnected below
      });

      await this.connectionPromise;
      this.isConnected = true;
      this.connectionPromise = null;

      logger.info('✓ Connected to MongoDB');

      // Handle connection events
      mongoose.connection.on('disconnected', () => {
        logger.warn('⚠️  MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('error', (err: Error) => {
        logger.error('MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('✓ MongoDB reconnected');
        this.isConnected = true;
      });
    } catch (error) {
      this.connectionPromise = null;
      this.isConnected = false;
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('✓ Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  checkConnection(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }
}

// Export singleton instance
export const mongodbClient = new MongoDBClient();
