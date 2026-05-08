import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { getRedisClient, isRedisAvailable } from './redis.js';

// SWAP: track monthly quota usage in DB so it survives restarts
let monthlyTokensUsed = 0;
let monthlyResetMonth = new Date().getMonth();

// TokenBudget — proactive sliding-window RPM/TPM guard (checks Redis before every OpenAI call)
// Env vars: OPENAI_RPM_LIMIT, OPENAI_TPM_LIMIT, OPENAI_SAFETY_RATIO, OPENAI_MONTHLY_TOKEN_LIMIT
class TokenBudget {
  private get rpmLimit()          { return parseInt(process.env.OPENAI_RPM_LIMIT           || '500');       }
  private get tpmLimit()          { return parseInt(process.env.OPENAI_TPM_LIMIT           || '150000');    }
  private get safetyRatio()       { return parseFloat(process.env.OPENAI_SAFETY_RATIO      || '0.8');       }
  private get monthlyTokenLimit() { return parseInt(process.env.OPENAI_MONTHLY_TOKEN_LIMIT || '0');        }

  logLimits(): void {
    const monthly = this.monthlyTokenLimit ? `${this.monthlyTokenLimit} (safe: ${Math.floor(this.monthlyTokenLimit * this.safetyRatio)})` : 'unlimited';
    logger.info(`🔢 TokenBudget limits — RPM: ${this.rpmLimit} (safe: ${Math.floor(this.rpmLimit * this.safetyRatio)}), TPM: ${this.tpmLimit} (safe: ${Math.floor(this.tpmLimit * this.safetyRatio)}), Monthly: ${monthly}, safety: ${this.safetyRatio}`);
  }

  private windowKey(prefix: string): string {
    const minute = Math.floor(Date.now() / 60000);
    return `${prefix}:${minute}`;
  }

  // Over-estimates intentionally — better to block early than hit a 429
  estimateTokens(messages: { content?: string | unknown }[], maxTokens: number): number {
    const inputChars = messages.reduce((sum, m) =>
      sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
    return Math.ceil(inputChars / 4) + maxTokens;
  }

  async checkAndIncrementRPM(): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const redis   = getRedisClient();
      const rpmKey  = this.windowKey('openai:rpm');
      const rpmSafe = Math.floor(this.rpmLimit * this.safetyRatio);

      // Atomic INCR first — each concurrent caller gets a unique slot number
      const newCount = await redis.incr(rpmKey);
      await redis.expire(rpmKey, 90);

      if (newCount > rpmSafe) {
        await redis.decr(rpmKey); // roll back the slot
        const retryIn = 60 - (Date.now() % 60000) / 1000;
        logger.warn(`🚦 Proactive RPM block: slot ${newCount}/${this.rpmLimit} (safe limit ${rpmSafe}), retry in ${retryIn.toFixed(0)}s`);
        throw new RateLimitError(
          `Proactive rate limit: ${newCount} requests this minute (safe limit ${rpmSafe})`,
          Math.ceil(retryIn)
        );
      }
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      logger.warn('TokenBudget RPM check failed (Redis error) — skipping:', err);
    }
  }

  async checkAndIncrementTPM(estimated: number): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const redis   = getRedisClient();
      const tpmKey  = this.windowKey('openai:tpm');
      const tpmSafe = Math.floor(this.tpmLimit * this.safetyRatio);

      // Atomic INCRBY first — each concurrent caller claims tokens before checking
      const newTotal = await redis.incrBy(tpmKey, estimated);
      await redis.expire(tpmKey, 90);

      if (newTotal > tpmSafe) {
        await redis.decrBy(tpmKey, estimated); // roll back
        const retryIn = 60 - (Date.now() % 60000) / 1000;
        logger.warn(`🚦 Proactive TPM block: ${newTotal} tokens (after +${estimated}) exceeds safe limit ${tpmSafe}`);
        throw new RateLimitError(
          `Proactive token limit: ${newTotal} tokens this minute (safe limit ${tpmSafe})`,
          Math.ceil(retryIn)
        );
      }
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      logger.warn('TokenBudget TPM check failed (Redis error) — skipping:', err);
    }
  }

  checkMonthlyBudget(estimated: number): void {
    const limit = this.monthlyTokenLimit;
    if (!limit) return;

    const currentMonth = new Date().getMonth();
    if (currentMonth !== monthlyResetMonth) {
      monthlyTokensUsed = 0;
      monthlyResetMonth = currentMonth;
      logger.info('🔄 Monthly token counter reset for new month');
    }

    // Claim tokens speculatively first — prevents concurrent sections from all passing at 0
    monthlyTokensUsed += estimated;
    const safeCeiling = Math.floor(limit * this.safetyRatio);
    if (monthlyTokensUsed > safeCeiling) {
      monthlyTokensUsed -= estimated; // roll back
      logger.warn(`🚦 Proactive monthly budget block: ${monthlyTokensUsed}/${limit} tokens used (safe limit ${safeCeiling})`);
      throw new QuotaExceededError(`Monthly token budget reached: ${monthlyTokensUsed} of ${safeCeiling} safe limit used`);
    }
  }

  // Reconcile actual vs estimated after a successful call
  async recordActualTokens(actual: number, estimated: number): Promise<void> {
    monthlyTokensUsed += (actual - estimated); // SWAP: persist to DB — monthly quota usage
    if (!isRedisAvailable()) return;
    const diff = actual - estimated;
    if (diff === 0) return;
    try {
      const redis  = getRedisClient();
      const tpmKey = this.windowKey('openai:tpm');
      await redis.incrBy(tpmKey, diff);
    } catch { /* non-critical */ }
  }

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

