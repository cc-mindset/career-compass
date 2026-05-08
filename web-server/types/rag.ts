/**
 * RAG Retrieval Service Type Definitions
 * Core contract for the independent retrieval service and its consumers
 */

/**
 * Namespace enum for Pinecone vector database
 * Maps to data pipelines and content sources
 */
export enum RagNamespace {
  MARKET_REPORTS = 'market-reports',     // PDF/document reports from rag-pipeline
  MARKET_NEWS = 'market-news',           // SERP news articles from market_news pipeline
  LABOR_MARKET_STATS = 'labor-market-stats',     // BLS/StatsCan data from market_stats pipeline
  GEO_LABOR_SIGNALS = 'geo-labor-signals',       // Regional/geographic labor indicators
}

/**
 * A single match result from Pinecone
 * Includes vector score, text content, and arbitrary metadata
 */
export interface PineconeMatch {
  id: string;                                    // Document/record ID from Pinecone
  score: number;                                 // Similarity score (0-1 or higher, cosine metric)
  text: string;                                  // Extracted text content for LLM consumption
  metadata: Record<string, unknown>;             // Source metadata (doc title, date, source, etc.)
}

/**
 * Request payload for retrieve() service
 * Either text query or precomputed vector, one or more namespaces, optional cache/topK control
 */
export interface RagRetrievalRequest {
  query?: string;                                // Text query (creates embedding via OpenAI)
  vector?: number[];                             // Precomputed embedding vector (mutually exclusive with query)
  namespaces: RagNamespace[];                    // Which namespaces to query
  topK?: number;                                 // Default results per namespace (e.g., 10)
  useCache?: boolean;                            // Enable in-memory caching (default: true)
  bustCache?: boolean;                           // Force fresh Pinecone query, ignore cache
  requestId?: string;                            // Optional trace ID for logging/debugging
}

/**
 * Response from retrieve() service
 * Raw namespace results (not formatted for LLM yet); caller must format as needed
 */
export interface RagRetrievalResponse {
  requestText?: string;                          // Original query text (if provided)
  vector?: number[];                             // Vector used for query
  results: Record<RagNamespace | string, PineconeMatch[]>;  // Raw matches per namespace
  cacheHits: (RagNamespace | string)[];         // Namespaces served from cache
  cacheMisses: (RagNamespace | string)[];        // Namespaces queried fresh
  errorsByNamespace?: Record<RagNamespace | string, string>;  // Any per-namespace errors
  timings?: {
    embeddingMs?: number;
    queryMs?: number;
    totalMs?: number;
  };
}

/**
 * Formatted context ready for LLM prompt injection
 * Product-specific formatters (e.g., for market-insights) consume RagRetrievalResponse and produce this
 */
export interface FormattedRagContext {
  text: string;                                  // Plain text context for prompt
  sourcesByNamespace: Record<RagNamespace | string, { id: string; source: string }[]>;  // Trackable sources
  matchCount: number;                            // Total matches included
}
