import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getUniqueDbCacheKeyForLlmResponse,
    getVariablesFromDbCacheKey,
    cacheLlmResponseToDb,
    updateCacheResponseInDb,
    getCachedLlmResponseFromDb,
    LLM_RESPONSE_EXPIRATION_MS
} from './dbCacheService';
import { LLM_SECTION_LABELS } from '../../constants';
import { LlmCacheStatus } from '../../constants/db';

// Mock the models
vi.mock('../../db/models/marketReport', () => ({
    default: {
        updateOne: vi.fn(),
        findOne: vi.fn()
    }
}));

vi.mock('../../db/models/industryTrends', () => ({
    default: {
        updateOne: vi.fn(),
        findOne: vi.fn()
    }
}));

vi.mock('../../db/models/marketNews', () => ({
    default: {
        updateOne: vi.fn(),
        findOne: vi.fn()
    }
}));

vi.mock('../../db/models/careerIntel', () => ({
    default: {
        updateOne: vi.fn(),
        findOne: vi.fn()
    }
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
    logger: {
        warn: vi.fn(),
        info: vi.fn()
    }
}));

import LlmMarketReport from '../../db/models/marketReport';
import LlmIndustryTrend from '../../db/models/industryTrends';
import LlmMarketNews from '../../db/models/marketNews';
import LlmCareerIntel from '../../db/models/careerIntel';
import { logger } from '../../utils/logger';
import { UpdateWriteOpResult } from 'mongoose';

