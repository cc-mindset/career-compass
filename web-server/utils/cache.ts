import { CacheEntry, CacheStats } from '../types/cache.js';
import { logger } from './logger.js';

/**
 * Simple in-memory cache with TTL support
 * Prevents redundant API calls for the same data
 */
class Cache {
  private store: Map<string, CacheEntry<unknown>>;
  // private ttlDefaults: TTLDefaults;

  constructor() {
    this.store = new Map();
    // this.ttlDefaults = {
    //   marketInsights: 24 * 60 * 60 * 1000, // 24 hours
    //   pineconeResults: 60 * 60 * 1000,      // 1 hour
    //   embeddings: 7 * 24 * 60 * 60 * 1000,  // 7 days
    // };
  }

  /**
   * Generate cache key
   */
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  /**
   * Set cache entry with TTL
   */
  set<T>(key: string, value: T, ttl: number | null = null): void {
    const expiresAt = ttl ? Date.now() + ttl : null;
    
    this.store.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    } as CacheEntry<T>);

    logger.debug(`📦 Cached: ${key} (TTL: ${ttl ? `${ttl / 1000}s` : 'never'})`);
  }

  /**
   * Get cache entry
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;

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
    return entry.value as T;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const deleted = this.store.delete(key);
    if (deleted) {
      logger.debug(`🗑️ Deleted cache: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.store.size;
    this.store.clear();
    logger.info(`🗑️ Cleared ${size} cache entries`);
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): void {
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
  getStats(): CacheStats {
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
