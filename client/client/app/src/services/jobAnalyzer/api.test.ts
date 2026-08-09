import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiBase', () => ({
  getApiBaseUrl: () => 'http://api.test',
  isApiConfigured: () => true,
}));

vi.mock('../../lib/socket', () => ({
  getSocket: () => null,
  waitForSocketConnection: async () => false,
}));

import { analyzeJobFromUrl, JobAnalyzerApiError } from './api';

describe('jobAnalyzer API error shaping', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('surfaces pasteFallback from failed URL analyze responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Could not fetch URL',
          pasteFallback: true,
        }),
      })),
    );

    await expect(
      analyzeJobFromUrl({
        url: 'https://example.com/jobs/1',
        postingText: '',
      }),
    ).rejects.toMatchObject({
      name: 'JobAnalyzerApiError',
      message: 'Could not fetch URL',
      pasteFallback: true,
    } satisfies Partial<JobAnalyzerApiError>);
  });

  it('constructs JobAnalyzerApiError with optional pasteFallback', () => {
    const err = new JobAnalyzerApiError('fail', true);
    expect(err).toBeInstanceOf(Error);
    expect(err.pasteFallback).toBe(true);
  });
});