describe('dbCacheService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('getUniqueDbCacheKeyForLlmResponse', () => {
        it('should create a cache key with prefix and joined variables', () => {
            const result = getUniqueDbCacheKeyForLlmResponse('testPrefix', 'var1', 'var2', 'var3');
            expect(result).toBe('testPrefix:var1__var2__var3');
        });

        it('should handle single variable', () => {
            const result = getUniqueDbCacheKeyForLlmResponse('prefix', 'singleVar');
            expect(result).toBe('prefix:singleVar');
        });

        it('should handle empty variables array', () => {
            const result = getUniqueDbCacheKeyForLlmResponse('prefix');
            expect(result).toBe('prefix:');
        });
    });

    describe('getVariablesFromDbCacheKey', () => {
        it('should extract variables from cache key', () => {
            const result = getVariablesFromDbCacheKey('prefix:var1__var2__var3');
            expect(result).toStrictEqual(['var1', 'var2', 'var3']);
        });

        it('should handle single variable', () => {
            const result = getVariablesFromDbCacheKey('prefix:singleVar');
            expect(result).toStrictEqual(['singleVar']);
        });

        it('should return empty array for invalid format', () => {
            const result = getVariablesFromDbCacheKey('invalidFormat');
            expect(result).toStrictEqual([]);
            expect(logger.warn).toHaveBeenCalledWith('⚠️  Invalid cache key format: invalidFormat');
        });

        it('should handle empty variables part', () => {
            const result = getVariablesFromDbCacheKey('prefix:');
            expect(result).toStrictEqual(['']);
        });
    });

    describe('cacheLlmResponseToDb', () => {
        const mockCacheKey = 'testKey:location__param1';
        const mockResponse = { test: 'data' };

        it('should cache market report data', async () => {
            const mockUpdateResult: UpdateWriteOpResult = {
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0,
                upsertedCount: 0,
                upsertedId: null
            };
            vi.mocked(LlmMarketReport.updateOne).mockResolvedValue(mockUpdateResult);

            await cacheLlmResponseToDb(mockCacheKey, mockResponse, LLM_SECTION_LABELS.marketReport);

            expect(LlmMarketReport.updateOne).toHaveBeenCalledWith(
                { vars_id: mockCacheKey },
                {
                    vars_id: mockCacheKey,
                    status: LlmCacheStatus.ACTIVE,
                    location: 'location',
                    data: mockResponse
                },
                { upsert: true }
            );
        });

        it('should cache industry trends data', async () => {
            const mockUpdateResult: UpdateWriteOpResult = {
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0,
                upsertedCount: 0,
                upsertedId: null
            };
            vi.mocked(LlmIndustryTrend.updateOne).mockResolvedValue(mockUpdateResult);

            await cacheLlmResponseToDb(mockCacheKey, mockResponse, LLM_SECTION_LABELS.industryTrends);

            expect(LlmIndustryTrend.updateOne).toHaveBeenCalledWith(
                { vars_id: mockCacheKey },
                {
                    vars_id: mockCacheKey,
                    status: LlmCacheStatus.ACTIVE,
                    location: 'location',
                    data: mockResponse
                },
                { upsert: true }
            );
        });

        it('should cache news and career intel data', async () => {
            const mockResponseWithSections = {
                market_news: ['news1', 'news2'],
                strategies_by_experience: 'strategies',
                key_findings: 'findings',
                report_sources: 'sources'
            };
            const mockUpdateResult: UpdateWriteOpResult = {
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0,
                upsertedCount: 0,
                upsertedId: null
            };
            vi.mocked(LlmMarketNews.updateOne).mockResolvedValue(mockUpdateResult);
            vi.mocked(LlmCareerIntel.updateOne).mockResolvedValue(mockUpdateResult);

            await cacheLlmResponseToDb(mockCacheKey, mockResponseWithSections, LLM_SECTION_LABELS.newsAndCareerIntel);

            expect(LlmMarketNews.updateOne).toHaveBeenCalledWith(
                { vars_id: mockCacheKey },
                {
                    vars_id: mockCacheKey,
                    status: LlmCacheStatus.ACTIVE,
                    location: 'location',
                    data: mockResponseWithSections.market_news
                },
                { upsert: true }
            );

            expect(LlmCareerIntel.updateOne).toHaveBeenCalledWith(
                { vars_id: mockCacheKey },
                {
                    vars_id: mockCacheKey,
                    status: LlmCacheStatus.ACTIVE,
                    location: 'location',
                    data: {
                        strategies_by_experience: mockResponseWithSections.strategies_by_experience,
                        key_findings: mockResponseWithSections.key_findings,
                        report_sources: mockResponseWithSections.report_sources
                    }
                },
                { upsert: true }
            );
        });

        it('should log warning for unknown section', async () => {
            await cacheLlmResponseToDb(mockCacheKey, mockResponse, 'unknown' as any);

            expect(logger.warn).toHaveBeenCalledWith('⚠️  Unknown section: unknown');
        });
    });

    describe('updateCacheResponseInDb', () => {
        const mockCacheKey = 'testKey:location__param1';

        it('should update market report status to UPDATING', async () => {
            const mockUpdateResult: UpdateWriteOpResult = {
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0,
                upsertedCount: 0,
                upsertedId: null
            };
            vi.mocked(LlmMarketReport.updateOne).mockResolvedValue(mockUpdateResult);

            await updateCacheResponseInDb(mockCacheKey, LLM_SECTION_LABELS.marketReport);

            expect(LlmMarketReport.updateOne).toHaveBeenCalledWith(
                { vars_id: mockCacheKey },
                {
                    vars_id: mockCacheKey,
                    status: LlmCacheStatus.UPDATING,
                    location: 'location'
                },
                { upsert: true }
            );
        });

        it('should update industry trends status to UPDATING', async () => {
            const mockUpdateResult: UpdateWriteOpResult = {
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0,
                upsertedCount: 0,
                upsertedId: null
            };
            vi.mocked(LlmIndustryTrend.updateOne).mockResolvedValue(mockUpdateResult);

            await updateCacheResponseInDb(mockCacheKey, LLM_SECTION_LABELS.industryTrends);

            expect(LlmIndustryTrend.updateOne).toHaveBeenCalledWith(
                { vars_id: mockCacheKey },
                {
                    vars_id: mockCacheKey,
                    status: LlmCacheStatus.UPDATING,
                    location: 'location'
                },
                { upsert: true }
            );
        });

        it('should update news and career intel status to UPDATING', async () => {
            const mockUpdateResult: UpdateWriteOpResult = {
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0,
                upsertedCount: 0,
                upsertedId: null
            };
            vi.mocked(LlmMarketNews.updateOne).mockResolvedValue(mockUpdateResult);
            vi.mocked(LlmCareerIntel.updateOne).mockResolvedValue(mockUpdateResult);

            await updateCacheResponseInDb(mockCacheKey, LLM_SECTION_LABELS.newsAndCareerIntel);

            expect(LlmMarketNews.updateOne).toHaveBeenCalledWith(
                { vars_id: mockCacheKey },
                {
                    vars_id: mockCacheKey,
                    status: LlmCacheStatus.UPDATING,
                    location: 'location'
                },
                { upsert: true }
            );

            expect(LlmCareerIntel.updateOne).toHaveBeenCalledWith(
                { vars_id: mockCacheKey },
                {
                    vars_id: mockCacheKey,
                    status: LlmCacheStatus.UPDATING,
                    location: 'location'
                },
                { upsert: true }
            );
        });

        it('should log warning for unknown section', async () => {
            await updateCacheResponseInDb(mockCacheKey, 'unknown' as any);

            expect(logger.warn).toHaveBeenCalledWith('⚠️  Unknown section: unknown');
        });
    });

    describe('getCachedLlmResponseFromDb', () => {
        const mockCacheKey = 'testKey:location__param1';
        const mockDate = new Date('2024-01-01T00:00:00Z');
        const recentDate = new Date(Date.now() - (12 * 60 * 60 * 1000)); // 12 hours ago

        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(mockDate);
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return market report data when found and not expired', async () => {
            const mockDoc = {
                data: { report: 'data' },
                status: LlmCacheStatus.ACTIVE,
                updatedAt: recentDate
            };
            const mockQuery = {
                lean: vi.fn().mockResolvedValue(mockDoc)
            };
            vi.mocked(LlmMarketReport.findOne).mockReturnValue(mockQuery as any);

            const result = await getCachedLlmResponseFromDb(mockCacheKey, LLM_SECTION_LABELS.marketReport);

            expect(result).toEqual(mockDoc);
            expect(LlmMarketReport.findOne).toHaveBeenCalledWith({
                vars_id: mockCacheKey,
                updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) }
            });
            expect(mockQuery.lean).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(`📂 DB Cache HIT for key: ${mockCacheKey} (section: ${LLM_SECTION_LABELS.marketReport})`);
        });

        it('should return industry trends data when found and not expired', async () => {
            const mockDoc = {
                data: { trends: 'data' },
                status: LlmCacheStatus.ACTIVE,
                updatedAt: recentDate
            };
            const mockQuery = {
                lean: vi.fn().mockResolvedValue(mockDoc)
            };
            vi.mocked(LlmIndustryTrend.findOne).mockReturnValue(mockQuery as any);

            const result = await getCachedLlmResponseFromDb(mockCacheKey, LLM_SECTION_LABELS.industryTrends);

            expect(result).toEqual(mockDoc);
            expect(LlmIndustryTrend.findOne).toHaveBeenCalledWith({
                vars_id: mockCacheKey,
                updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) }
            });
            expect(mockQuery.lean).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(`📂 DB Cache HIT for key: ${mockCacheKey} (section: ${LLM_SECTION_LABELS.industryTrends})`);
        });

        it('should return combined news and career intel data', async () => {
            const mockMarketNews = {
                data: ['news1', 'news2'],
                status: LlmCacheStatus.ACTIVE,
                updatedAt: recentDate
            };
            const mockCareerIntel = {
                data: {
                    strategies_by_experience: 'strategies',
                    key_findings: 'findings',
                    report_sources: 'sources'
                },
                status: LlmCacheStatus.ACTIVE,
                updatedAt: recentDate
            };

            const mockMarketNewsQuery = {
                lean: vi.fn().mockResolvedValue(mockMarketNews)
            };
            const mockCareerIntelQuery = {
                lean: vi.fn().mockResolvedValue(mockCareerIntel)
            };

            vi.mocked(LlmMarketNews.findOne).mockReturnValue(mockMarketNewsQuery as any);
            vi.mocked(LlmCareerIntel.findOne).mockReturnValue(mockCareerIntelQuery as any);

            const result = await getCachedLlmResponseFromDb(mockCacheKey, LLM_SECTION_LABELS.newsAndCareerIntel);

            expect(result).toEqual({
                data: {
                    market_news: mockMarketNews.data,
                    strategies_by_experience: mockCareerIntel.data.strategies_by_experience,
                    key_findings: mockCareerIntel.data.key_findings,
                    report_sources: mockCareerIntel.data.report_sources
                },
                status: LlmCacheStatus.ACTIVE
            });
            expect(LlmMarketNews.findOne).toHaveBeenCalledWith({
                vars_id: mockCacheKey,
                updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) }
            });
            expect(LlmCareerIntel.findOne).toHaveBeenCalledWith({
                vars_id: mockCacheKey,
                updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) }
            });
            expect(mockMarketNewsQuery.lean).toHaveBeenCalled();
            expect(mockCareerIntelQuery.lean).toHaveBeenCalled();
        });

        it('should return null when no data found', async () => {
            const mockQuery = {
                lean: vi.fn().mockResolvedValue(null)
            };
            vi.mocked(LlmMarketReport.findOne).mockReturnValue(mockQuery as any);

            const result = await getCachedLlmResponseFromDb(mockCacheKey, LLM_SECTION_LABELS.marketReport);

            expect(result).toBeNull();
            expect(LlmMarketReport.findOne).toHaveBeenCalledWith({
                vars_id: mockCacheKey,
                updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) }
            });
            expect(mockQuery.lean).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(`📂 DB Cache MISS for key: ${mockCacheKey} (section: ${LLM_SECTION_LABELS.marketReport})`);
        });

        it('should skip expiration check when isSkipExpireCheck is true', async () => {
            const mockDoc = {
                data: { report: 'data' },
                status: LlmCacheStatus.ACTIVE,
                updatedAt: new Date('2020-01-01') // Very old date
            };
            const mockQuery = {
                lean: vi.fn().mockResolvedValue(mockDoc)
            };
            vi.mocked(LlmMarketReport.findOne).mockReturnValue(mockQuery as any);

            const result = await getCachedLlmResponseFromDb(mockCacheKey, LLM_SECTION_LABELS.marketReport, true);

            expect(result).toEqual(mockDoc);
            expect(LlmMarketReport.findOne).toHaveBeenCalledWith({
                vars_id: mockCacheKey
            });
            expect(mockQuery.lean).toHaveBeenCalled();
        });

        it('should handle combined status for news and career intel', async () => {
            const mockMarketNews = {
                data: ['news1'],
                status: LlmCacheStatus.UPDATING,
                updatedAt: recentDate
            };
            const mockCareerIntel = {
                data: { strategies_by_experience: 'strategies' },
                status: LlmCacheStatus.ACTIVE,
                updatedAt: recentDate
            };

            const mockMarketNewsQuery = {
                lean: vi.fn().mockResolvedValue(mockMarketNews)
            };
            const mockCareerIntelQuery = {
                lean: vi.fn().mockResolvedValue(mockCareerIntel)
            };

            vi.mocked(LlmMarketNews.findOne).mockReturnValue(mockMarketNewsQuery as any);
            vi.mocked(LlmCareerIntel.findOne).mockReturnValue(mockCareerIntelQuery as any);

            const result = await getCachedLlmResponseFromDb(mockCacheKey, LLM_SECTION_LABELS.newsAndCareerIntel);

            expect(result?.status).toBe(LlmCacheStatus.UPDATING); // UPDATING takes precedence
            expect(LlmMarketNews.findOne).toHaveBeenCalledWith({
                vars_id: mockCacheKey,
                updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) }
            });
            expect(LlmCareerIntel.findOne).toHaveBeenCalledWith({
                vars_id: mockCacheKey,
                updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) }
            });
            expect(mockMarketNewsQuery.lean).toHaveBeenCalled();
            expect(mockCareerIntelQuery.lean).toHaveBeenCalled();
        });

        it('should log warning for unknown section', async () => {
            const result = await getCachedLlmResponseFromDb(mockCacheKey, 'unknown' as any);

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalledWith('⚠️  Unknown section: unknown');
        });
    });
});