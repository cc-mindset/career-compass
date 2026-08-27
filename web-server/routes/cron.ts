import express, { Request, Response } from "express";
import { getTopCitiesOfState } from "../utils/city";
import { LLM_SECTION_LABELS } from "../constants";
import { retrieve } from "../services/ragRetrievalService";
import { formatMarketInsightsContext } from "../lib/ragContextFormatters";
import { RagNamespace } from "../types/rag";
import { openaiClient, RateLimitError, QuotaExceededError, ConnectionTimeoutError } from "../lib/openai";
import { cacheLlmResponseToDb, getCachedLlmResponseFromDb, getUniqueDbCacheKeyForLlmResponse, updateCacheResponseInDb } from "../services/db-cache/dbCacheService";
import { buildIndustryTrendsPrompt, buildMarketReportPrompt, buildMarketReportVerdictPrompt, buildNewsAndCareerIntelPrompt, SYSTEM_PROMPT } from "../services/market-insights/marketInsightsService_multipart";
import LlmCareerIntel from "../db/models/careerIntel";
import { LlmCacheStatus } from "../constants/db";
import { logger } from "../utils/logger";
import pLimit from "p-limit";
const cronRouter = express.Router();

cronRouter.get("/test", async (_req: Request, res: Response) => {
  try {

    return res.json({ success: true, message: "CRON TEST has started" });
  } catch (error) {
    console.error("Error saving location:", error);
    return res.status(500).json({ error: "Failed to save location" });
  }
});


cronRouter.get("/cache-state-wise", async (req: Request, res: Response) => {
  const { stateCode } = req.query;
  if (!stateCode || typeof stateCode !== "string") {
    return res.status(400).json({ error: "Valid state code string is required" });
  }
  const cities = getTopCitiesOfState(stateCode);

  for (let i = 0; i < cities.length; i++) {
    const location = cities[i];

    console.log(`Caching for ${i + 1}: ${location}`);
    const isCached = await LlmCareerIntel.findOne({ location });
    if (isCached) {
      console.log(`✅ Cache already exists for ${location}, skipping...`);
      continue;
    }
    try {
      // Step A: Retrieve shared context once with location as primary dimension
      // For cron batch pre-warming, use generic query (no job/seniority filtering)
      const namespaces = [
        RagNamespace.LABOR_MARKET_STATS,
        RagNamespace.MARKET_NEWS,
        RagNamespace.MARKET_REPORTS,
        RagNamespace.GEO_LABOR_SIGNALS,
        RagNamespace.FORWARD_LOOKING,
      ];

      const retrievalResp = await retrieve({
        query: `market insights for ${location}`,
        namespaces,
        topK: 10,
        useCache: true,
      });

      // Step B: Format context for the LLM
      const formattedContext = formatMarketInsightsContext(retrievalResp);

      // Step C: Generate each section in parallel
      const responseFormat = 'json';
      const useCache = true;
      const concurrency = parseInt(process.env.OPENAI_MAX_CONCURRENT || '3');
      const limit = pLimit(concurrency);
      const results: Record<string, Record<string, unknown>> = {};

      // Helper: generateSingleResponse with retry logic
      async function generateSingleResponse(
        systemPrompt: string,
        formattedContextText: string,
        queryText: string,
        _responseFormat: 'json' | 'text',
        maxRetries = 3
      ): Promise<Record<string, unknown>> {
        let response: Record<string, unknown>;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const userPrompt = `${formattedContextText}\n\n${queryText}`;
            response = await openaiClient.generateJSONCompletion(systemPrompt, userPrompt, {
              max_tokens: 16000,
              temperature: 0.7,
            });
            if (!response || typeof response !== 'object') {
              throw new Error('Invalid JSON response: not an object');
            }
            return response;
          } catch (error) {
            if (error instanceof RateLimitError || error instanceof QuotaExceededError || error instanceof ConnectionTimeoutError) {
              throw error;
            }
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
          }
        }
        throw new Error('Failed to generate response');
      }

      const prompts = [
        { label: LLM_SECTION_LABELS.marketReportVerdict, query: buildMarketReportVerdictPrompt(location), cacheKeySuffix: `${location}` },
        { label: LLM_SECTION_LABELS.marketReport, query: buildMarketReportPrompt(location), cacheKeySuffix: `${location}` },
        { label: LLM_SECTION_LABELS.industryTrends, query: buildIndustryTrendsPrompt(location), cacheKeySuffix: `${location}` },
        { label: LLM_SECTION_LABELS.newsAndCareerIntel, query: buildNewsAndCareerIntelPrompt(location), cacheKeySuffix: `${location}` },
      ];

      const generationPromises = prompts.map(prompt => limit(async () => {
        const dbCacheKey = getUniqueDbCacheKeyForLlmResponse('rag', prompt.cacheKeySuffix);
        if (useCache) {
          const cached = await getCachedLlmResponseFromDb(dbCacheKey, prompt.label as typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS]);
          if (cached && cached.status !== LlmCacheStatus.UPDATING) {
            results[prompt.label] = cached.data;
            return;
          }
        }
        if (useCache) {
          updateCacheResponseInDb(dbCacheKey, prompt.label as typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS]);
        }
        const response = await generateSingleResponse(SYSTEM_PROMPT, formattedContext.text, prompt.query, responseFormat as 'json' | 'text', 3);
        if (useCache) {
          cacheLlmResponseToDb(dbCacheKey, response, prompt.label as typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS]);
        }
        results[prompt.label] = response;
      }));

      await Promise.allSettled(generationPromises);
      console.log(`✅ Cached all sections for ${location}`);
    } catch (error) {
      logger.error(`Failed to cache insights for ${location}:`, error);
    }
  }

  return res.json({ stateCode, cities });
});

export default cronRouter;
