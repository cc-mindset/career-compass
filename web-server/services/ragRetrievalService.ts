/**
 * RAG Retrieval Service
 * Core service for vector-based document retrieval across Pinecone namespaces
 * 
 * Responsibilities:
 * - Generate embeddings for text queries or accept precomputed vectors
 * - Query Pinecone namespaces in parallel
 * - Cache embeddings and retrieval results in-memory
 * - Track cache hits/misses and query performance
 * - Return raw structured retrieval results (no LLM calls, no formatting)
 * 
 * NOT responsible for: prompt formatting, LLM generation, DB caching of final outputs
 */

import { logger } from '../utils/logger.js';
import { openaiClient } from '../lib/openai.js';
import { pineconeClient } from '../lib/pinecone.js';
import { cache } from '../utils/cache.js';
import { RagRetrievalRequest, RagRetrievalResponse, RagNamespace, PineconeMatch } from '../types/rag.js';
import crypto from 'crypto';
import pLimit from 'p-limit';

/**
 * Hash a query string for deterministic cache key generation
 */
function hashQuery(query: string): string {
  return crypto.createHash('sha256').update(query).digest('hex').substring(0, 16);
}

/**
 * Generate cache key for embedding
 */
function getEmbeddingCacheKey(query: string): string {
  return `rag:embed:${hashQuery(query)}`;
}

/**
 * Generate cache key for namespace retrieval results
 */
function getNamespaceCacheKey(queryHash: string, namespace: string): string {
  return `rag:ns:${queryHash}:${namespace}`;
}

/**
 * Core retrieval service — vector search across namespaces
 * Handles embedding generation, Pinecone queries, and in-memory caching
 */
