import { getRedisClient, isRedisAvailable } from './redis.js';
import { logger } from '../utils/logger.js';
import type { JobIngestSource } from '../types/jobAnalyzer.js';

export interface JobAnalyzerQueueJob {
  id: string;
  userId: string;
  postingText: string;
  title?: string;
  company?: string;
  location?: string;
  source: JobIngestSource;
  sourceUrl?: string;
  save: boolean;
  timestamp: number;
}

const QUEUE_NAME = 'job_analyzer_queue';
const RESULT_PREFIX = 'job_analyzer_result:';

export async function enqueueJobAnalyzerJob(
  job: Omit<JobAnalyzerQueueJob, 'id' | 'timestamp'>,
): Promise<string | null> {
  if (!isRedisAvailable()) {
    logger.warn('Redis unavailable - job analyzer will run synchronously');
    return null;
  }

  try {
    const redis = getRedisClient();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const queueJob: JobAnalyzerQueueJob = {
      ...job,
      id,
      timestamp: Date.now(),
    };
    await redis.rPush(QUEUE_NAME, JSON.stringify(queueJob));
    logger.info(`✓ Job analyzer queued: ${id}`);
    return id;
  } catch (error) {
    logger.error('Failed to enqueue job analyzer job:', error);
    return null;
  }
}

export async function dequeueJobAnalyzerJob(): Promise<JobAnalyzerQueueJob | null> {
  if (!isRedisAvailable()) return null;
  try {
    const redis = getRedisClient();
    const raw = await redis.lPop(QUEUE_NAME);
    if (!raw) return null;
    return JSON.parse(raw) as JobAnalyzerQueueJob;
  } catch (error) {
    logger.error('Failed to dequeue job analyzer job:', error);
    return null;
  }
}

export async function storeJobAnalyzerResult(
  jobId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    const redis = getRedisClient();
    await redis.set(`${RESULT_PREFIX}${jobId}`, JSON.stringify(payload), {
      EX: 3600,
    });
  } catch (error) {
    logger.error('Failed to store job analyzer result:', error);
  }
}

export async function getJobAnalyzerResult(
  jobId: string,
): Promise<Record<string, unknown> | null> {
  if (!isRedisAvailable()) return null;
  try {
    const redis = getRedisClient();
    const raw = await redis.get(`${RESULT_PREFIX}${jobId}`);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch (error) {
    logger.error('Failed to read job analyzer result:', error);
    return null;
  }
}

export async function getJobAnalyzerQueueLength(): Promise<number> {
  if (!isRedisAvailable()) return 0;
  try {
    return await getRedisClient().lLen(QUEUE_NAME);
  } catch {
    return 0;
  }
}
