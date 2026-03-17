export interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
  createdAt: number;
}

export interface CacheStats {
  total: number;
  active: number;
  expired: number;
}

export interface TTLDefaults {
  marketInsights: number;
  pineconeResults: number;
  embeddings: number;
}
