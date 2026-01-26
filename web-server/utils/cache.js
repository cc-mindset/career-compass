import { logger } from './logger.js';

/**
 * Simple in-memory cache with TTL support
 * Prevents redundant API calls for the same data
 */
class Cache {
  constructor() {
    this.store = new Map();
    this.ttlDefaults = {
      marketInsights: 24 * 60 * 60 * 1000, // 24 hours
      pineconeResults: 60 * 60 * 1000,      // 1 hour
      embeddings: 7 * 24 * 60 * 60 * 1000,  // 7 days
    };
  }

  /**
   * Generate cache key
   */
  generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
  }

  /**
   * Set cache entry with TTL
   */
  set(key, value, ttl = null) {
    const expiresAt = ttl ? Date.now() + ttl : null;
    
    this.store.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });

    logger.debug(`📦 Cached: ${key} (TTL: ${ttl ? `${ttl / 1000}s` : 'never'})`);
  }

  /**
   * Get cache entry
   */
  get(key) {
    const entry = this.store.get(key);

    if (!entry) {
      logger.debug(`❌ Cache miss: ${key}`);
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      logger.debug(`⏰ Cache expired: ${key}`);
      this.store.delete(key);
      return null;
    }

    logger.debug(`✓ Cache hit: ${key}`);
    return entry.value;
  }

  /**
   * Delete cache entry
   */
  delete(key) {
    const deleted = this.store.delete(key);
    if (deleted) {
      logger.debug(`🗑️ Deleted cache: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear() {
    const size = this.store.size;
    this.store.clear();
    logger.info(`🗑️ Cleared ${size} cache entries`);
  }

  /**
   * Clean expired entries
   */
  cleanExpired() {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Get cache stats
   */
  getStats() {
    const now = Date.now();
    let active = 0;
    let expired = 0;

    for (const entry of this.store.values()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.store.size,
      active,
      expired,
    };
  }
}

// Export singleton instance
export const cache = new Cache();

// Clean expired entries every 15 minutes
setInterval(() => cache.cleanExpired(), 15 * 60 * 1000);
