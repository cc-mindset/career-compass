import { LLM_SECTION_LABELS } from "../../constants";
import { LlmCacheStatus } from "../../constants/db";
import LlmCareerIntel from "../../db/models/careerIntel";
import LlmEvidenceSources from "../../db/models/evidenceSources";
import LlmIndustryTrend from "../../db/models/industryTrends";
import LlmMarketNews from "../../db/models/marketNews";
import LlmMarketReport from "../../db/models/marketReport";
import LlmMarketReportVerdict from "../../db/models/marketReportVerdict";
import { CareerIntelData } from "../../types/careerIntel";
import { EvidenceSource } from "../../types/evidence";
import { MarketNewsData } from "../../types/marketNews";
import { getDistrictOfACity } from "../../utils/city";
import { logger } from "../../utils/logger";
import { normalizeMarketReportVerdict } from "../market-insights/normalizeMarketReportVerdict";

export const LLM_RESPONSE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const normalizeCachePart = (value?: string): string =>
    (value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/\s*,\s*/g, ", ")
        .trim();

const normalizeSeniorityCachePart = (value?: string): string =>
    normalizeCachePart(value)
        .replace(/\s*\([^)]*\)\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export const getUniqueDbCacheKeyForLlmResponse = (prefix: string, ...vars: string[]): string => {
    return `${prefix}:${vars.join('__')}`;
}

export const getMarketInsightsCacheKey = (location: string, job?: string, seniority?: string): string => {
    return getUniqueDbCacheKeyForLlmResponse(
        'rag',
        normalizeCachePart(location),
        normalizeCachePart(job),
        normalizeSeniorityCachePart(seniority),
    );
};

export const getCachedMarketInsightsFromDb = async (
    location: string,
    job?: string,
    seniority?: string,
) => {
    const cacheKey = getMarketInsightsCacheKey(location, job, seniority);
    const [marketReportVerdict, marketReport, industryTrends, newsAndCareerIntel, evidenceSources] =
        await Promise.all([
            getCachedLlmResponseFromDb(cacheKey, LLM_SECTION_LABELS.marketReportVerdict),
            getCachedLlmResponseFromDb(cacheKey, LLM_SECTION_LABELS.marketReport),
            getCachedLlmResponseFromDb(cacheKey, LLM_SECTION_LABELS.industryTrends),
            getCachedLlmResponseFromDb(cacheKey, LLM_SECTION_LABELS.newsAndCareerIntel),
            getCachedEvidenceSourcesFromDb(cacheKey),
        ]);

    if (
        !marketReportVerdict ||
        !marketReport ||
        !industryTrends ||
        !newsAndCareerIntel ||
        marketReportVerdict.status !== LlmCacheStatus.ACTIVE ||
        marketReport.status !== LlmCacheStatus.ACTIVE ||
        industryTrends.status !== LlmCacheStatus.ACTIVE ||
        newsAndCareerIntel.status !== LlmCacheStatus.ACTIVE
    ) {
        return null;
    }

    // evidenceSources is intentionally NOT part of the hit/miss gate above:
    // it's a deterministic add-on, not one of the three LLM sections. A
    // cache entry written before this existed should still hit — it just
    // renders an empty Evidence tab instead of forcing a full regeneration.
    return {
        cacheKey,
        insights: normalizeMarketReportVerdict({
            ...(marketReport.data || {}),
            ...(marketReportVerdict.data || {}),
            ...(industryTrends.data || {}),
            ...(newsAndCareerIntel.data || {}),
            evidence_sources: evidenceSources,
        }),
    };
};

/**
 * Persist the deterministic evidence-source list for a generation, keyed by
 * the same cache key as the LLM sections. See db/models/evidenceSources.ts
 * for why this is a separate collection rather than bolted onto a section.
 */
export async function cacheEvidenceSourcesToDb(
    cacheKey: string,
    sources: EvidenceSource[],
    region = "",
): Promise<void> {
    const locationToCache = getVariablesFromDbCacheKey(cacheKey)?.[0] || '';
    const regionToCache = region || getDistrictOfACity(locationToCache) || "";

    await LlmEvidenceSources.updateOne(
        { vars_id: cacheKey },
        {
            vars_id: cacheKey,
            status: LlmCacheStatus.ACTIVE,
            location: locationToCache,
            region: regionToCache,
            data: sources,
        },
        { upsert: true },
    );
}

/** Returns [] (not null) when nothing is cached — callers should degrade gracefully. */
export async function getCachedEvidenceSourcesFromDb(
    cacheKey: string,
): Promise<EvidenceSource[]> {
    const doc = await LlmEvidenceSources.findOne({ vars_id: cacheKey }).lean();
    return (doc?.data as EvidenceSource[] | undefined) || [];
}

