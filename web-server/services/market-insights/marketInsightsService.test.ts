import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LlmCacheStatus } from '../../constants/db.js';
import { LLM_SECTION_LABELS } from '../../constants/index.js';

vi.mock('../ragRetrievalService.js', () => ({
  retrieve: vi.fn(),
}));
vi.mock('../../lib/ragContextFormatters.js', () => ({
  formatMarketInsightsContext: vi.fn(),
}));
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('../../lib/websocket.js', () => ({
  emitToJob: vi.fn(),
}));
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));
vi.mock('../../lib/redisQueue.js', () => ({
  storeJobPartialResult: vi.fn(),
}));
vi.mock('../db-cache/dbCacheService.js', () => ({
  getCachedMarketInsightsFromDb: vi.fn(),
  getMarketInsightsCacheKey: vi.fn(
    (location: string, job?: string, seniority?: string) =>
      `rag:${location}__${job || ''}__${seniority || ''}`,
  ),
  getCachedLlmResponseFromDb: vi.fn(),
  getUniqueDbCacheKeyForLlmResponse: vi.fn(
    (prefix: string, ...vars: string[]) => `${prefix}:${vars.join('__')}`,
  ),
  updateCacheResponseInDb: vi.fn(),
  cacheLlmResponseToDb: vi.fn(),
  cacheEvidenceSourcesToDb: vi.fn(),
}));
vi.mock('../../lib/openai.js', () => ({
  openaiClient: {
    generateJSONCompletion: vi.fn(),
    generateCompletion: vi.fn(),
  },
  RateLimitError: class RateLimitError extends Error {},
  QuotaExceededError: class QuotaExceededError extends Error {},
  ConnectionTimeoutError: class ConnectionTimeoutError extends Error {},
}));

import { generateMarketInsights, produceMarketReportVerdict } from './marketInsightsService_multipart.js';
import { retrieve } from '../ragRetrievalService.js';
import { formatMarketInsightsContext } from '../../lib/ragContextFormatters.js';
import { logger } from '../../utils/logger.js';
import { emitToJob } from '../../lib/websocket.js';
import { writeFile, mkdir } from 'fs/promises';
import {
  getCachedMarketInsightsFromDb,
  getCachedLlmResponseFromDb,
  cacheLlmResponseToDb,
  updateCacheResponseInDb,
} from '../db-cache/dbCacheService.js';
import { openaiClient } from '../../lib/openai.js';

const mockRetrieve = vi.mocked(retrieve);
const mockFormatContext = vi.mocked(formatMarketInsightsContext);
const mockGetTupleCache = vi.mocked(getCachedMarketInsightsFromDb);
const mockGetSectionCache = vi.mocked(getCachedLlmResponseFromDb);
const mockCacheSection = vi.mocked(cacheLlmResponseToDb);
const mockUpdateCache = vi.mocked(updateCacheResponseInDb);
const mockLoggerInfo = vi.mocked(logger.info);
const mockLoggerWarn = vi.mocked(logger.warn);
const mockEmitToJob = vi.mocked(emitToJob);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);
const mockGenerateJson = vi.mocked(openaiClient.generateJSONCompletion);

