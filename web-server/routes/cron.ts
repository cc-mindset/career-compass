import express, { Request, Response } from "express";
import { getTopCitiesOfState } from "../utils/city";
import { LLM_SECTION_LABELS } from "../constants";
import { formatMarketInsightsContext, generateMultipleWithSharedContext } from "../services/ragService";
import { buildIndustryTrendsPrompt, buildMarketReportPrompt, buildNewsAndCareerIntelPrompt, SYSTEM_PROMPT } from "../services/market-insights/marketInsightsService_multipart";
import LlmCareerIntel from "../db/models/careerIntel";
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
    await generateMultipleWithSharedContext(
      SYSTEM_PROMPT,
      [
        { label: LLM_SECTION_LABELS.marketReport, query: buildMarketReportPrompt(location), cacheKeySuffix: `${location}` },
        { label: LLM_SECTION_LABELS.industryTrends, query: buildIndustryTrendsPrompt(location), cacheKeySuffix: `${location}` },
        { label: LLM_SECTION_LABELS.newsAndCareerIntel, query: buildNewsAndCareerIntelPrompt(location), cacheKeySuffix: `${location}` },
      ],
      {
        namespaces: ['bls-data', 'news-data', 'reports-data'],
        topKPerNamespace: { 'bls-data': 15, 'news-data': 12, 'reports-data': 10 },
        responseFormat: 'json',
        useCache: true,
        useRetrievalCache: true,     // Pinecone/embedding namespace cache ON — avoids redundant vector DB calls
        contextFormatter: formatMarketInsightsContext,
        retrievalQuery: `market insights for ${location}`,
      }
    );
  }

  return res.json({ stateCode, cities });
});

export default cronRouter;