export async function retrieve(request: RagRetrievalRequest): Promise<RagRetrievalResponse> {
  const startTime = Date.now();
  const {
    query,
    vector: suppliedVector,
    namespaces,
    topK = 10,
    useCache = true,
    bustCache = false,
    requestId = crypto.randomUUID(),
  } = request;

  // ── Validate input ──
  if (!query && !suppliedVector) {
    throw new Error('RagRetrievalRequest: either query (text) or vector (precomputed) is required');
  }
  if (query && suppliedVector) {
    throw new Error('RagRetrievalRequest: provide either query or vector, not both');
  }
  if (!namespaces || namespaces.length === 0) {
    throw new Error('RagRetrievalRequest: namespaces array is required and cannot be empty');
  }

  logger.info(
    `🔍 [${requestId}] RAG retrieval request: namespaces=${namespaces.join(',')}, topK=${topK}, ${query ? 'text query' : 'vector provided'}`
  );

  // ── Step 1: Get or create embedding vector ──
  let vector = suppliedVector;
  let embeddingMs = 0;
  let queryHash: string;

  if (query) {
    queryHash = hashQuery(query);

    // Check embedding cache first
    if (useCache && !bustCache) {
      const embeddingCacheKey = getEmbeddingCacheKey(query);
      const cachedVector = cache.get<number[]>(embeddingCacheKey);
      if (cachedVector) {
        vector = cachedVector;
        logger.debug(`✓ [${requestId}] Embedding cache hit`);
      }
    }

    // Generate embedding if not cached
    if (!vector) {
      const embeddingStart = Date.now();
      try {
        vector = await openaiClient.createEmbedding(query) as number[];
        embeddingMs = Date.now() - embeddingStart;

        // Cache the embedding (7-day TTL by default, configurable via env)
        if (useCache) {
          const embeddingCacheKey = getEmbeddingCacheKey(query);
          const embeddingTTL = parseInt(process.env.RAG_EMBEDDING_CACHE_TTL_MS || String(7 * 24 * 60 * 60 * 1000));
          cache.set(embeddingCacheKey, vector, embeddingTTL);
          logger.debug(`✓ [${requestId}] Embedding generated and cached (${embeddingMs}ms)`);
        }
      } catch (error) {
        logger.error(`❌ [${requestId}] Embedding generation failed:`, error);
        throw error;
      }
    }
  } else {
    // Vector supplied directly — hash for cache keying
    queryHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(suppliedVector!))
      .digest('hex')
      .substring(0, 16);
    logger.debug(`✓ [${requestId}] Using precomputed vector`);
  }

  // ── Step 2: Check per-namespace cache and identify what to query ──
  const cachedResults: Record<string, PineconeMatch[]> = {};
  const namespacesToQuery: string[] = [];
  const cacheHits: string[] = [];
  const cacheMisses: string[] = [];

  for (const namespace of namespaces) {
    const nsStr = typeof namespace === 'string' ? namespace : namespace;

    if (useCache && !bustCache) {
      const nsCacheKey = getNamespaceCacheKey(queryHash, nsStr);
      const cached = cache.get<PineconeMatch[]>(nsCacheKey);
      if (cached) {
        cachedResults[nsStr] = cached;
        cacheHits.push(nsStr);
        logger.debug(`✓ [${requestId}] Cache hit: ${nsStr}`);
        continue;
      }
    }

    namespacesToQuery.push(nsStr);
    cacheMisses.push(nsStr);
  }

  // ── Step 3: Query Pinecone for uncached namespaces in parallel ──
  const queryStart = Date.now();
  let freshResults: Record<string, PineconeMatch[]> = {};
  const errorsByNamespace: Record<string, string> = {};

  if (namespacesToQuery.length > 0) {
    logger.info(`🔍 [${requestId}] Querying ${namespacesToQuery.length} namespaces from Pinecone`);

    // Use concurrency limiter to avoid overwhelming Pinecone with parallel requests
    const concurrency = parseInt(process.env.RAG_QUERY_CONCURRENCY || '3');
    const limit = pLimit(concurrency);

    const promises = namespacesToQuery.map(nsStr =>
      limit(async () => {
        try {
          const result = await pineconeClient.queryNamespaceWithVector(nsStr, vector!, topK);
          
          // Extract text from metadata and build match objects
          const matches: PineconeMatch[] = (result.matches || [])
            .filter(match => match.metadata?.text) // Only include matches with text
            .map(match => ({
              id: match.id,
              score: match.score || 0,
              text: (match.metadata!.text as string) || '',
              metadata: match.metadata || {},
            }));

          logger.debug(`✓ [${requestId}] ${nsStr}: ${matches.length} matches`);

          // Cache this namespace result (1-hour TTL by default, configurable via env)
          if (useCache) {
            const nsCacheKey = getNamespaceCacheKey(queryHash, nsStr);
            const resultTTL = parseInt(process.env.RAG_RESULT_CACHE_TTL_MS || String(60 * 60 * 1000));
            cache.set(nsCacheKey, matches, resultTTL);
          }

          return { namespace: nsStr, matches, error: null };
        } catch (error) {
          const err = error as Error;
          logger.error(`❌ [${requestId}] Failed to query ${nsStr}: ${err.message}`);
          errorsByNamespace[nsStr] = err.message;
          return { namespace: nsStr, matches: [], error: err.message };
        }
      })
    );

    const results = await Promise.all(promises);
    results.forEach(({ namespace, matches }) => {
      freshResults[namespace] = matches;
    });
  }

  const queryMs = Date.now() - queryStart;

  // ── Step 4: Assemble final response ──
  const allResults: Record<string, PineconeMatch[]> = {
    ...freshResults,
    ...cachedResults,
  };

  const response: RagRetrievalResponse = {
    requestText: query,
    vector: vector,
    results: allResults,
    cacheHits,
    cacheMisses,
    errorsByNamespace: Object.keys(errorsByNamespace).length > 0 ? errorsByNamespace : undefined,
    timings: {
      embeddingMs: query ? embeddingMs : undefined,
      queryMs,
      totalMs: Date.now() - startTime,
    },
  };

  // Log summary
  const totalMatches = Object.values(allResults).reduce((sum, matches) => sum + (matches?.length || 0), 0);
  logger.info(
    `✓ [${requestId}] Retrieval complete: ${totalMatches} matches (cache: ${cacheHits.length} hit, ${cacheMisses.length} miss, ${Object.keys(errorsByNamespace).length} error) in ${response.timings?.totalMs}ms`
  );

  return response;
}