describe('generateMarketInsights', () => {
  const location = 'New York, NY';
  const userId = 'user123';
  const jobId = 'job456';

  const sectionPayloads = {
    [LLM_SECTION_LABELS.marketReportVerdict]: {
      market_report_verdict: { headline: 'Verdict' },
      market_shifts: [{ title: 'A', summary: 'One' }],
    },
    [LLM_SECTION_LABELS.marketReport]: { executive_summary: 'Summary' },
    [LLM_SECTION_LABELS.industryTrends]: { high_growth_sectors: [] },
    [LLM_SECTION_LABELS.newsAndCareerIntel]: { market_news: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTupleCache.mockResolvedValue(null);
    mockRetrieve.mockResolvedValue({ results: [] } as any);
    mockFormatContext.mockReturnValue({ text: 'formatted context' } as any);
    mockMkdir.mockResolvedValue(undefined as any);
    mockWriteFile.mockResolvedValue(undefined as any);
    mockGetSectionCache.mockImplementation(async (_key, section) => ({
      data: sectionPayloads[section as keyof typeof sectionPayloads],
      status: LlmCacheStatus.ACTIVE,
    }));
  });

  it('should generate insights successfully without jobId', async () => {
    const result = await generateMarketInsights(location, userId);

    expect(result.insights).toEqual(
      expect.objectContaining({
        market_report_verdict: expect.objectContaining({ headline: 'Verdict' }),
        market_shifts: [{ title: 'A', summary: 'One' }],
        executive_summary: 'Summary',
        high_growth_sectors: [],
        market_news: [],
        evidence_sources: [],
      }),
    );
    expect(result.failedSections).toEqual([]);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `📊 Starting independent section generation for: ${location}`,
    );
    expect(mockEmitToJob).not.toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
    expect(mockGenerateJson).not.toHaveBeenCalled();
  });

  it('should generate insights successfully with jobId', async () => {
    const result = await generateMarketInsights(location, userId, jobId);

    expect(result.insights).toEqual(
      expect.objectContaining({
        market_report_verdict: expect.objectContaining({ headline: 'Verdict' }),
        market_shifts: [{ title: 'A', summary: 'One' }],
        executive_summary: 'Summary',
        high_growth_sectors: [],
        market_news: [],
        evidence_sources: [],
      }),
    );
    expect(result.failedSections).toEqual([]);
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({ type: 'job_start' }),
    );
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({
        type: 'section_success',
        section: 'marketReportVerdict',
      }),
    );
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({
        type: 'section_success',
        section: 'marketReport',
      }),
    );
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({
        type: 'section_success',
        section: 'industryTrends',
      }),
    );
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({
        type: 'section_success',
        section: 'newsAndCareerIntel',
      }),
    );
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({ type: 'job_complete' }),
    );
  });

  it('should handle partial failures', async () => {
    mockGetSectionCache.mockImplementation(async (_key, section) => {
      if (section === LLM_SECTION_LABELS.industryTrends) return null;
      return {
        data: sectionPayloads[section as keyof typeof sectionPayloads],
        status: LlmCacheStatus.ACTIVE,
      };
    });
    mockGenerateJson.mockImplementation(async (_system, userPrompt) => {
      if (String(userPrompt).includes('industry') || String(userPrompt).toLowerCase().includes('growth')) {
        throw new Error('Error in industry trends');
      }
      return { ok: true };
    });

    // Force industryTrends generation path to fail: no cache + openai throws
    mockGetSectionCache.mockImplementation(async (_key, section) => {
      if (section === LLM_SECTION_LABELS.industryTrends) return null;
      return {
        data: sectionPayloads[section as keyof typeof sectionPayloads],
        status: LlmCacheStatus.ACTIVE,
      };
    });
    mockGenerateJson.mockRejectedValue(new Error('Error in industry trends'));

    const result = await generateMarketInsights(location, userId, jobId);

    expect(result.insights).toEqual(
      expect.objectContaining({
        market_report_verdict: expect.objectContaining({ headline: 'Verdict' }),
        market_shifts: [{ title: 'A', summary: 'One' }],
        executive_summary: 'Summary',
        market_news: [],
        evidence_sources: [],
      }),
    );
    expect(result.failedSections).toEqual(['industryTrends']);
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({ type: 'section_error', section: 'industryTrends' }),
    );
  });

  it('should handle complete failure', async () => {
    mockRetrieve.mockRejectedValue(new Error('Network error'));

    await expect(generateMarketInsights(location, userId, jobId)).rejects.toThrow(
      'Network error',
    );
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({ type: 'job_error' }),
    );
  });

  it('should handle file write failure gracefully', async () => {
    mockWriteFile.mockRejectedValue(new Error('Write error'));

    const result = await generateMarketInsights(location, userId);

    expect(result.insights).toBeDefined();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Failed to write temp file',
      expect.any(Error),
    );
  });

  it('returns tuple cache hit without RAG retrieve', async () => {
    mockGetTupleCache.mockResolvedValue({
      insights: { from_tuple: true },
    } as any);

    const result = await generateMarketInsights(location, userId, jobId);

    expect(result).toEqual({ insights: { from_tuple: true }, failedSections: [] });
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({ type: 'job_complete', insights: { from_tuple: true } }),
    );
  });
});

describe('produceMarketReportVerdict', () => {
  const location = 'New York, NY';

  beforeEach(() => {
    vi.clearAllMocks();
    mockRetrieve.mockResolvedValue({ results: [] } as any);
    mockFormatContext.mockReturnValue({ text: 'formatted context' } as any);
    mockGetSectionCache.mockResolvedValue(null);
    mockUpdateCache.mockResolvedValue(undefined as any);
    mockCacheSection.mockResolvedValue(undefined as any);
  });

  it('returns cached verdict without LLM', async () => {
    mockGetSectionCache.mockResolvedValue({
      status: LlmCacheStatus.ACTIVE,
      data: {
        market_report_verdict: { headline: 'Cached verdict' },
        market_shifts: [{ title: 'A', summary: 'One' }],
      },
    });

    const result = await produceMarketReportVerdict({
      location,
      job: 'PM',
      seniority: 'Senior',
    });

    expect(result).toEqual({
      market_report_verdict: { headline: 'Cached verdict' },
      market_shifts: [{ title: 'A', summary: 'One' }],
    });
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(mockGenerateJson).not.toHaveBeenCalled();
  });

  it('generates and caches verdict when cache misses', async () => {
    mockGenerateJson.mockResolvedValue({
      market_report_verdict: {
        verdict_label: 'Stable market',
        outlook_label: 'Positive 12-month outlook',
        headline: 'Fresh verdict',
        summary: 'Summary',
        signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'High' },
      },
      market_shifts: [
        { title: 'A', summary: 'One' },
        { title: 'B', summary: 'Two' },
        { title: 'C', summary: 'Three' },
      ],
    });

    const result = await produceMarketReportVerdict({
      location,
      locationDistrict: 'Manhattan',
    });

    expect(result).toEqual(
      expect.objectContaining({
        market_report_verdict: expect.objectContaining({ headline: 'Fresh verdict' }),
      }),
    );
    expect(mockRetrieve).toHaveBeenCalled();
    expect(mockGenerateJson).toHaveBeenCalled();
    expect(mockCacheSection).toHaveBeenCalled();
  });
});