export const getVariablesFromDbCacheKey = (cacheKey: string): string[] => {
    const parts = cacheKey.split(':');
    if (parts.length < 2) {
        logger.warn(`⚠️  Invalid cache key format: ${cacheKey}`);
        return [];
    }
    // Handle possible double-prefix like 'rag:rag:location__job' by taking the tail after the prefix(s)
    let varsPart = parts.slice(1).join(':');
    // If varsPart itself starts with a known prefix (e.g., 'rag:'), strip it
    if (varsPart.startsWith('rag:')) {
        varsPart = varsPart.slice('rag:'.length);
    }
    return varsPart.split('__');
}

const getCombinedStatusForCache = (statusOne: LlmCacheStatus, statusTwo: LlmCacheStatus) => {
    if ([statusOne, statusTwo].includes(LlmCacheStatus.UPDATING)) return LlmCacheStatus.UPDATING
    if ([statusOne, statusTwo].includes(LlmCacheStatus.INACTIVE)) return LlmCacheStatus.INACTIVE
    if (statusOne === LlmCacheStatus.ACTIVE && statusTwo === LlmCacheStatus.ACTIVE) return LlmCacheStatus.ACTIVE
    return LlmCacheStatus.UPDATING
}

export async function cacheLlmResponseToDb(cacheKey: string, response: Record<string, unknown>, section: typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS], region = ""): Promise<void> {
    let locationToCache = getVariablesFromDbCacheKey(cacheKey)?.[0] || '';
    
    let regionToCache = region;
    if(!regionToCache) {
        regionToCache = getDistrictOfACity(locationToCache) || "";
    }
    let result;
    let commonCacheData = {
        vars_id: cacheKey,
        status: LlmCacheStatus.ACTIVE,
        location: locationToCache,
        region: regionToCache || "",
    };
    switch (section) {
        case LLM_SECTION_LABELS.marketReportVerdict:
            result = await LlmMarketReportVerdict.updateOne(
                { vars_id: cacheKey },
                { ...commonCacheData, data: response },
                { upsert: true }
            );
            break;
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
                        ...commonCacheData,
                        data: {
                            report_sources: response.report_sources || [],
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

export async function updateCacheResponseInDb(cacheKey: string, section: typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS], region = ""): Promise<void> {
    let result;
    let statusData = {
        vars_id: cacheKey,
        status: LlmCacheStatus.UPDATING,
        location: getVariablesFromDbCacheKey(cacheKey)?.[0] || '',
        region
    };
    switch (section) {
        case LLM_SECTION_LABELS.marketReportVerdict:
            result = await LlmMarketReportVerdict.updateOne(
                { vars_id: cacheKey },
                statusData,
                { upsert: true }
            );
            break;
        case LLM_SECTION_LABELS.marketReport:
            result = await LlmMarketReport.updateOne(
                { vars_id: cacheKey },
                statusData,
                { upsert: true }
            );
            break;
        case LLM_SECTION_LABELS.industryTrends:
            result = await LlmIndustryTrend.updateOne(
                { vars_id: cacheKey },
                statusData,
                { upsert: true }
            );
            break;
        case LLM_SECTION_LABELS.newsAndCareerIntel:
            result = await Promise.all([
                LlmMarketNews.updateOne(
                    { vars_id: cacheKey },
                    statusData,
                    { upsert: true }
                ),
                LlmCareerIntel.updateOne(
                    { vars_id: cacheKey },
                    statusData,
                    { upsert: true }
                )
            ]);
            break;
        default:
            logger.warn(`⚠️  Unknown section: ${section}`);
            return result;
    }
}

export const getCachedLlmResponseFromDb = async (cacheKey: string, section: typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS], isSkipExpireCheck = false) => {
    let doc;
    const llmRetrievalFilter = isSkipExpireCheck ? { vars_id: cacheKey } : { vars_id: cacheKey, updatedAt: { $gt: new Date(Date.now() - LLM_RESPONSE_EXPIRATION_MS) } };
    switch (section) {
        case LLM_SECTION_LABELS.marketReportVerdict:
            doc = await LlmMarketReportVerdict.findOne(llmRetrievalFilter).lean();
            break;
        case LLM_SECTION_LABELS.marketReport:
            doc = await LlmMarketReport.findOne(llmRetrievalFilter).lean();
            break;
        case LLM_SECTION_LABELS.industryTrends:
            doc = await LlmIndustryTrend.findOne(llmRetrievalFilter).lean();
            break;
        case LLM_SECTION_LABELS.newsAndCareerIntel:
            const marketNewsDoc = await LlmMarketNews.findOne(llmRetrievalFilter).lean() as { data?: MarketNewsData[]; status?: LlmCacheStatus } | null;
            const careerIntelDoc = await LlmCareerIntel.findOne(llmRetrievalFilter).lean() as { data?: CareerIntelData; status?: LlmCacheStatus } | null;
            const marketNewsData = marketNewsDoc?.data || [];
            const careerIntelData = careerIntelDoc?.data || null;
            if (marketNewsDoc || careerIntelDoc) {
                doc = { data: { market_news: marketNewsData, report_sources: careerIntelData?.report_sources || [] }, status: getCombinedStatusForCache(marketNewsDoc?.status as LlmCacheStatus, careerIntelDoc?.status as LlmCacheStatus) };
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
    return doc;
}