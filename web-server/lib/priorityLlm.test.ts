import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./redisQueue.js', () => ({
  storeJobPartialResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./websocket.js', () => ({
  emitToJob: vi.fn(),
}));

vi.mock('../services/llmService.js', () => ({
  generateSingleResponse: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { storeJobPartialResult } from './redisQueue.js';
import { emitToJob } from './websocket.js';
import { generateSingleResponse } from '../services/llmService.js';
import {
  __resetPriorityLlmForTests,
  runPriorityJobSection,
  runPriorityLlmCall,
  runPriorityJsonLlm,
} from './priorityLlm.js';

const mockStorePartial = vi.mocked(storeJobPartialResult);
const mockEmit = vi.mocked(emitToJob);
const mockGenerate = vi.mocked(generateSingleResponse);

describe('priorityLlm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPriorityLlmForTests();
  });

  it('coalesces concurrent runPriorityLlmCall by key', async () => {
    let resolveRun: ((value: string) => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRun = resolve;
        }),
    );

    const first = runPriorityLlmCall({ key: 'k1', run });
    const second = runPriorityLlmCall({ key: 'k1', run });

    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledTimes(1);
    });
    resolveRun?.('ok');
    await expect(Promise.all([first, second])).resolves.toEqual(['ok', 'ok']);
  });

  it('runs distinct keys independently', async () => {
    const runA = vi.fn().mockResolvedValue('a');
    const runB = vi.fn().mockResolvedValue('b');

    const [a, b] = await Promise.all([
      runPriorityLlmCall({ key: 'a', run: runA }),
      runPriorityLlmCall({ key: 'b', run: runB }),
    ]);

    expect(a).toBe('a');
    expect(b).toBe('b');
    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).toHaveBeenCalledTimes(1);
  });

  it('runPriorityJsonLlm uses generateSingleResponse on the priority lane', async () => {
    mockGenerate.mockResolvedValue({ hello: 'world' });

    const result = await runPriorityJsonLlm({
      key: 'json-1',
      systemPrompt: 'sys',
      userPrompt: 'user',
      maxTokens: 500,
    });

    expect(result).toEqual({ hello: 'world' });
    expect(mockGenerate).toHaveBeenCalledWith(
      'sys',
      '',
      'user',
      'json',
      3,
      { maxTokens: 500, temperature: 0.7 },
    );
  });

  it('runPriorityJobSection emits success and stores partial', async () => {
    const result = await runPriorityJobSection({
      key: 'section:job-1',
      jobId: 'job-1',
      section: 'marketReportVerdict',
      produce: async () => ({ headline: 'Ready' }),
      normalize: (data) => ({ ...data, normalized: true }),
    });

    expect(result).toEqual({ headline: 'Ready', normalized: true });
    expect(mockStorePartial).toHaveBeenCalledWith(
      'job-1',
      { headline: 'Ready', normalized: true },
      ['marketReportVerdict'],
    );
    expect(mockEmit).toHaveBeenCalledWith(
      'job-1',
      'progress',
      expect.objectContaining({ type: 'job_start' }),
    );
    expect(mockEmit).toHaveBeenCalledWith(
      'job-1',
      'progress',
      expect.objectContaining({
        type: 'section_success',
        section: 'marketReportVerdict',
      }),
    );
  });

  it('runPriorityJobSection emits section_error and returns null on failure', async () => {
    const result = await runPriorityJobSection({
      key: 'section:job-fail',
      jobId: 'job-fail',
      section: 'marketReportVerdict',
      produce: async () => {
        throw new Error('boom');
      },
    });

    expect(result).toBeNull();
    expect(mockEmit).toHaveBeenCalledWith(
      'job-fail',
      'progress',
      expect.objectContaining({
        type: 'section_error',
        section: 'marketReportVerdict',
        error: 'boom',
      }),
    );
    expect(mockStorePartial).not.toHaveBeenCalled();
  });
});
