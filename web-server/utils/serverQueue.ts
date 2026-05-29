import {
  dequeueJob,
  completeJob,
  storeJobResult,
  failJob,
  pauseQueue,
  isQueuePaused,
  retryJob,
} from "../lib/redisQueue.js";
import {
  RateLimitError,
  QuotaExceededError,
  ConnectionTimeoutError,
} from "../lib/openai.js";
import { mockDbCache } from "../utils/mockDbCache.js";
import { generateMarketInsights } from "../services/market-insights/marketInsightsService_multipart.js";
import { emitToJob } from "../lib/websocket.js";

// Queue processor - runs in background with proper error handling
export async function processQueue() {
  console.log("📋 Queue processor started");

  while (true) {
    try {
      // Check if queue is paused
      const { paused, reason } = await isQueuePaused();
      if (paused) {
        console.log(
          `⏸️  Queue is paused: ${reason}. Waiting 30s before checking again...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 30000));
        continue;
      }

      const job = await dequeueJob();

      if (job) {
        const retryInfo = job.retryCount ? ` (retry ${job.retryCount}/2)` : "";
        console.log(
          `🔄 Processing queued job: ${job.id} for ${job.location}${retryInfo}`,
        );

        try {
          const { insights, failedSections } = await generateMarketInsights(
            job.location,
            job.userId,
            job.id,
            job.locationDistrict,
            job.job,
            job.seniority
          );
          await storeJobResult(job.id, insights);
          await completeJob(job.id);
          if (failedSections.length === 0) {
            mockDbCache.set(job.location); // only cache fully complete results
          } else {
            console.warn(
              `⚠️ Job ${job.id} partial: ${failedSections.join(", ")} failed — skipping cache`,
            );
          }
          console.log(`✅ Job ${job.id} completed successfully`);
        } catch (jobError: any) {
          // Handle quota exceeded - pause queue and fail job
          if (jobError instanceof QuotaExceededError) {
            console.error(`🚨 QUOTA EXCEEDED: ${jobError.message}`);
            console.error("═══════════════════════════════════════");
            console.error("⚠️  CRITICAL: OpenAI API quota limit reached!");
            console.error("📧 ACTION REQUIRED: Admin intervention needed");
            console.error("⏸️  Queue processing paused for 1 hour");
            console.error("═══════════════════════════════════════");

            await failJob(job.id, `Quota exceeded: ${jobError.message}`);
            await pauseQueue(
              "OpenAI quota exceeded - admin action required",
              3600,
            );
            // Emit fallback mock to client (swap: return last DB-stored insights instead)
            emitToJob(job.id, "progress", {
              type: "job_fallback",
              insights: mockDbCache.getMockFallback(job.location),
              reason:
                "OpenAI is at capacity. Showing fallback data — please try again later.",
              jobId: job.id,
            });
            continue;
          }

          // Handle rate limit - pause briefly and retry job
          if (jobError instanceof RateLimitError) {
            const pauseDuration = jobError.retryAfter || 60;
            console.warn(
              `⚠️  RATE LIMIT HIT: Pausing queue for ${pauseDuration}s`,
            );

            await pauseQueue(
              `Rate limit - retry after ${pauseDuration}s`,
              pauseDuration,
            );

            // Try to retry the job
            const requeued = await retryJob(job);
            if (!requeued) {
              await failJob(
                job.id,
                `Rate limit exceeded and max retries reached`,
              );
              // Emit fallback mock to client (swap: return last DB-stored insights instead)
              emitToJob(job.id, "progress", {
                type: "job_fallback",
                insights: mockDbCache.getMockFallback(job.location),
                reason:
                  "Service is temporarily rate-limited. Showing fallback data — please try again in a few minutes.",
                jobId: job.id,
              });
            }
            continue;
          }

          // Handle connection timeout — emit fallback immediately, retry job
          if (jobError instanceof ConnectionTimeoutError) {
            console.warn(
              `⏱️  TIMEOUT: Job ${job.id} timed out. Emitting fallback and requeuing...`,
            );
            // Always notify the client immediately with fallback
            emitToJob(job.id, "progress", {
              type: "job_fallback",
              insights: mockDbCache.getMockFallback(job.location),
              reason:
                "Request timed out. Showing fallback data — your request has been requeued and will retry automatically.",
              jobId: job.id,
            });
            await retryJob(job);
            continue;
          }

          // Handle other errors - retry if possible
          console.error(`❌ Job ${job.id} failed:`, jobError.message);
          // Always notify client immediately regardless of requeue status
          emitToJob(job.id, "progress", {
            type: "job_fallback",
            insights: mockDbCache.getMockFallback(job.location),
            reason:
              "Something went wrong generating your insights. Showing fallback data — please try again shortly.",
            jobId: job.id,
          });
          const requeued = await retryJob(job);
          if (!requeued) {
            await failJob(job.id, jobError.message || "Unknown error");
          }
        }
      } else {
        // No jobs, wait 2 seconds before checking again
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      console.error("🔥 Queue processor critical error:", error);
      // Wait longer on critical errors to avoid tight error loops
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}
