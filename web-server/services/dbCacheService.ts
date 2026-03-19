import { LLM_SECTION_LABELS } from "../constants";
import { LlmcacheStatus } from "../constants/db";
import LlmCareerIntel from "../db/models/careerIntel";
import LlmIndustryTrend from "../db/models/industryTrends";
import LlmMarketNews from "../db/models/marketNews";
import LlmMarketReport from "../db/models/marketReport";
import { logger } from "../utils/logger";

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