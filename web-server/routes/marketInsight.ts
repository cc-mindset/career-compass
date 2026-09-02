import express, { Request, Response } from "express";
// import { mockDbCache } from "../utils/mockDbCache";
import { enqueueJob, getJobPartialResult, getJobResult, getQueueLength } from "../lib/redisQueue";
import { startPriorityJobSection } from "../lib/priorityLlm";
import {
  generateMarketInsights,
  produceMarketReportVerdict,
} from "../services/market-insights/marketInsightsService_multipart";
import { normalizeMarketReportVerdict } from "../services/market-insights/normalizeMarketReportVerdict";
import { getTopCityOfDistrictOfACity } from "../utils/city";
import { getCachedMarketInsightsFromDb } from "../services/db-cache/dbCacheService";
import { LLM_SECTION_LABELS } from "../constants/index";

const marketInsightRouter = express.Router();

// Generate market insights endpoint
marketInsightRouter.post(
  "/generate",
  async (req: Request, res: Response) => {
    try {
      const { location: requestedLocation, userId, job, seniority, industry } =
        req.body;

      if (!requestedLocation || typeof requestedLocation !== "string") {
        return res
          .status(400)
          .json({ error: "Valid location string is required" });
      }

      let sanitizedLocation = requestedLocation.trim().substring(0, 500);

      if (sanitizedLocation.length === 0) {
        return res.status(400).json({ error: "Location cannot be empty" });
      }

      const sanitizedIndustry =
        typeof industry === "string" && industry.trim()
          ? industry.trim().substring(0, 200)
          : undefined;

      const { locationCity, locationDistrict } = getTopCityOfDistrictOfACity(sanitizedLocation);

      const cachedInsights = await getCachedMarketInsightsFromDb(sanitizedLocation, job, seniority);
      if (cachedInsights) {
        console.log(`📦 DB Cache HIT before queue for: ${sanitizedLocation}`);
        return res.json({
          success: true,
          insights: cachedInsights.insights,
          fromCache: true,
          generated_at: new Date().toISOString(),
        });
      }

      // Cache miss or stale → enter queue
      const jobId = await enqueueJob(
        sanitizedLocation,
        userId || "",
        locationDistrict || "",
        job,
        seniority,
        sanitizedIndustry,
      );

      if (jobId) {
        // Priority lane: verdict (+ shifts) now; lean Part 1 + Parts 2–3 wait on FIFO.
        startPriorityJobSection({
          key: `${LLM_SECTION_LABELS.marketReportVerdict}:${jobId}`,
          jobId,
          section: LLM_SECTION_LABELS.marketReportVerdict,
          stage: "Preparing market verdict",
          produce: () =>
            produceMarketReportVerdict({
              location: sanitizedLocation,
              locationDistrict: locationDistrict || "",
              job,
              seniority,
              industry: sanitizedIndustry,
            }),
          normalize: (data) => normalizeMarketReportVerdict(data),
        });

        const queuePos = await getQueueLength();
        console.log(`📋 Job queued: ${jobId} (position: ${queuePos}) — priority verdict started`);
        return res.json({
          success: true,
          queued: true,
          jobId,
          position: queuePos,
          message: "Request queued for processing",
        });
      }

      // If not queued (Redis down), generate synchronously
      console.log(`--> Processing directly: ${sanitizedLocation}`);
      const { insights } = await generateMarketInsights(
        sanitizedLocation,
        userId || "",
        "",
        locationDistrict || "",
        job,
        seniority,
        sanitizedIndustry,
      );

      return res.json({
        success: true,
        insights,
        generated_at: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      console.error("Error in market insights endpoint:", err);

      const errorMessage =
        process.env.NODE_ENV === "production"
          ? "Failed to generate market insights. Please try again later."
          : err.message;

      return res.status(500).json({
        error: "Failed to generate market insights",
        message: errorMessage,
      });
    }
  },
);

// Check job status endpoint (NEW)
marketInsightRouter.get(
  "/status/:jobId",
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const result = await getJobResult(jobId);

      if (result) {
        return res.json({
          success: true,
          status: "completed",
          insights: normalizeMarketReportVerdict(result),
          completedSections: [
            "marketReportVerdict",
            "marketReport",
            "industryTrends",
            "newsAndCareerIntel",
          ],
        });
      }

      const partial = await getJobPartialResult(jobId);
      if (partial) {
        return res.json({
          success: true,
          status: "processing",
          insights: normalizeMarketReportVerdict(partial.insights),
          completedSections: partial.completedSections,
        });
      }

      return res.json({
        success: true,
        status: "processing",
        message: "Job is still processing",
      });
    } catch (error) {
      console.error("Error checking job status:", error);
      return res.status(500).json({ error: "Failed to check status" });
    }
  },
);

export default marketInsightRouter;
