import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LlmCacheStatus } from '../../constants/db';
import EcoSimulator from '../../db/models/ecoSimulator';
import { logger } from '../../utils/logger.js';
import { emitToJob } from '../../lib/websocket.js';
import { generateSingleResponse } from '../llmService';
import { getFormattedContext } from '../ragService';
import { SYSTEM_PROMPT } from '../market-insights/marketInsightsService_multipart';
import { generateAndCacheEcoSimulatorData, getEcoSimulatorDataPrompt } from './ecoSimulatorService';

vi.mock('../../db/models/ecoSimulator', () => ({
  default: {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../lib/websocket.js', () => ({
  emitToJob: vi.fn(),
}));

vi.mock('../llmService', () => ({
  generateSingleResponse: vi.fn(),
}));

vi.mock('../ragService', () => ({
  getFormattedContext: vi.fn(),
}));

vi.mock('../../lib/redisQueue', () => ({
  enqueueJob: vi.fn(),
}));

const mockFindOne = vi.mocked(EcoSimulator.findOne);
const mockUpdateOne = vi.mocked(EcoSimulator.updateOne);
const mockEmitToJob = vi.mocked(emitToJob);
const mockGenerateSingleResponse = vi.mocked(generateSingleResponse);
const mockGetFormattedContext = vi.mocked(getFormattedContext);
const mockLoggerError = vi.mocked(logger.error);

const location = 'San Francisco, CA';
const currentJobTitle = 'Product Manager';
const seniorityLevel = 'Mid';
const jobId = 'job-123';
const cacheKey = 'san francisco, ca_product manager_mid';

const activeCachedData = {
  layoff_chances_formula: 'formula-a',
  career_demand_formula: 'formula-b',
  career_growth_opportunities_formula: 'formula-c',
  salary_increment_formula: 'formula-d',
  simulation_insights: ['cached insights', 'cached insights'],
  tips: 'cached tips',
};

const mockLeanFind = (doc: unknown) => {
  mockFindOne.mockReturnValue({
    lean: vi.fn().mockResolvedValue(doc),
  } as any);
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.GLOBAL_USE_RAG;
});

afterEach(() => {
  delete process.env.GLOBAL_USE_RAG;
});

