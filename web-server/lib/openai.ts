import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

/**
 * Custom error class for rate limit errors
 */
export class RateLimitError extends Error {
  constructor(message: string, public retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Custom error class for quota exceeded errors
 */
export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

interface CompletionOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
  response_format?: { type: 'json_object' } | null;
}

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/**
 * OpenAI Client Singleton
 * Handles all LLM and embedding operations
 */
class OpenAIClient {
  private client: OpenAI | null;
  private readonly embeddingModel: string;
  private readonly chatModel: string;

  constructor() {
    this.client = null;
    this.embeddingModel = 'text-embedding-3-small';
    this.chatModel = 'gpt-4o';
  }

  /**
   * Initialize OpenAI client
   */
  initialize(): OpenAI {
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
  async createEmbedding(input: string | string[]): Promise<number[] | number[][]> {
    try {
      if (!this.client) this.initialize();

      const isArray = Array.isArray(input);
      logger.debug(`🔢 Creating embeddings for ${isArray ? input.length : 1} text(s)`);

      const response = await this.client!.embeddings.create({
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
  async generateCompletion(messages: Message[], options: CompletionOptions = {}): Promise<string> {
    try {
      if (!this.client) this.initialize();

      const {
        temperature = 0.7,
        max_tokens = 16000,  // Increased for comprehensive JSON responses
        model = this.chatModel,
        response_format = null,
      } = options;

      logger.debug(`💬 Generating completion with ${model} (${messages.length} messages)`);

      const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model,
        messages,
        temperature,
        max_tokens,
      };

      if (response_format) {
        params.response_format = response_format;
      }

      const completion = await this.client!.chat.completions.create(params);

      const responseText = completion.choices[0].message.content;
      const tokensUsed = completion.usage?.total_tokens || 0;

      if (!responseText) {
        throw new Error('No response text from OpenAI');
      }

      logger.info(`✓ Generated completion (${tokensUsed} tokens)`);
      
      return responseText;
    } catch (error: any) {
      // Check for rate limit or quota errors
      if (error?.status === 429) {
        const retryAfter = error?.headers?.['retry-after'] ? parseInt(error.headers['retry-after']) : undefined;
        if (error?.message?.toLowerCase().includes('quota')) {
          logger.error('❌ QUOTA EXCEEDED - OpenAI API quota limit reached');
          throw new QuotaExceededError(error.message || 'OpenAI quota exceeded');
        }
        logger.error(`⚠️  RATE LIMIT - Too many requests${retryAfter ? `, retry after ${retryAfter}s` : ''}`);
        throw new RateLimitError(error.message || 'Rate limit exceeded', retryAfter);
      }
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
  async generateJSONCompletion(systemPrompt: string, userPrompt: string, options: CompletionOptions = {}): Promise<Record<string, unknown>> {
    try {
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // Force JSON mode for structured output
      const jsonOptions: CompletionOptions = {
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
        const parsed = JSON.parse(cleanedText) as Record<string, unknown>;
        logger.info('✓ Successfully parsed JSON response');
        return parsed;
      } catch (parseError) {
        const parseErr = parseError as Error;
        logger.error('JSON parse error. Response text (first 500 chars):', cleanedText.substring(0, 500));
        logger.error('Response text (last 500 chars):', cleanedText.substring(Math.max(0, cleanedText.length - 500)));
        logger.error('Parse error details:', parseErr.message);
        
        // Try to fix common JSON issues
        try {
          // Attempt to fix unescaped newlines and quotes
          const fixedText = cleanedText
            .replace(/[\n\r]/g, ' ')  // Replace newlines with spaces
            .replace(/([^\\])"/g, '$1\\"')  // Escape unescaped quotes (basic attempt)
            .replace(/\t/g, ' ');  // Replace tabs
          
          const fixedParsed = JSON.parse(fixedText) as Record<string, unknown>;
          logger.warn('⚠️  JSON fixed and parsed successfully after cleanup');
          return fixedParsed;
        } catch (fixError) {
          logger.error('❌ Unable to fix JSON. Original error:', parseErr.message);
          throw parseError;
        }
      }
    } catch (error: any) {
      // Re-throw rate limit and quota errors without modification
      if (error instanceof RateLimitError || error instanceof QuotaExceededError) {
        throw error;
      }
      logger.error('Error generating JSON completion:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const openaiClient = new OpenAIClient();
