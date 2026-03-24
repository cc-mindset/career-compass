import { LLM_SECTION_LABELS } from "../constants";
import { LlmcacheStatus } from "../constants/db";
import LlmCareerIntel from "../db/models/careerIntel";
import LlmIndustryTrend from "../db/models/industryTrends";
import LlmMarketNews from "../db/models/marketNews";
import LlmMarketReport from "../db/models/marketReport";
import { logger } from "../utils/logger";

export const LLM_RESPONSE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export const getUniqueDbCacheKeyForLlmResponse = (prefix: string, ...vars: string[]): string => {
    return `${prefix}:${vars.join('__')}`;
}

export const getVariablesFromDbCacheKey = (cacheKey: string): string[] => {
    const parts = cacheKey.split(':');
    if (parts.length < 2) {
        logger.warn(`⚠️  Invalid cache key format: ${cacheKey}`);
        return [];
    }
    return parts?.[1]?.split('__');
}

export async function cacheLlmResponseToDb(cacheKey: string, response: Record<string, unknown>, section: typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS]): Promise<void> {
    let result;
    let commonCacheData = {
        vars_id: cacheKey,
        status: LlmcacheStatus.ACTIVE,
        location: getVariablesFromDbCacheKey(cacheKey)?.[0] || '',
    };
    switch (section) {
        case LLM_SECTION_LABELS.marketReport:
            result = await LlmMarketReport.updateOne(
                { vars_id: cacheKey },
                { ...commonCacheData, data: response },
                { upsert: true }
            );
            break;
        case LLM_SECTION_LABELS.industryTrends:
            result = await LlmIndustryTrend.updateOne(
                { vars_id: cacheKey },
                { ...commonCacheData, data: response },
                { upsert: true }
            );
            break;
        case LLM_SECTION_LABELS.newsAndCareerIntel:
            result = await Promise.all([
                LlmMarketNews.updateOne(
                    { vars_id: cacheKey },
                    { ...commonCacheData, data: response.market_news },
                    { upsert: true }
                ),
                LlmCareerIntel.updateOne(
                    { vars_id: cacheKey },
                    {
                        ...commonCacheData, data: {
                            strategies_by_experience: response.strategies_by_experience,
                            key_findings: response.key_findings,
                            report_sources: response.report_sources
                        }
                    },
                    { upsert: true }
                )
            ]);
            break;
        default:
            logger.warn(`⚠️  Unknown section: ${section}`);
            return result;
    }
}

export const getCachedLlmResponseFromDb = async (cacheKey: string, section: typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS]): Promise<Record<string, unknown> | string | null> => {
    let doc;
    switch (section) {
        case LLM_SECTION_LABELS.marketReport:
            doc = await LlmMarketReport.findOne({ vars_id: cacheKey, updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) } }).lean();
            break;
        case LLM_SECTION_LABELS.industryTrends:
            doc = await LlmIndustryTrend.findOne({ vars_id: cacheKey, updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) } }).lean();
            break;
        case LLM_SECTION_LABELS.newsAndCareerIntel:
            let [marketNewsData, careerIntelData] = (await Promise.all([
                LlmMarketNews.findOne({ vars_id: cacheKey, updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) } }).lean(),
                LlmCareerIntel.findOne({ vars_id: cacheKey, updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) } }).lean() 
            ]))?.map(d => d?.data) || null;
            if (marketNewsData || careerIntelData) {
                doc = { data: { market_news: marketNewsData || [], ...careerIntelData } };
            }
            break;
        default:
            logger.warn(`⚠️  Unknown section: ${section}`);
            return null;
    }
    if (!doc) {
        logger.info(`📂 DB Cache MISS for key: ${cacheKey} (section: ${section})`);
        return null;
    }
    logger.info(`📂 DB Cache HIT for key: ${cacheKey} (section: ${section})`);
    return doc?.data as Record<string, unknown>;
}