describe('generateAndCacheEcoSimulatorData', () => {
  it('returns active cached data and emits progress when jobId is present', async () => {
    mockLeanFind({
      status: LlmCacheStatus.ACTIVE,
      data: activeCachedData,
      updatedAt: new Date(),
    });

    const result = await generateAndCacheEcoSimulatorData(
      location,
      currentJobTitle,
      seniorityLevel,
      jobId,
    );

    expect(result).toEqual(activeCachedData);
    expect(mockUpdateOne).not.toHaveBeenCalled();
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({ type: 'job_start' }),
    );
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({
        type: 'section_in_progress',
        section: 'ecoSimulator',
        data: activeCachedData,
      }),
    );
  });

  it('returns updating cached data and emits progress when stale update is in progress', async () => {
    mockLeanFind({
      status: LlmCacheStatus.UPDATING,
      data: activeCachedData,
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    mockUpdateOne.mockResolvedValue({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null,
    } as any);
    mockGenerateSingleResponse.mockResolvedValue(activeCachedData as any);

    const result = await generateAndCacheEcoSimulatorData(
      location,
      currentJobTitle,
      seniorityLevel,
      jobId,
    );

    expect(result).toEqual({ ...activeCachedData, isRemaining: true });
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({
        type: 'section_in_progress',
        section: 'ecoSimulator',
        data: activeCachedData,
      }),
    );
  });

  it('generates new data without RAG, caches it, and completes the job', async () => {
    mockLeanFind(null);
    mockUpdateOne.mockResolvedValue({
      acknowledged: false,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null,
    } as any);
    const llmResponse = {
      layoff_chances_formula: 'generated-a',
      career_demand_formula: 'generated-b',
      career_growth_opportunities_formula: 'generated-c',
      salary_increment_formula: 'generated-d',
      simulation_insights: ['generated insights', 'cached insights'],
      tips: 'generated tips',
    } as any;
    mockGenerateSingleResponse.mockResolvedValue(llmResponse);

    const result = await generateAndCacheEcoSimulatorData(
      location,
      currentJobTitle,
      seniorityLevel,
      jobId,
    );

    expect(mockGetFormattedContext).not.toHaveBeenCalled();
    expect(mockGenerateSingleResponse).toHaveBeenCalledWith(
      SYSTEM_PROMPT,
      '',
      expect.any(String),
      'json',
      3,
    );
    expect(mockUpdateOne).toHaveBeenCalled();
    expect(result).toEqual(llmResponse);
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({ type: 'job_complete', data: llmResponse }),
    );
  });

  it('builds the eco simulator prompt with exact formula variable requirements', () => {
    const prompt = getEcoSimulatorDataPrompt(location, currentJobTitle, seniorityLevel);

    expect(prompt).toContain('aiImpact');
    expect(prompt).toContain('aiTechAdvancement');
    expect(prompt).toContain('upskillSpeed');
    expect(prompt).toContain('globalInstabilityLevels');
    expect(prompt).not.toContain('marketDemand');
    expect(prompt).toContain('JavaScript formula string');
    expect(prompt).toContain('Return ONLY valid JSON with NO markdown formatting.');
  });

  it('uses RAG when GLOBAL_USE_RAG is true', async () => {
    process.env.GLOBAL_USE_RAG = 'true';
    mockLeanFind(null);
    mockUpdateOne.mockResolvedValue({
      acknowledged: false,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null,
    } as any);
    mockGetFormattedContext.mockResolvedValue('rag context');

    const llmResponse = {
      layoff_chances_formula: 'generated-a',
      career_demand_formula: 'generated-b',
      career_growth_opportunities_formula: 'generated-c',
      salary_increment_formula: 'generated-d',
      simulation_insights: ['generated insights', 'cached insights'],
      tips: 'generated tips',
    } as any;
    mockGenerateSingleResponse.mockResolvedValue(llmResponse);

    const result = await generateAndCacheEcoSimulatorData(
      location,
      currentJobTitle,
      seniorityLevel,
    );

    expect(mockGetFormattedContext).toHaveBeenCalledWith(
      expect.objectContaining({
        useCache: true,
        cacheKey: `eco_simulator_context_${location}_${currentJobTitle}_${seniorityLevel}`,
        retrievalQuery: expect.stringContaining(
          'Context for eco simulator generation for ' +
            location +
            ', ' +
            currentJobTitle +
            ', ' +
            seniorityLevel,
        ),
        namespaces: ['eco-data'],
        topKPerNamespace: { 'eco-data': 10 },
      }),
      expect.stringContaining('You are an economic simulator'),
    );
    expect(mockGenerateSingleResponse).toHaveBeenCalledWith(
      SYSTEM_PROMPT,
      'rag context',
      expect.any(String),
      'json',
      3,
    );
    expect(result).toEqual(llmResponse);
  });

  it('returns fallback data and emits job_error when LLM generation fails', async () => {
    mockLeanFind(null);
    mockUpdateOne.mockResolvedValue({
      acknowledged: false,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null,
    } as any);
    mockGenerateSingleResponse.mockRejectedValue(new Error('LLM failure'));

    const result = await generateAndCacheEcoSimulatorData(
      location,
      currentJobTitle,
      seniorityLevel,
      jobId,
    );

    expect(result.simulation_insights[0]).toContain('Fallback');
    expect(result.tips).toContain('Fallback');
    expect(mockLoggerError).toHaveBeenCalled();
    expect(mockEmitToJob).toHaveBeenCalledWith(
      jobId,
      'progress',
      expect.objectContaining({
        type: 'job_error',
        error: 'Failed to generate eco simulator data, using fallback',
      }),
    );
  });
});