export class ConnectionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionTimeoutError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

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

class OpenAIClient {
  private client: OpenAI | null;
  private readonly embeddingModel: string;
  private readonly chatModel: string;

  constructor() {
    this.client = null;
    this.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';
    this.chatModel = 'gpt-4o';
  }

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

  async createEmbedding(input: string | string[]): Promise<number[] | number[][]> {
    try {
      if (!this.client) this.initialize();

      const isArray = Array.isArray(input);
      logger.info(`🔢 Creating embeddings with model=${this.embeddingModel} for ${isArray ? input.length : 1} text(s)`);

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

  async generateCompletion(messages: Message[], options: CompletionOptions = {}): Promise<string> {
    try {
      if (!this.client) this.initialize();

      const {
        temperature = 0.7,
        max_tokens = 16000,
        model = this.chatModel,
        response_format = null,
      } = options;

      logger.debug(`💬 Generating completion with ${model} (${messages.length} messages)`);

      // ── Proactive budget check before every OpenAI call ──
      const estimatedTokens = tokenBudget.estimateTokens(messages as { content?: string }[], max_tokens);
      tokenBudget.checkMonthlyBudget(estimatedTokens);
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
      await tokenBudget.recordActualTokens(tokensUsed, estimatedTokens);
      
      return responseText;
    } catch (error: any) {
      // Already-classified errors
      if (error instanceof RateLimitError || error instanceof QuotaExceededError || error instanceof ConnectionTimeoutError) {
        throw error;
      }
      // Connection timeout — don't retry, propagate immediately
      if (error?.constructor?.name === 'APIConnectionTimeoutError' || error?.code === 'ETIMEDOUT') {
        logger.error('⏱️  OpenAI connection timeout — not retrying');
        throw new ConnectionTimeoutError(error.message || 'OpenAI request timed out');
      }
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

  async generateJSONCompletion(systemPrompt: string, userPrompt: string, options: CompletionOptions = {}): Promise<Record<string, unknown>> {
    try {
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const jsonOptions: CompletionOptions = {
        ...options,
        response_format: { type: 'json_object' },
      };

      const responseText = await this.generateCompletion(messages, jsonOptions);

      // Strip markdown code fences if present
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
      // Re-throw rate limit, quota, and timeout errors without modification
      if (error instanceof RateLimitError || error instanceof QuotaExceededError || error instanceof ConnectionTimeoutError) {
        throw error;
      }
      logger.error('Error generating JSON completion:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const openaiClient = new OpenAIClient();
