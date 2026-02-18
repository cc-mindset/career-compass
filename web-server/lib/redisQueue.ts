import { getRedisClient, isRedisAvailable } from './redis.js';
import { logger } from '../utils/logger.js';

export interface QueueJob {
  id: string;
  location: string;
  userId: string;
  timestamp: number;
  retryCount?: number;
  failureReason?: string;
}

const QUEUE_NAME = 'market_insights_queue';
const PROCESSING_SET = 'market_insights_processing';
const FAILED_JOBS_SET = 'market_insights_failed';
const QUEUE_PAUSED_KEY = 'market_insights_queue_paused';
const MAX_RETRIES = 2; // Maximum retry attempts before marking as failed

/**
 * Add job to queue (safe - works even if Redis is down)
 */
export async function enqueueJob(location: string, userId: string): Promise<string | null> {
  if (!isRedisAvailable()) {
    logger.warn('Redis unavailable - job will be processed immediately');
    return null;
  }

  try {
    const redis = getRedisClient();
    const jobId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: QueueJob = {
      id: jobId,
      location,
      userId,
      timestamp: Date.now(),
    };

    await redis.rPush(QUEUE_NAME, JSON.stringify(job));
    logger.info(`✓ Job queued: ${jobId} for ${location}`);
    return jobId;
  } catch (error) {
    logger.error('Failed to enqueue job:', error);
    return null;
  }
}

/**
 * Get next job from queue
 */
export async function dequeueJob(): Promise<QueueJob | null> {
  if (!isRedisAvailable()) return null;

  try {
    const redis = getRedisClient();
    const jobStr = await redis.lPop(QUEUE_NAME);
    
    if (!jobStr) return null;

    const job = JSON.parse(jobStr) as QueueJob;
    
    // Mark as processing
    await redis.sAdd(PROCESSING_SET, job.id);
    
    return job;
  } catch (error) {
    logger.error('Failed to dequeue job:', error);
    return null;
  }
}

/**
 * Mark job as completed
 */
export async function completeJob(jobId: string): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    const redis = getRedisClient();
    await redis.sRem(PROCESSING_SET, jobId);
    logger.info(`✓ Job completed: ${jobId}`);
  } catch (error) {
    logger.error('Failed to complete job:', error);
  }
}

/**
 * Store job result in Redis
 */
export async function storeJobResult(jobId: string, result: any): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    const redis = getRedisClient();
    await redis.set(`job_result:${jobId}`, JSON.stringify(result), { EX: 600 }); // 10 min TTL
    logger.info(`✓ Job result stored: ${jobId}`);
  } catch (error) {
    logger.error('Failed to store job result:', error);
  }
}

/**
 * Get job result
 */
export async function getJobResult(jobId: string): Promise<any | null> {
  if (!isRedisAvailable()) return null;

  try {
    const redis = getRedisClient();
    const result = await redis.get(`job_result:${jobId}`);
    return result ? JSON.parse(result) : null;
  } catch {
    return null;
  }
}

/**
 * Get queue length (for monitoring)
 */
export async function getQueueLength(): Promise<number> {
  if (!isRedisAvailable()) return 0;

  try {
    const redis = getRedisClient();
    return await redis.lLen(QUEUE_NAME);
  } catch {
    return 0;
  }
}

/**
 * Mark job as failed and store failure reason
 */
export async function failJob(jobId: string, reason: string, job?: QueueJob): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    const redis = getRedisClient();
    
    // Remove from processing set
    await redis.sRem(PROCESSING_SET, jobId);
    
    // Add to failed jobs set with metadata
    const failedJob = {
      ...job,
      id: jobId,
      failureReason: reason,
      failedAt: Date.now(),
    };
    await redis.sAdd(FAILED_JOBS_SET, JSON.stringify(failedJob));
    
    // Store detailed failure info
    await redis.set(`job_failure:${jobId}`, JSON.stringify(failedJob), { EX: 86400 }); // 24 hour TTL
    
    logger.error(`❌ Job failed: ${jobId} - Reason: ${reason}`);
  } catch (error) {
    logger.error('Failed to mark job as failed:', error);
  }
}

/**
 * Pause queue processing (e.g., when quota exceeded)
 */
export async function pauseQueue(reason: string, durationSeconds: number = 3600): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    const redis = getRedisClient();
    await redis.set(QUEUE_PAUSED_KEY, reason, { EX: durationSeconds });
    logger.warn(`⏸️  QUEUE PAUSED: ${reason} (for ${durationSeconds}s)`);
  } catch (error) {
    logger.error('Failed to pause queue:', error);
  }
}

/**
 * Resume queue processing
 */
export async function resumeQueue(): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    const redis = getRedisClient();
    await redis.del(QUEUE_PAUSED_KEY);
    logger.info('▶️  Queue resumed');
  } catch (error) {
    logger.error('Failed to resume queue:', error);
  }
}

/**
 * Check if queue is paused
 */
export async function isQueuePaused(): Promise<{ paused: boolean; reason?: string }> {
  if (!isRedisAvailable()) return { paused: false };

  try {
    const redis = getRedisClient();
    const reason = await redis.get(QUEUE_PAUSED_KEY);
    return { paused: !!reason, reason: reason || undefined };
  } catch {
    return { paused: false };
  }
}

/**
 * Retry a job (requeue with incremented retry count)
 */
export async function retryJob(job: QueueJob): Promise<boolean> {
  if (!isRedisAvailable()) return false;

  const retryCount = (job.retryCount || 0) + 1;
  
  if (retryCount > MAX_RETRIES) {
    logger.warn(`⚠️  Job ${job.id} exceeded max retries (${MAX_RETRIES})`);
    await failJob(job.id, `Exceeded maximum retry attempts (${MAX_RETRIES})`, job);
    return false;
  }

  try {
    const redis = getRedisClient();
    const retryJob: QueueJob = { ...job, retryCount };
    
    // Remove from processing
    await redis.sRem(PROCESSING_SET, job.id);
    
    // Re-add to queue
    await redis.rPush(QUEUE_NAME, JSON.stringify(retryJob));
    
    logger.info(`🔄 Job ${job.id} requeued for retry ${retryCount}/${MAX_RETRIES}`);
    return true;
  } catch (error) {
    logger.error('Failed to retry job:', error);
    return false;
  }
}

/**
 * Get failed jobs count
 */
export async function getFailedJobsCount(): Promise<number> {
  if (!isRedisAvailable()) return 0;

  try {
    const redis = getRedisClient();
    return await redis.sCard(FAILED_JOBS_SET);
  } catch {
    return 0;
  }
}