import express, { Request, Response } from "express";
import { mockDbCache } from "../utils/mockDbCache";
import { enqueueJob, getJobResult, getQueueLength } from "../lib/redisQueue";
import { generateMarketInsights } from "../services/marketInsightsService_multipart";

const marketInsightRouter = express.Router();

// Generate market insights endpoint
marketInsightRouter.post(
  "/generate",
  async (req: Request, res: Response) => {
    try {
      const { location, userId } = req.body;

      if (!location || typeof location !== "string") {
        return res
          .status(400)
          .json({ error: "Valid location string is required" });
      }

      const sanitizedLocation = location.trim().substring(0, 500);

      if (sanitizedLocation.length === 0) {
        return res.status(400).json({ error: "Location cannot be empty" });
      }

      // ── Step 1: Check mock DB cache (swap with real DB check later) ──
      const cacheStatus = mockDbCache.check(sanitizedLocation);
      if (cacheStatus.hit && cacheStatus.isLTS) {
        console.log(
          `📦 Mock DB Cache HIT (LTS): "${sanitizedLocation}" — returning mock cached data`,
        );
        return res.json({
          success: true,
          insights: mockDbCache.getMockInsights(sanitizedLocation),
          fromCache: true,
          generated_at: new Date().toISOString(),
        });
      }

      // Cache miss or stale → enter queue
      // ── Step 2: Try to queue the job ──
      const jobId = await enqueueJob(sanitizedLocation, userId || "");

      if (jobId) {
        const queuePos = await getQueueLength();
        console.log(`📋 Job queued: ${jobId} (position: ${queuePos})`);
        return res.json({
          success: true,
          queued: true,
          jobId,
          position: queuePos,
          message: "Request queued for processing",
        });
      }

      // If not queued (Redis down), direct
      console.log(`--> Processing directly: ${sanitizedLocation}`);
      const insights = await generateMarketInsights(
        sanitizedLocation,
        userId || "",
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
          insights: result,
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
