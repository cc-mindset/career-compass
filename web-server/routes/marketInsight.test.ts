import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/redisQueue.js', () => ({
  enqueueJob: vi.fn(),
  getJobResult: vi.fn(),
  getQueueLength: vi.fn(),
}));

vi.mock('../services/market-insights/marketInsightsService_multipart.js', () => ({
  generateMarketInsights: vi.fn(),
}));

vi.mock('../utils/city.js', () => ({
  getTopCityOfDistrictOfACity: vi.fn(() => ({
    locationCity: 'Toronto',
    locationDistrict: 'Downtown',
  })),
}));

vi.mock('../services/db-cache/dbCacheService.js', () => ({
  getCachedMarketInsightsFromDb: vi.fn(),
}));

import { enqueueJob, getQueueLength } from '../lib/redisQueue.js';
import { generateMarketInsights } from '../services/market-insights/marketInsightsService_multipart.js';
import { getCachedMarketInsightsFromDb } from '../services/db-cache/dbCacheService.js';
import marketInsightRouter from './marketInsight.js';

const mockEnqueue = enqueueJob as ReturnType<typeof vi.fn>;
const mockQueueLength = getQueueLength as ReturnType<typeof vi.fn>;
const mockGenerate = generateMarketInsights as ReturnType<typeof vi.fn>;
const mockCache = getCachedMarketInsightsFromDb as ReturnType<typeof vi.fn>;

const app = express();
app.use(express.json());
app.use('/api/market-insights', marketInsightRouter);

describe('POST /api/market-insights/generate response branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cache-hit insights with fromCache', async () => {
    mockCache.mockResolvedValue({
      insights: { market_report_summary_brief: 'Cached brief' },
    });

    const res = await request(app)
      .post('/api/market-insights/generate')
      .send({
        location: 'Toronto, Canada',
        job: 'Product Manager',
        seniority: 'Senior',
        industry: 'Technology',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      fromCache: true,
      insights: { market_report_summary_brief: 'Cached brief' },
    });
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('returns queued shape when Redis enqueue succeeds', async () => {
    mockCache.mockResolvedValue(null);
    mockEnqueue.mockResolvedValue('job-abc-123');
    mockQueueLength.mockResolvedValue(2);

    const res = await request(app)
      .post('/api/market-insights/generate')
      .send({
        location: 'Toronto, Canada',
        job: 'Product Manager',
        seniority: 'Senior',
        industry: 'Financial Services',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      queued: true,
      jobId: 'job-abc-123',
      position: 2,
      message: 'Request queued for processing',
    });
    expect(mockEnqueue).toHaveBeenCalledWith(
      'Toronto, Canada',
      '',
      'Downtown',
      'Product Manager',
      'Senior',
      'Financial Services',
    );
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('returns sync insights when Redis enqueue returns null', async () => {
    mockCache.mockResolvedValue(null);
    mockEnqueue.mockResolvedValue(null);
    mockGenerate.mockResolvedValue({
      insights: { market_report_summary_brief: 'Sync brief', growth_sectors: [] },
      failedSections: [],
    });

    const res = await request(app)
      .post('/api/market-insights/generate')
      .send({
        location: 'Toronto, Canada',
        userId: 'guest',
        job: 'Product Manager',
        seniority: 'Senior',
        industry: 'Technology',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.queued).toBeUndefined();
    expect(res.body.insights).toEqual({
      market_report_summary_brief: 'Sync brief',
      growth_sectors: [],
    });
    expect(mockGenerate).toHaveBeenCalledWith(
      'Toronto, Canada',
      'guest',
      '',
      'Downtown',
      'Product Manager',
      'Senior',
      'Technology',
    );
  });

  it('accepts requests without industry (backward compatible)', async () => {
    mockCache.mockResolvedValue(null);
    mockEnqueue.mockResolvedValue('job-no-industry');
    mockQueueLength.mockResolvedValue(1);

    const res = await request(app)
      .post('/api/market-insights/generate')
      .send({ location: 'Toronto, Canada' });

    expect(res.status).toBe(200);
    expect(res.body.queued).toBe(true);
    expect(mockEnqueue).toHaveBeenCalledWith(
      'Toronto, Canada',
      '',
      'Downtown',
      undefined,
      undefined,
      undefined,
    );
  });
});
