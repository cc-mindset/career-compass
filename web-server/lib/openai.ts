import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { getRedisClient, isRedisAvailable } from './redis.js';

// ─────────────────────────────────────────────────────────────────────────────
// TokenBudget — Proactive sliding-window RPM/TPM guard
// Checks Redis counters BEFORE every OpenAI call and blocks preemptively
// at a configurable safety threshold (default 80%) so we never hit a 429.
//
// Env vars:
//   OPENAI_RPM_LIMIT        — your plan's RPM ceiling (default: 500)
//   OPENAI_TPM_LIMIT        — your plan's TPM ceiling (default: 150000)
//   OPENAI_SAFETY_RATIO     — fraction of limit before blocking (default: 0.8)
// ─────────────────────────────────────────────────────────────────────────────
class TokenBudget {
  private get rpmLimit()    { return parseInt(process.env.OPENAI_RPM_LIMIT    || '500');    }
  private get tpmLimit()    { return parseInt(process.env.OPENAI_TPM_LIMIT    || '150000'); }
  private get safetyRatio() { return parseFloat(process.env.OPENAI_SAFETY_RATIO || '0.8'); }

  /** Redis key for current 1-minute window */
  private windowKey(prefix: string): string {
    const minute = Math.floor(Date.now() / 60000);
    return `${prefix}:${minute}`;
  }

  /**
   * Estimate tokens from messages (input chars / 4 + max_tokens buffer).
   * Deliberately over-estimates — better to block early than hit a 429.
   */
  estimateTokens(messages: { content?: string | unknown }[], maxTokens: number): number {
    const inputChars = messages.reduce((sum, m) =>
      sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
    return Math.ceil(inputChars / 4) + maxTokens;
  }

  /**
   * Check current window usage and throw RateLimitError proactively if near limit.
   * Then increment the RPM counter. Call BEFORE every OpenAI API call.
   */
  async checkAndIncrementRPM(): Promise<void> {
    if (!isRedisAvailable()) return; // graceful degradation if Redis is down

    try {
      const redis    = getRedisClient();
      const rpmKey   = this.windowKey('openai:rpm');
      const rpmSafe  = Math.floor(this.rpmLimit * this.safetyRatio);

      const current  = parseInt((await redis.get(rpmKey)) || '0');

      if (current >= rpmSafe) {
        const retryIn = 60 - (Date.now() % 60000) / 1000;
        logger.warn(`🚦 Proactive RPM block: ${current}/${this.rpmLimit} (safe limit ${rpmSafe}), retry in ${retryIn.toFixed(0)}s`);
        throw new RateLimitError(
          `Proactive rate limit: ${current} requests this minute (limit ${rpmSafe})`,
          Math.ceil(retryIn)
        );
      }

      // Increment with TTL covering window boundary
      await redis.incr(rpmKey);
      await redis.expire(rpmKey, 90);
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      logger.warn('TokenBudget RPM check failed (Redis error) — skipping:', err);
    }
  }

  /**
   * Check TPM budget before a call, then pre-charge estimated tokens.
   * Actual over/undershoot is reconciled in recordActualTokens().
   */
  async checkAndIncrementTPM(estimated: number): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const redis    = getRedisClient();
      const tpmKey   = this.windowKey('openai:tpm');
      const tpmSafe  = Math.floor(this.tpmLimit * this.safetyRatio);

      const current  = parseInt((await redis.get(tpmKey)) || '0');

      if (current + estimated >= tpmSafe) {
        const retryIn = 60 - (Date.now() % 60000) / 1000;
        logger.warn(`🚦 Proactive TPM block: ${current} used + ${estimated} estimated >= ${tpmSafe} safe limit`);
        throw new RateLimitError(
          `Proactive token limit: ${current} tokens used this minute (safe limit ${tpmSafe})`,
          Math.ceil(retryIn)
        );
      }

      await redis.incrBy(tpmKey, estimated);
      await redis.expire(tpmKey, 90);
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      logger.warn('TokenBudget TPM check failed (Redis error) — skipping:', err);
    }
  }

  /** Reconcile actual token usage after a successful call */
  async recordActualTokens(actual: number, estimated: number): Promise<void> {
    if (!isRedisAvailable()) return;
    const diff = actual - estimated;
    if (diff === 0) return;
    try {
      const redis  = getRedisClient();
      const tpmKey = this.windowKey('openai:tpm');
      await redis.incrBy(tpmKey, diff); // negative diff reduces the window count
    } catch { /* non-critical */ }
  }

  /** Log current window usage — useful for debugging */
  async getUsage(): Promise<{ rpm: number; tpm: number }> {
    if (!isRedisAvailable()) return { rpm: 0, tpm: 0 };
    try {
      const redis  = getRedisClient();
      const [rpm, tpm] = await Promise.all([
        redis.get(this.windowKey('openai:rpm')),
        redis.get(this.windowKey('openai:tpm')),
      ]);
      return { rpm: parseInt(rpm || '0'), tpm: parseInt(tpm || '0') };
    } catch { return { rpm: 0, tpm: 0 }; }
  }
}

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

export const tokenBudget = new TokenBudget();

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

      // ── Proactive budget check before every OpenAI call ──
      const estimatedTokens = tokenBudget.estimateTokens(messages as { content?: string }[], max_tokens);
      await tokenBudget.checkAndIncrementRPM();
      await tokenBudget.checkAndIncrementTPM(estimatedTokens);

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
      // Reconcile actual vs estimated tokens in the TPM window
      await tokenBudget.recordActualTokens(tokensUsed, estimatedTokens);
      
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
