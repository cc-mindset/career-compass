import { openaiClient, RateLimitError, QuotaExceededError, ConnectionTimeoutError } from "../lib/openai";
import { logger } from "../utils/logger";

export type GenerateSingleResponseOptions = {
  maxTokens?: number;
  temperature?: number;
};

/**
 * Helper: Generate single response with retry logic
 * DOES NOT retry on rate limit or quota errors - these should be handled at queue level
 */
export async function generateSingleResponse(
  systemPrompt: string,
  formattedContext: string,
  query: string,
  responseFormat: 'json' | 'text',
  maxRetries: number = 3,
  options: GenerateSingleResponseOptions = {},
): Promise<Record<string, unknown> | string> {
  const maxTokens = options.maxTokens ?? 16000;
  const temperature = options.temperature ?? 0.7;
  let response: Record<string, unknown> | string;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (responseFormat === 'json') {
        const userPrompt = !!formattedContext ? `${formattedContext}\n\n${query}` : query;
        response = await openaiClient.generateJSONCompletion(systemPrompt, userPrompt, {
          max_tokens: maxTokens,
          temperature,
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
