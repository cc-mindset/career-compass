import pLimit from 'p-limit';
import { pineconeClient } from '../lib/pinecone.js';
import { openaiClient, RateLimitError, QuotaExceededError, ConnectionTimeoutError } from '../lib/openai.js';
import { cache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';
import { cacheLlmResponseToDb, getUniqueDbCacheKeyForLlmResponse } from './dbCacheService.js';

interface RetrieveOptions {
  namespaces?: string[];
  topKPerNamespace?: Record<string, number>;
  useCache?: boolean;
  useRetrievalCache?: boolean; // explicit override for Pinecone/embedding cache only
}

interface MatchMetadata {
  text?: string;
  [key: string]: unknown;
}

interface Match {
  text: string;
  score?: number;
  metadata?: MatchMetadata;
}

interface NamespaceContext {
  matches: Match[];
  count: number;
}

interface Source {
  namespace: string;
  index: number;
  score?: number;
}

interface Context {
  query: string;
  namespaces: Record<string, NamespaceContext>;
  combinedText: string;
  sources: Source[];
}

type ContextFormatter = (context: Context) => string;

interface RAGOptions {
  namespaces?: string[];
  topKPerNamespace?: Record<string, number>;
  responseFormat?: 'json' | 'text';
  useCache?: boolean;           // controls LLM generation result caching
  useRetrievalCache?: boolean;  // controls Pinecone/embedding caching (defaults to useCache)
  contextFormatter?: ContextFormatter;
  cacheTTL?: number;
  retrievalQuery?: string;
}

/**
 * RAG Service - Retrieval-Augmented Generation
 * Handles retrieval from Pinecone and generation with OpenAI
 */

/**
 * Retrieve relevant context from Pinecone for a given query
 * @param {string} queryText - The text query
 * @param {Object} options - Retrieval options
 * @returns {Promise<Object>} Retrieved context organized by namespace
 */
export async function retrieveContext(queryText: string, options: RetrieveOptions = {}): Promise<Context> {
  const {
    namespaces = ['news-data', 'bls-data', 'reports-data'],
    topKPerNamespace = { 'news-data': 10, 'bls-data': 10, 'reports-data': 8 },
    useCache = true,
  } = options;

  try {
    //logger.info(`🔍 Retrieving context for: "${queryText}"`, 'RAG');

    // Step 1: Check cache for each namespace individually
    const cachedNamespaces: Record<string, NamespaceContext> = {};
    const namespacesToQuery: string[] = [];

    if (useCache) {
      for (const namespace of namespaces) {
        const nsCacheKey = cache.generateKey('context-ns', queryText, namespace);
        const cached = cache.get<NamespaceContext>(nsCacheKey);
        if (cached) {
          cachedNamespaces[namespace] = cached;
        } else {
          namespacesToQuery.push(namespace);
        }
      }

      if (Object.keys(cachedNamespaces).length > 0) {
        logger.info(`✓ Cache hit for ${Object.keys(cachedNamespaces).length}/${namespaces.length} namespaces`);
      }
    } else {
      namespacesToQuery.push(...namespaces);
    }

    // Step 2: Create embedding only if we need to query
    let queryVector: number[] | undefined;
    if (namespacesToQuery.length > 0) {
      queryVector = await openaiClient.createEmbedding(queryText) as number[];
    }

    // Step 3: Query uncached namespaces from Pinecone
    let freshResults: Record<string, { matches?: Array<{ id: string; score?: number; metadata?: Record<string, unknown> }> }> = {};
    if (namespacesToQuery.length > 0 && queryVector) {
      logger.info(`🔍 Querying ${namespacesToQuery.length} uncached namespaces from Pinecone`);

      const queries = namespacesToQuery.map(namespace => ({
        namespace,
        vector: queryVector,
        topK: topKPerNamespace[namespace] || 10,
      }));

      freshResults = await pineconeClient.queryMultipleNamespaces(queries);
    }

    // Step 4: Build context from cached + fresh results
    const context: Context = {
      query: queryText,
      namespaces: {},
      combinedText: '',
      sources: [],
    };

    for (const namespace of namespaces) {
      // Use cached if available, otherwise process fresh results
      if (cachedNamespaces[namespace]) {
        context.namespaces[namespace] = cachedNamespaces[namespace];
      } else {
        const nsResults = freshResults[namespace];

        if (!nsResults || !nsResults.matches) {
          context.namespaces[namespace] = { matches: [], count: 0 };
        } else {
          // Extract text from metadata
          const matches: Match[] = nsResults.matches
            .filter(match => match.metadata?.text)
            .map(match => ({
              text: match.metadata!.text as string,
              score: match.score,
              metadata: match.metadata,
            }));

          const namespaceContext: NamespaceContext = {
            matches,
            count: matches.length,
          };

          context.namespaces[namespace] = namespaceContext;

          // Cache this namespace result individually
          if (useCache) {
            const nsCacheKey = cache.generateKey('context-ns', queryText, namespace);
            cache.set(nsCacheKey, namespaceContext, 60 * 60 * 1000); // 1 hour TTL
          }
        }
      }

      // Add to sources list
      const nsMatches = context.namespaces[namespace].matches;
      nsMatches.forEach((match, idx) => {
        context.sources.push({
          namespace,
          index: idx,
          score: match.score,
        });
      });
    }

    logger.info(`✓ Retrieved context from ${namespaces.length} namespaces (${Object.keys(cachedNamespaces).length} cached, ${namespacesToQuery.length} fresh)`);

    return context;
  } catch (error) {
    logger.error('Error retrieving context:', error);
    throw error;
  }
}

/**
 * Generic context formatter - simple concatenation of all matches
 * @param {Object} context - Context object from retrieveContext
 * @returns {string} Formatted context text
 */
export function formatGenericContext(context: Context): string {
  const sections: string[] = [];

  Object.entries(context.namespaces).forEach(([namespace, data]) => {
    if (data.matches.length > 0) {
      sections.push(`=== ${namespace.toUpperCase()} ===\n`);
      data.matches.forEach((match, idx) => {
        sections.push(`[${idx + 1}] ${match.text}`);
      });
    }
  });

  return sections.join('\n\n');
}

/**
 * Market Insights specific context formatter
 * @param {Object} context - Context object from retrieveContext
 * @returns {string} Formatted context text for market insights
 */
export function formatMarketInsightsContext(context: Context): string {
  const sections: string[] = [];

  // Add explicit instruction
  sections.push('=== AVAILABLE DATA SOURCES (ONLY USE THESE) ===\n');

  if (context.namespaces['news-data']?.matches?.length) {
    sections.push('=== RECENT NEWS & REPORTS ===');
    sections.push('(Cite as: "News article" or "Market news report")\n');
    context.namespaces['news-data'].matches.forEach((match, idx) => {
      sections.push(`[News ${idx + 1}] ${match.text.substring(0, 500)}...`);
    });
  }

  if (context.namespaces['bls-data']?.matches?.length) {
    sections.push('\n=== BLS EMPLOYMENT DATA ===');
    sections.push('(Cite as: "U.S. Bureau of Labor Statistics" or "BLS Employment Data")\n');
    context.namespaces['bls-data'].matches.forEach((match, idx) => {
      sections.push(`[BLS ${idx + 1}] ${match.text.substring(0, 400)}...`);
    });
  }

  if (context.namespaces['reports-data']?.matches?.length) {
    sections.push('\n=== MARKET INSIGHT REPORTS ===');
    sections.push('(Cite as: "Market research report" or "Industry analysis")\n');
    context.namespaces['reports-data'].matches.forEach((match, idx) => {
      sections.push(`[Market ${idx + 1}] ${match.text.substring(0, 500)}...`);
    });
  }

  sections.push('\n=== END OF AVAILABLE SOURCES ===');
  sections.push('IMPORTANT: Your report_sources array must ONLY include sources from the three categories above.');
  sections.push('DO NOT add: Career centers, chambers of commerce, job boards (Indeed/Upwork), or meetup groups unless they appear in the content above.');

  return sections.join('\n\n');
}

/**
 * Helper: Generate single response with retry logic
 * DOES NOT retry on rate limit or quota errors - these should be handled at queue level
 */
async function generateSingleResponse(
  systemPrompt: string,
  formattedContext: string,
  query: string,
  responseFormat: 'json' | 'text',
  maxRetries: number = 3
): Promise<Record<string, unknown> | string> {
  let response: Record<string, unknown> | string;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (responseFormat === 'json') {
        const userPrompt = `${formattedContext}\n\n${query}`;
        response = await openaiClient.generateJSONCompletion(systemPrompt, userPrompt, {
          max_tokens: 16000,
          temperature: 0.7,
        });

        if (!response || typeof response !== 'object') {
          throw new Error('Invalid JSON response: not an object');
        }

        logger.info('📊 Generated JSON response with keys:', Object.keys(response).join(', '));
        return response;
      } else {
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${formattedContext}\n\n${query}` },
        ];
        response = await openaiClient.generateCompletion(messages as any);
        return response;
      }
    } catch (error) {
      // Don't retry on rate limit, quota, or timeout errors — propagate immediately
      if (error instanceof RateLimitError || error instanceof QuotaExceededError || error instanceof ConnectionTimeoutError) {
        logger.error(`🚫 ${error.name}: ${error.message} - Not retrying`);
        throw error;
      }

      const err = error as Error;
      logger.warn(`⚠️  Generation attempt ${attempt}/${maxRetries} failed:`, err.message);

      if (attempt === maxRetries) {
        logger.error('❌ All retry attempts exhausted');
        throw error;
      }

      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      logger.info(`⏳ Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw new Error('Failed to generate response');
}

interface MultiPromptRequest {
  label: string;
  query: string;
  cacheKeySuffix: string;
}

type SectionCallback = (section: string, result: Record<string, unknown> | string | null, error?: string) => void;

interface MultiRAGOptions extends RAGOptions {
  onSectionComplete?: SectionCallback;
}

export async function generateMultipleWithSharedContext(
  systemPrompt: string,
  prompts: MultiPromptRequest[],
  options: MultiRAGOptions = {}
): Promise<Record<string, Record<string, unknown> | string>> {
  const {
    namespaces = ['news-data', 'bls-data', 'reports-data'],
    topKPerNamespace = { 'news-data': 12, 'bls-data': 15, 'reports-data': 10 },
    responseFormat = 'json',
    useCache = true,
    useRetrievalCache,        // falls back to useCache if not explicitly set
    contextFormatter = formatGenericContext,
    cacheTTL = 24 * 60 * 60 * 1000,
    retrievalQuery,
    onSectionComplete,
  } = options;

  // Pinecone/embedding cache can be controlled independently of LLM generation cache
  const pineconeCache = useRetrievalCache ?? useCache;

  try {
    logger.info(`🤖 Generating ${prompts.length} responses from shared context`);

    // Step 1: Retrieve context ONCE
    const contextCacheKey = cache.generateKey('context-shared', ...namespaces, ...prompts.map(p => p.label));
    let context: Context;
    if (pineconeCache) {
      const cachedContext = cache.get<Context>(contextCacheKey);
      if (cachedContext) {
        logger.info(`✓ Using cached shared context for ${prompts.length} prompts`);
        context = cachedContext;
      } else {
        logger.info('📚 Retrieving shared context from Pinecone...');
        const queryText = retrievalQuery || prompts[0]?.query || 'general query';
        context = await retrieveContext(queryText, { namespaces, topKPerNamespace, useCache: pineconeCache });
        cache.set(contextCacheKey, context, 60 * 60 * 1000); // 1 hour
      }
    } else {
      const queryText = retrievalQuery || prompts[0]?.query || 'general query';
      context = await retrieveContext(queryText, { namespaces, topKPerNamespace, useCache: pineconeCache });
    }

    // Step 2: Format context ONCE using provided formatter
    const formattedContext = contextFormatter(context);
    logger.info('✓ Context formatted for LLM');

    // Step 3: Generate responses in PARALLEL with concurrency cap
    // Max concurrent OpenAI calls per job is capped via env var (default 3)
    const concurrency = parseInt(process.env.OPENAI_MAX_CONCURRENT || '3');
    const limit = pLimit(concurrency);
    logger.info(`🔀 Section concurrency: ${concurrency} (${prompts.length} sections)`);

    const results: Record<string, Record<string, unknown> | string> = {};
    const generationPromises = prompts.map(async (prompt) => limit(async () => {
      try {
        const cacheKey = cache.generateKey('rag', prompt.cacheKeySuffix);
        const dbCacheKey = getUniqueDbCacheKeyForLlmResponse('rag', prompt.cacheKeySuffix);
        if (useCache) {
          const cached = cache.get<Record<string, unknown> | string>(cacheKey);
          if (cached) {
            logger.info(`✓ Cached: ${prompt.label}`);
            results[prompt.label] = cached;
            if (onSectionComplete) onSectionComplete(prompt.label, cached);
            return;
          }
        }

        logger.info(`🔄 Generating: ${prompt.label}`);
        const response = await generateSingleResponse(
          systemPrompt,
          formattedContext,
          prompt.query,
          responseFormat as 'json' | 'text',
          3
        );

        if (useCache) {
          cacheLlmResponseToDb(dbCacheKey, typeof response === 'string' ? { text: response } : response, prompt.label);
        }

        results[prompt.label] = response;
        logger.info(`✓ Completed: ${prompt.label}`);
        if (onSectionComplete) onSectionComplete(prompt.label, response);
      } catch (error) {
        const err = error as Error;
        logger.error(`❌ Failed: ${prompt.label} - ${err.message}`);
        if (onSectionComplete) onSectionComplete(prompt.label, null, err.message);
        throw error;
      }
    }));

    await Promise.allSettled(generationPromises);
    logger.info(`✓ All ${prompts.length} sections processed`);

    return results;
  } catch (error) {
    logger.error('Error in multi-prompt RAG generation:', error);
    throw error;
  }
}

/**
 * Generate response using RAG pattern
 * @param {string} query - User query
 * @param {string} systemPrompt - System prompt for LLM
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated response
 */
export async function generateWithRAG(query: string, systemPrompt: string, options: RAGOptions = {}): Promise<Record<string, unknown> | string> {
  const {
    namespaces = ['news-data', 'bls-data', 'reports-data'],
    topKPerNamespace = { 'news-data': 10, 'bls-data': 10, 'reports-data': 8 },
    responseFormat = 'json',
    useCache = true,
    contextFormatter = formatGenericContext,
    cacheTTL = 60 * 60 * 1000,
  } = options;

  try {
    //logger.info(`🤖 Generating RAG response for: "${query}"`, 'RAG');

    // Check cache
    const cacheKey = cache.generateKey('rag', query, systemPrompt.substring(0, 50));
    if (useCache) {
      const cached = cache.get<Record<string, unknown> | string>(cacheKey);
      if (cached) {
        logger.info('✓ Using cached RAG response');
        return cached;
      }
    }

    // Step 1: Retrieve context
    const context = await retrieveContext(query, { namespaces, topKPerNamespace, useCache });

    // Step 2: Format context using provided formatter
    const formattedContext = contextFormatter(context);

    // Step 3: Generate response with retry logic
    const response = await generateSingleResponse(
      systemPrompt,
      formattedContext,
      query,
      responseFormat as 'json' | 'text',
      3
    );

    // Cache the response
    if (useCache) {
      cache.set(cacheKey, response, cacheTTL);
    }

    logger.info('✓ Generated RAG response');

    return response;
  } catch (error) {
    logger.error('Error in RAG generation:', error);
    throw error;
  }
}