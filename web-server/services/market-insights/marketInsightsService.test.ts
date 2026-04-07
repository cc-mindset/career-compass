import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../ragService.js');
vi.mock('../../utils/logger.js');
vi.mock('../../lib/websocket.js');
vi.mock('fs/promises');
vi.mock('path');

import { generateMarketInsights } from './marketInsightsService_multipart.js';
import { generateMultipleWithSharedContext } from '../ragService.js';
import { logger } from '../../utils/logger.js';
import { emitToJob } from '../../lib/websocket.js';
import { writeFile } from 'fs/promises';
import path from 'path';

const mockGenerateMultipleWithSharedContext = generateMultipleWithSharedContext as any;
const mockLoggerInfo = logger.info as any;
const mockLoggerWarn = logger.warn as any;
const mockEmitToJob = emitToJob as any;
const mockWriteFile = writeFile as any;
const mockPathJoin = path.join as any;

describe('generateMarketInsights', () => {
  const location = 'New York, NY';
  const userId = 'user123';
  const jobId = 'job456';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathJoin.mockReturnValue('/temp/path/insights.json');
  });

  it('should generate insights successfully without jobId', async () => {
    const mockResults = {
      marketReport: { executive_summary: 'Summary' },
      industryTrends: { high_growth_sectors: [] },
      newsAndCareerIntel: { market_news: [] },
    };
    mockGenerateMultipleWithSharedContext.mockImplementation(async (_systemPrompt: any, _queries: any, options: any) => {
      options.onSectionComplete('marketReport', mockResults.marketReport);
      options.onSectionComplete('industryTrends', mockResults.industryTrends);
      options.onSectionComplete('newsAndCareerIntel', mockResults.newsAndCareerIntel);
      return mockResults;
    });

    const result = await generateMarketInsights(location, userId);

    expect(result.insights).toEqual({
      executive_summary: 'Summary',
      high_growth_sectors: [],
      market_news: [],
    });
    expect(result.failedSections).toEqual([]);
    expect(mockLoggerInfo).toHaveBeenCalledWith(`📊 Starting independent section generation for: ${location}`);
    expect(mockEmitToJob).not.toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith('/temp/path/insights.json', JSON.stringify(result.insights, null, 2), 'utf8');
  });

  it('should generate insights successfully with jobId', async () => {
    const mockResults = {
      marketReport: { executive_summary: 'Summary' },
      industryTrends: { high_growth_sectors: [] },
      newsAndCareerIntel: { market_news: [] },
    };
    mockGenerateMultipleWithSharedContext.mockImplementation(async (_systemPrompt: any, _queries: any, options: any) => {
      options.onSectionComplete('marketReport', mockResults.marketReport);
      options.onSectionComplete('industryTrends', mockResults.industryTrends);
      options.onSectionComplete('newsAndCareerIntel', mockResults.newsAndCareerIntel);
      return mockResults;
    });

    const result = await generateMarketInsights(location, userId, jobId);

    expect(result.insights).toEqual({
      executive_summary: 'Summary',
      high_growth_sectors: [],
      market_news: [],
    });
    expect(result.failedSections).toEqual([]);
    expect(mockEmitToJob).toHaveBeenCalledWith(jobId, 'progress', expect.objectContaining({ type: 'job_start' }));
    expect(mockEmitToJob).toHaveBeenCalledWith(jobId, 'progress', expect.objectContaining({ type: 'section_success', section: 'marketReport' }));
    expect(mockEmitToJob).toHaveBeenCalledWith(jobId, 'progress', expect.objectContaining({ type: 'section_success', section: 'industryTrends' }));
    expect(mockEmitToJob).toHaveBeenCalledWith(jobId, 'progress', expect.objectContaining({ type: 'section_success', section: 'newsAndCareerIntel' }));
    expect(mockEmitToJob).toHaveBeenCalledWith(jobId, 'progress', expect.objectContaining({ type: 'job_complete' }));
  });

  it('should handle partial failures', async () => {
    const mockResults = {
      marketReport: { executive_summary: 'Summary' },
      industryTrends: null, // Simulate failure
      newsAndCareerIntel: { market_news: [] },
    };
    mockGenerateMultipleWithSharedContext.mockImplementation(async (_systemPrompt: any, _queries: any, options: any) => {
      options.onSectionComplete('marketReport', mockResults.marketReport);
      options.onSectionComplete('industryTrends', null, 'Error in industry trends');
      options.onSectionComplete('newsAndCareerIntel', mockResults.newsAndCareerIntel);
      return mockResults;
    });

    const result = await generateMarketInsights(location, userId, jobId);

    expect(result.insights).toEqual({
      executive_summary: 'Summary',
      market_news: [],
    });
    expect(result.failedSections).toEqual(['industryTrends']);
    expect(mockEmitToJob).toHaveBeenCalledWith(jobId, 'progress', expect.objectContaining({ type: 'section_error', section: 'industryTrends' }));
  });

  it('should handle complete failure', async () => {
    mockGenerateMultipleWithSharedContext.mockRejectedValue(new Error('Network error'));

    await expect(generateMarketInsights(location, userId, jobId)).rejects.toThrow('Network error');
    expect(mockEmitToJob).toHaveBeenCalledWith(jobId, 'progress', expect.objectContaining({ type: 'job_error' }));
  });

  it('should handle file write failure gracefully', async () => {
    const mockResults = {
      marketReport: { executive_summary: 'Summary' },
      industryTrends: { high_growth_sectors: [] },
      newsAndCareerIntel: { market_news: [] },
    };
    mockGenerateMultipleWithSharedContext.mockImplementation(async (_systemPrompt: any, _queries: any, options: any) => {
      options.onSectionComplete('marketReport', mockResults.marketReport);
      options.onSectionComplete('industryTrends', mockResults.industryTrends);
      options.onSectionComplete('newsAndCareerIntel', mockResults.newsAndCareerIntel);
      return mockResults;
    });
    mockWriteFile.mockRejectedValue(new Error('Write error'));

    const result = await generateMarketInsights(location, userId);

    expect(result.insights).toBeDefined();
    expect(mockLoggerWarn).toHaveBeenCalledWith('Failed to write temp file', expect.any(Error));
  });
});