import { pineconeClient } from '../lib/pinecone.js';
import { openaiClient } from '../lib/openai.js';
import { cache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

interface RetrieveOptions {
  namespaces?: string[];
  topKPerNamespace?: Record<string, number>;
  useCache?: boolean;
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

interface RAGOptions {
  namespaces?: string[];
  topKPerNamespace?: Record<string, number>;
  responseFormat?: 'json' | 'text';
  useCache?: boolean;
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
    logger.info(`🔍 Retrieving context for: "${queryText}"`, 'RAG');

    // Check cache first
    const cacheKey = cache.generateKey('context', queryText, ...namespaces);
    if (useCache) {
      const cached = cache.get<Context>(cacheKey);
      if (cached) {
        logger.info('✓ Using cached context');
        return cached;
      }
    }

    // Step 1: Create embedding for the query
    const queryVector = await openaiClient.createEmbedding(queryText) as number[];

    // Step 2: Query all namespaces in parallel
    const queries = namespaces.map(namespace => ({
      namespace,
      vector: queryVector,
      topK: topKPerNamespace[namespace] || 10,
    }));

    const results = await pineconeClient.queryMultipleNamespaces(queries);

    // Step 3: Format and organize the context
    const context: Context = {
      query: queryText,
      namespaces: {},
      combinedText: '',
      sources: [],
    };

    for (const namespace of namespaces) {
      const nsResults = results[namespace];
      
      if (!nsResults || !nsResults.matches) {
        context.namespaces[namespace] = { matches: [], count: 0 };
        continue;
      }

      // Extract text from metadata
      const matches: Match[] = nsResults.matches
        .filter(match => match.metadata?.text)
        .map(match => ({
          text: match.metadata!.text as string,
          score: match.score,
          metadata: match.metadata,
        }));

      context.namespaces[namespace] = {
        matches,
        count: matches.length,
      };

      // Add to combined text
      matches.forEach((match, idx) => {
        context.sources.push({
          namespace,
          index: idx,
          score: match.score,
        });
      });
    }

    // Cache the results
    if (useCache) {
      const ttlDefaults = {
        marketInsights: 24 * 60 * 60 * 1000,
        pineconeResults: 60 * 60 * 1000,
        embeddings: 7 * 24 * 60 * 60 * 1000,
      };
      cache.set(cacheKey, context, ttlDefaults.pineconeResults);
    }

    logger.info(`✓ Retrieved context from ${namespaces.length} namespaces`);
    
    return context;
  } catch (error) {
    logger.error('Error retrieving context:', error);
    throw error;
  }
}

/**
 * Format context into a readable text for LLM consumption
 * @param {Object} context - Context object from retrieveContext
 * @returns {string} Formatted context text
 */
export function formatContextForLLM(context: Context): string {
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
  } = options;

  try {
    logger.info(`🤖 Generating RAG response for: "${query}"`, 'RAG');

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

    // Step 2: Format context for LLM
    const formattedContext = formatContextForLLM(context);

    // Step 3: Generate response with retry logic
    let response: Record<string, unknown> | string;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (responseFormat === 'json') {
          const userPrompt = `${formattedContext}\n\n${query}`;
          response = await openaiClient.generateJSONCompletion(systemPrompt, userPrompt, {
            max_tokens: 16000,
            temperature: 0.7,
          });
          
          // Validate response has data
          if (!response || typeof response !== 'object') {
            throw new Error('Invalid JSON response: not an object');
          }
          
          logger.info('📊 Generated JSON response with keys:', Object.keys(response).join(', '));
          break; // Success, exit retry loop
        } else {
          const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${formattedContext}\n\n${query}` },
          ];
          response = await openaiClient.generateCompletion(messages);
          break; // Success, exit retry loop
        }
      } catch (error) {
        const err = error as Error;
        logger.warn(`⚠️  RAG generation attempt ${attempt}/${maxRetries} failed:`, err.message);
        
        if (attempt === maxRetries) {
          logger.error('❌ All retry attempts exhausted');
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.info(`⏳ Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Cache the response
    if (useCache) {
      const ttlDefaults = {
        marketInsights: 24 * 60 * 60 * 1000,
        pineconeResults: 60 * 60 * 1000,
        embeddings: 7 * 24 * 60 * 60 * 1000,
      };
      cache.set(cacheKey, response, ttlDefaults.marketInsights);
    }

    logger.info('✓ Generated RAG response');
    
    return response;
  } catch (error) {
    logger.error('Error in RAG generation:', error);
    throw error;
  }
}
