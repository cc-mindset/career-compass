import { Pinecone } from '@pinecone-database/pinecone';
import { logger } from '../utils/logger.js';

/**
 * Pinecone Client Singleton
 * Handles all vector database operations
 */
class PineconeClient {
  constructor() {
    this.client = null;
    this.index = null;
    this.indexName = 'career-insights';
  }

  /**
   * Initialize Pinecone client
   */
  async initialize() {
    if (this.client) return this.client;

    try {
      this.client = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });

      this.index = this.client.index(this.indexName);
      logger.info(`✓ Pinecone initialized with index: ${this.indexName}`);
      
      return this.client;
    } catch (error) {
      logger.error('Failed to initialize Pinecone:', error);
      throw error;
    }
  }

  /**
   * Query a specific namespace in Pinecone
   * @param {string} namespace - Namespace to query (news-data, bls-data, reports-data, user-data)
   * @param {string} queryText - Text query for semantic search
   * @param {number} topK - Number of results to return
   * @returns {Promise<Array>} Query results with metadata
   */
  async queryNamespace(namespace, queryText, topK = 10) {
    try {
      if (!this.index) await this.initialize();

      logger.debug(`🔍 Querying namespace: ${namespace} with query: "${queryText}"`);

      const ns = this.index.namespace(namespace);
      
      // For text queries, we'll need to get embeddings from OpenAI first
      // This is handled by the RAG service layer
      throw new Error('Use queryNamespaceWithVector for actual queries');
    } catch (error) {
      logger.error(`Error querying namespace ${namespace}:`, error);
      throw error;
    }
  }

  /**
   * Query namespace with a pre-computed vector
   * @param {string} namespace - Namespace to query
   * @param {Array<number>} vector - Pre-computed embedding vector
   * @param {number} topK - Number of results to return
   * @returns {Promise<Object>} Query results with metadata
   */
  async queryNamespaceWithVector(namespace, vector, topK = 10) {
    try {
      if (!this.index) await this.initialize();

      logger.debug(`🔍 Querying namespace: ${namespace} (topK=${topK})`);

      const ns = this.index.namespace(namespace);
      const results = await ns.query({
        vector,
        topK,
        includeMetadata: true,
      });

      logger.info(`✓ Retrieved ${results.matches?.length || 0} results from ${namespace}`);
      
      return results;
    } catch (error) {
      logger.error(`Error querying namespace ${namespace}:`, error);
      throw error;
    }
  }

  /**
   * Query multiple namespaces in parallel
   * @param {Array<Object>} queries - Array of {namespace, vector, topK}
   * @returns {Promise<Object>} Results organized by namespace
   */
  async queryMultipleNamespaces(queries) {
    try {
      if (!this.index) await this.initialize();

      logger.debug(`🔍 Querying ${queries.length} namespaces in parallel`);

      const promises = queries.map(({ namespace, vector, topK }) =>
        this.queryNamespaceWithVector(namespace, vector, topK)
          .then(results => ({ namespace, results }))
          .catch(error => ({ namespace, error }))
      );

      const allResults = await Promise.all(promises);

      // Organize results by namespace
      const organized = {};
      allResults.forEach(({ namespace, results, error }) => {
        if (error) {
          logger.error(`Failed to query ${namespace}:`, error);
          organized[namespace] = { matches: [], error: error.message };
        } else {
          organized[namespace] = results;
        }
      });

      return organized;
    } catch (error) {
      logger.error('Error querying multiple namespaces:', error);
      throw error;
    }
  }

  /**
   * Get stats for the index
   */
  async getIndexStats() {
    try {
      if (!this.index) await this.initialize();
      
      const stats = await this.index.describeIndexStats();
      logger.info('Pinecone index stats:', stats);
      
      return stats;
    } catch (error) {
      logger.error('Error getting index stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pineconeClient = new PineconeClient();
