import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

/**
 * OpenAI Client Singleton
 * Handles all LLM and embedding operations
 */
class OpenAIClient {
  constructor() {
    this.client = null;
    this.embeddingModel = 'text-embedding-3-small';
    this.chatModel = 'gpt-4o';
  }

  /**
   * Initialize OpenAI client
   */
  initialize() {
    if (this.client) return this.client;

    try {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      logger.info('✓ OpenAI client initialized');
      return this.client;
    } catch (error) {
      logger.error('Failed to initialize OpenAI:', error);
      throw error;
    }
  }

  /**
   * Create embeddings for text
   * @param {string|Array<string>} input - Text or array of texts to embed
   * @returns {Promise<Array<number>|Array<Array<number>>>} Embedding vector(s)
   */
  async createEmbedding(input) {
    try {
      if (!this.client) this.initialize();

      const isArray = Array.isArray(input);
      logger.debug(`🔢 Creating embeddings for ${isArray ? input.length : 1} text(s)`);

      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input,
      });

      const embeddings = response.data.map(item => item.embedding);
      
      logger.info(`✓ Generated query embedding(s) for Pinecone search (${embeddings.length} vector(s))`);
      
      return isArray ? embeddings : embeddings[0];
    } catch (error) {
      logger.error('Error creating embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate chat completion
   * @param {Array<Object>} messages - Array of message objects
   * @param {Object} options - Additional options (temperature, max_tokens, etc.)
   * @returns {Promise<string>} Generated response text
   */
  async generateCompletion(messages, options = {}) {
    try {
      if (!this.client) this.initialize();

      const {
        temperature = 0.7,
        max_tokens = 16000,  // Increased for comprehensive JSON responses
        model = this.chatModel,
        response_format = null,
      } = options;

      logger.debug(`💬 Generating completion with ${model} (${messages.length} messages)`);

      const params = {
        model,
        messages,
        temperature,
        max_tokens,
      };

      if (response_format) {
        params.response_format = response_format;
      }

      const completion = await this.client.chat.completions.create(params);

      const responseText = completion.choices[0].message.content;
      const tokensUsed = completion.usage?.total_tokens || 0;

      logger.info(`✓ Generated completion (${tokensUsed} tokens)`);
      
      return responseText;
    } catch (error) {
      logger.error('Error generating completion:', error);
      throw error;
    }
  }

  /**
   * Generate structured JSON completion
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Parsed JSON response
   */
  async generateJSONCompletion(systemPrompt, userPrompt, options = {}) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // Force JSON mode for structured output
      const jsonOptions = {
        ...options,
        response_format: { type: 'json_object' },
      };

      const responseText = await this.generateCompletion(messages, jsonOptions);

      // Clean markdown code blocks if present
      const cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      try {
        const parsed = JSON.parse(cleanedText);
        logger.info('✓ Successfully parsed JSON response');
        return parsed;
      } catch (parseError) {
        logger.error('JSON parse error. Response text (first 500 chars):', cleanedText.substring(0, 500));
        logger.error('Response text (last 500 chars):', cleanedText.substring(Math.max(0, cleanedText.length - 500)));
        logger.error('Parse error details:', parseError.message);
        
        // Try to fix common JSON issues
        try {
          // Attempt to fix unescaped newlines and quotes
          const fixedText = cleanedText
            .replace(/[\n\r]/g, ' ')  // Replace newlines with spaces
            .replace(/([^\\])"/g, '$1\\"')  // Escape unescaped quotes (basic attempt)
            .replace(/\t/g, ' ');  // Replace tabs
          
          const fixedParsed = JSON.parse(fixedText);
          logger.warn('⚠️  JSON fixed and parsed successfully after cleanup');
          return fixedParsed;
        } catch (fixError) {
          logger.error('❌ Unable to fix JSON. Original error:', parseError.message);
          throw parseError;
        }
      }
    } catch (error) {
      logger.error('Error generating JSON completion:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const openaiClient = new OpenAIClient();
