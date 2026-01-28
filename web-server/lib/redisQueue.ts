import { getRedisClient, isRedisAvailable } from './redis.js';
import { logger } from '../utils/logger.js';

interface QueueJob {
  id: string;
  location: string;
  userId: string;
  timestamp: number;
}

const QUEUE_NAME = 'market_insights_queue';
const PROCESSING_SET = 'market_insights_processing';

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