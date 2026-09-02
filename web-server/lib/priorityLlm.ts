import pLimit from 'p-limit';
import { storeJobPartialResult } from './redisQueue.js';
import { emitToJob } from './websocket.js';
import { generateSingleResponse } from '../services/llmService.js';
import { logger } from '../utils/logger.js';

/**
 * Centralized priority LLM lane.
 *
 * Use this instead of one-off "priority" helpers when a short LLM call must
 * start immediately (bypassing the bulk FIFO worker), with:
 * - coalesce-by-key (rapid identical requests share one in-flight run)
 * - a dedicated concurrency pool (PRIORITY_LLM_MAX_CONCURRENT, default 4)
 * - optional job progress + partial persistence for queued multipart jobs
 */

const priorityLimit = pLimit(
  Math.max(1, parseInt(process.env.PRIORITY_LLM_MAX_CONCURRENT || '4', 10) || 4),
);

const inflight = new Map<string, Promise<unknown>>();

export type PriorityLlmCallOptions<T> = {
  /** Dedup / coalesce key. Concurrent callers with the same key share one run. */
  key: string;
  /** Log label (defaults to key). */
  label?: string;
  /** Work to execute once on the priority lane. */
  run: () => Promise<T>;
};

/**
 * Run arbitrary work on the priority lane with in-flight coalescing.
 */
export function runPriorityLlmCall<T>(options: PriorityLlmCallOptions<T>): Promise<T> {
  const { key, label = key, run } = options;
  const existing = inflight.get(key);
  if (existing) {
    logger.info(`⚡ Priority LLM coalesced: ${label}`);
    return existing as Promise<T>;
  }

  const promise = priorityLimit(async () => {
    logger.info(`⚡ Priority LLM start: ${label}`);
    try {
      const result = await run();
      logger.info(`⚡ Priority LLM complete: ${label}`);
      return result;
    } catch (error) {
      const err = error as Error;
      logger.error(`⚡ Priority LLM failed: ${label} — ${err.message}`);
      throw error;
    }
  }).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export type PriorityJsonLlmOptions = {
  key: string;
  label?: string;
  systemPrompt: string;
  /** Full user prompt (context already interleaved if needed). */
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
};

/**
 * JSON completion through the priority lane (retries via llmService).
 */
export function runPriorityJsonLlm(
  options: PriorityJsonLlmOptions,
): Promise<Record<string, unknown>> {
  const {
    key,
    label,
    systemPrompt,
    userPrompt,
    maxTokens = 1800,
    temperature = 0.7,
    maxRetries = 3,
  } = options;

  return runPriorityLlmCall({
    key,
    label,
    run: async () => {
      const response = await generateSingleResponse(
        systemPrompt,
        '',
        userPrompt,
        'json',
        maxRetries,
        { maxTokens, temperature },
      );
      if (!response || typeof response !== 'object' || Array.isArray(response)) {
        throw new Error('Priority JSON LLM returned a non-object response');
      }
      return response as Record<string, unknown>;
    },
  });
}

export type PriorityJobSectionOptions<T extends Record<string, unknown>> = {
  /** Coalesce key — typically `${section}:${jobId}` or a cache tuple key. */
  key: string;
  jobId: string;
  /** Section name emitted on socket / stored in partial completedSections. */
  section: string;
  label?: string;
  stage?: string;
  /**
   * Domain work: cache lookup, RAG, prompt build, LLM call, etc.
   * Return the section payload (object merged into job insights).
   */
  produce: () => Promise<T>;
  /** Optional normalize before persist/emit. */
  normalize?: (data: T) => T;
  /** Persist via storeJobPartialResult (default true). */
  persistPartial?: boolean;
};

/**
 * Priority lane + job_start / section_success|error (+ optional partial store).
 * Call from a route after enqueue; bulk sections stay on the FIFO worker.
 */
export function runPriorityJobSection<T extends Record<string, unknown>>(
  options: PriorityJobSectionOptions<T>,
): Promise<T | null> {
  const {
    key,
    jobId,
    section,
    label = `${section}:${jobId}`,
    stage = `Preparing ${section}`,
    produce,
    normalize,
    persistPartial = true,
  } = options;

  return runPriorityLlmCall({
    key,
    label,
    run: async () => {
      emitToJob(jobId, 'progress', {
        type: 'job_start',
        stage,
        jobId,
      });

      try {
        const raw = await produce();
        const data = normalize ? normalize(raw) : raw;

        if (persistPartial) {
          await storeJobPartialResult(jobId, data, [section]);
        }

        emitToJob(jobId, 'progress', {
          type: 'section_success',
          section,
          data,
          jobId,
        });

        return data;
      } catch (error) {
        const err = error as Error;
        emitToJob(jobId, 'progress', {
          type: 'section_error',
          section,
          error: err.message,
          jobId,
        });
        return null;
      }
    },
  });
}

/**
 * Fire-and-forget wrapper for route handlers.
 * Errors are logged; callers do not await the LLM.
 */
export function startPriorityJobSection<T extends Record<string, unknown>>(
  options: PriorityJobSectionOptions<T>,
): void {
  void runPriorityJobSection(options).catch((error) => {
    logger.error(
      `Priority job section fire-and-forget failed (${options.section}/${options.jobId}):`,
      error,
    );
  });
}

/** Test helper — clears coalesce map between cases. */
export function __resetPriorityLlmForTests(): void {
  inflight.clear();
}
