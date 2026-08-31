import { retrieve } from '../ragRetrievalService.js';
import { formatMarketInsightsContext } from '../../lib/ragContextFormatters.js';
import { RagNamespace } from '../../types/rag.js';
import { openaiClient, RateLimitError, QuotaExceededError, ConnectionTimeoutError } from '../../lib/openai.js';
import { cacheLlmResponseToDb, getCachedLlmResponseFromDb, getUniqueDbCacheKeyForLlmResponse, updateCacheResponseInDb } from '../db-cache/dbCacheService.js';
import { getCachedMarketInsightsFromDb, getMarketInsightsCacheKey } from '../db-cache/dbCacheService.js';
import { storeJobPartialResult } from '../../lib/redisQueue.js';
import pLimit from 'p-limit';
import { logger } from '../../utils/logger.js';
import { emitToJob } from '../../lib/websocket.js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { LlmCacheStatus } from '../../constants/db.js';
import { LLM_SECTION_LABELS } from '../../constants/index.js';
import { normalizeMarketReportVerdict } from './normalizeMarketReportVerdict.js';

type SectionName =
  | 'marketReportVerdict'
  | 'marketReport'
  | 'industryTrends'
  | 'newsAndCareerIntel';

interface SectionState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: MarketInsightsData;
  error?: string;
}

export const SYSTEM_PROMPT = `You are a career development coach and labor market analyst.

Treat the provided context as your research notes. Write as a knowledgeable analyst — weave the data naturally into your response without referencing where it came from. Supplement with your own knowledge where the context is thin.

Use coaching language that normalizes career pivots and validates concerns. Your goal is to provide actionable, grounded career guidance.`;


type MarketInsightsData = Record<string, unknown>;

/**
 * Fast overview hero: market_report_verdict only (streams to FE first).
 */
export function buildMarketReportVerdictPrompt(
  location: string,
  job?: string,
  seniority?: string,
): string {
  const roleContext = [job ? `occupation: ${job}` : null, seniority ? `seniority: ${seniority}` : null]
    .filter(Boolean)
    .join('; ');

  return `You are analyzing labor market data for ${location}.
${roleContext ? `Additional user context: ${roleContext}. Use this only to tailor the analysis; do not change the output structure.` : ''}

Return ONLY a JSON object with this single required key:

market_report_verdict (UI hero card):
- verdict_label: Short market badge, e.g. "Stable market", "Growing market", or "Softening market"
- outlook_label: Short outlook line, e.g. "Positive 12-month outlook", "Mixed 12-month outlook", or "Cautious 12-month outlook"
- headline: ONE coaching sentence for the hero title (max ~120 characters). Specific to the user's role and ${location}.
- summary: 1-2 sentences of body copy expanding on the headline
- signals: Object with EXACTLY these keys, each value MUST be one of "Stable", "High", or "Low":
  * role_demand: Overall hiring demand for the user's role/seniority in ${location}
  * competition: How competitive applications are for comparable roles
  * evidence_quality: Confidence in the evidence backing this report

Example:
{
  "market_report_verdict": {
    "verdict_label": "Stable market",
    "outlook_label": "Positive 12-month outlook",
    "headline": "Your experience remains relevant, but the strongest senior roles are changing.",
    "summary": "Toronto employers continue to hire experienced product leaders. The clearest shift is toward AI-enabled delivery and commercial ownership.",
    "signals": { "role_demand": "Stable", "competition": "High", "evidence_quality": "High" }
  }
}

CRITICAL:
- Keep the response small — verdict only, no other keys
- Reference specific local factors for ${location}
- Return ONLY valid JSON with NO markdown formatting.`;
}

/**
 * Lean Part 1: brief, summary, labour, comparison, shifts (no verdict — separate call).
 */
export function buildMarketReportPrompt(location: string, job?: string, seniority?: string): string {
  const roleContext = [job ? `occupation: ${job}` : null, seniority ? `seniority: ${seniority}` : null]
    .filter(Boolean)
    .join('; ');

  return `You are analyzing labor market data for ${location}.
${roleContext ? `Additional user context: ${roleContext}. Use this only to tailor the analysis and examples; do not change the output structure or add new fields.` : ''}

Generate a JSON response with these sections:

1. market_report_summary_brief: 
   - A 2-4 paragraph executive summary focused on the LAST 2 MONTHS of market news and structural shifts for ${location}. 
   - Include: recent layoffs, policy changes, emerging sectors, AI adoption impact, hybrid/remote work trends
   - Use specific numbers and recent dates where available
   - Tone: candid but empowering coaching perspective
   - Example structure for SF: "Over the next 3-10 years, [location] will stay a global jobs hotspot, but the centre of gravity is shifting..."
   - Format as plain text (NOT JSON nested), ~400-600 words

2. market_report_summary:
   - overview: 2-3 paragraphs analyzing the ACTUAL labor market conditions. Reference specific statistics, recent news, and economic trends.
   - summary_key_stats: 
     * strongest_opportunity: Specific sector/role backed by data (e.g., "Cloud Infrastructure Engineering - 23% YoY growth")
     * highest_risk_sector: Specific sector with declining data (e.g., "Retail Management - 8% contraction due to e-commerce shift")
     * top_skill_demand: Actual in-demand skill
     * pivot_necessity: "High", "Moderate", or "Low" based on market volatility

3. labour_market_snapshot:
   - overview: 2 paragraphs with SPECIFIC STATISTICS (employment rates, job growth %, wage trends)
   - local_vs_national: Compare ${location} metrics to national averages
   - major_drivers: 3-5 specific factors (e.g., "Tech hub expansion in Tempe", "Healthcare aging population", NOT generic phrases)
   - market_health: 
     * employment_rate: Actual %
     * job_growth_rate: Actual %
     * trend: "Growing", "Stable", or "Declining"

4. city_vs_region_comparison (ALWAYS GENERATE - REQUIRED):
   - title: "[City Name] vs Broader Region Comparison"
   - data: Array of 4-5 comparison objects with:
     * factor: Comparison category (e.g., "Overall job market trend", "Remote / hybrid work trend", "Notable structural shifts", "Cost of living / compensation", "Industry distribution")
     * city: Conditions in the city (e.g., "${location}")
     * wider_region: Conditions in the broader region (state/metro area outside the city)
   - IMPORTANT: Generate this for ALL locations. Use regional data from context.
   - Example for San Francisco:
     {
       "factor": "Overall job market trend",
       "city": "High-skill, high-volatility – strong demand in AI, frontier tech, finance, product, design; repeated restructuring in big tech and startups.",
       "wider_region": "Mixed but resilient – strong in healthcare, education, logistics, clean energy, advanced manufacturing and public services, with tech distributed across the region."
     }

5. market_shifts (overview UI — REQUIRED; exactly 3 items for "Three shifts affecting you"):
   - Array of exactly 3 objects, each with:
     * title: Short shift headline (max ~80 characters) specific to ${location} and the user's role
     * summary: ONE sentence explaining what changed and how it affects the user — unique per item
   - Do NOT repeat the same summary text across items
   - Do NOT paste local_vs_national verbatim into every summary
   - Example:
     [
       { "title": "AI-enabled delivery is becoming baseline", "summary": "Employers expect practical evidence of AI improving workflows and customer outcomes." },
       { "title": "Commercial ownership matters more", "summary": "Senior postings increasingly emphasize revenue, margin, and operating efficiency." },
       { "title": "Regulated-platform experience stays valuable", "summary": "Compliance and risk experience continue to differentiate candidates in financial services." }
     ]

CRITICAL: 
- Do NOT include market_report_verdict (generated in a separate call)
- Reference specific local factors for ${location}
- Return ONLY valid JSON with NO markdown formatting.`;
}

/**
 * Part 2: Industry Growth and Decline Trends Section (4 trend cards)
 * Focuses on: growth_sectors, at_risk_sectors, top_skills_demand, market_risks
 */
export function buildIndustryTrendsPrompt(location: string, job?: string, seniority?: string): string {
  const roleContext = [job ? `occupation: ${job}` : null, seniority ? `seniority: ${seniority}` : null]
    .filter(Boolean)
    .join('; ');

  return `Generate industry trends and skills data for ${location}.
${roleContext ? `Additional user context: ${roleContext}. Use this only to tailor the analysis and examples; do not change the output structure or add new fields.` : ''}

Provide a JSON response with these sections:

1. growth_sectors: Array of EXACTLY 10 sectors with:
   - sector: High-Growth Sector name (e.g., "AI & Advanced Tech (SF, Palo Alto, South Bay)")
   - growth_outlook: "Expanding" | "Growing" (one of these two)
   - example_roles: Array of 4-6 specific job titles and specializations
   - why_it_matters: 2-3 sentences on why this sector matters for ${location} job seekers
   - risk_reality_check: 3-4 sentences grounded in recent news/data about realistic challenges and risks in this sector
   
   NOTE: Generate EXACTLY 10 sectors covering diverse areas.

2. at_risk_sectors: Array of EXACTLY 10 role clusters / sectors with:
   - sector: At-Risk Role Cluster name (e.g., "Traditional front-end / generalist software engineers")
   - automation_reason: Specific reason why this role is at risk (e.g., "AI coding tools, offshore talent, and shift toward AI/infra work")
   - pivot_direction: Where to pivot (e.g., "Aim for AI engineering, infra/platform, security engineering...")
   - risk_reality_check: 4-5 sentences grounded in recent 2025 news/reports about automation impact and hiring realities
   
   NOTE: Generate EXACTLY 10 at-risk clusters including realistic data about job cuts, AI adoption, and structural shifts.

3. top_skills_demand: { title: "Top Skills Demand in 2025", categories: [
     {
       quadrant: "Emerging Stars" | "Strategic Must-Haves" | "Stable Foundations" | "Niche Specialists",
       description: Brief description of this category,
       skills: [{
         category: General category name (e.g., "Cloud Computing", "Data Analytics", "AI & Machine Learning"),
         description: What this skill category encompasses,
         examples: Array of 3-4 specific examples (e.g., ["AWS", "Azure", "Google Cloud"] for Cloud Computing),
         demand_level: "High" | "Medium" | "Growing",
         growth_trend: Brief trend description,
         why: Why this skill matters for ${location} job market (1-2 sentences),
         so_what: What to do about it / how to start (2-3 sentences with actionable advice)
       }]
     }
   ] }
   Generate exactly 4 quadrant categories with 4 general skill categories each (16 total skills).
   Use GENERAL skill categories (e.g., "Cloud Platforms", "Modern Frameworks", "Database Technologies") not specific tools.
   Each category should have 3-4 concrete examples in the examples array.

4. market_risks: Array of 4-6 risks with VARIED severity:
   - risk: Specific risk
   - severity: "High", "Medium", "Low" (MUST VARY - not all same!)
   - affected_sectors: Array of sectors
   - mitigation_strategy: Actionable advice

Use coaching language. Return ONLY valid JSON.`;
}

/**
 * Part 3: Market News & Sources
 * Focuses on: market_news, report_sources
 */
export function buildNewsAndCareerIntelPrompt(location: string, job?: string, seniority?: string): string {
  const roleContext = [job ? `occupation: ${job}` : null, seniority ? `seniority: ${seniority}` : null]
    .filter(Boolean)
    .join('; ');

  return `Generate market news and career intelligence for ${location}.
${roleContext ? `Additional user context: ${roleContext}. Use this only to tailor the analysis and examples; do not change the output structure or add new fields.` : ''}

Provide a JSON response with these sections:

1. market_news: Array of 5-8 news items with:
   - headline: Headline synthesized from available data
   - summary: 2-3 sentences
   - impact: "Positive", "Negative", "Mixed", "Neutral" (VARY THESE!)
   - relevance_score: Number 1-10
   - date: Date if available

2. report_sources: Array of 3-8 source names, article titles, or URLs used to build the news items.

CRITICAL REQUIREMENTS:
- Keep the response focused on market_news and sources only.
- Reference ACTUAL companies, programs, and resources in ${location}
- Cite specific percentages and statistics where available

Return ONLY valid JSON with NO markdown formatting.`;
}

/**
 * Generate market insights using multi-part approach
 */
export async function generateMarketInsights(
  location: string,
  _userId: string,
  jobId?: string,
  locationDistrict?: string,
  job?: string,
  seniority?: string,
  industry?: string,
): Promise<{ insights: MarketInsightsData; failedSections: string[] }> {
  const sectionStates: Record<SectionName, SectionState> = {
    marketReportVerdict: { status: 'idle' },
    marketReport: { status: 'idle' },
    industryTrends: { status: 'idle' },
    newsAndCareerIntel: { status: 'idle' },
  };
  let partialInsights: MarketInsightsData = {};
  const completedSectionNames: SectionName[] = [];

  try {
    logger.info(`📊 Starting independent section generation for: ${location}`);

    if (jobId) {
      emitToJob(jobId, 'progress', {
        type: 'job_start',
        stage: 'Preparing market insights',
        jobId
      });
    }

    const persistPartial = () => {
      if (!jobId || completedSectionNames.length === 0) return;
      const normalized = normalizeMarketReportVerdict(partialInsights);
      partialInsights = normalized;
      void storeJobPartialResult(jobId, normalized, completedSectionNames);
    };

    const onSectionComplete = (section: string, result: Record<string, unknown> | string | null, error?: string) => {
      const sectionName = section as SectionName;

      if (error) {
        logger.error(`❌ Section failed: ${section} - ${error}`);
        sectionStates[sectionName] = { status: 'error', error };

        if (jobId) {
          emitToJob(jobId, 'progress', {
            type: 'section_error',
            section: sectionName,
            error,
            jobId,
          });
        }
        return;
      }

      if (result) {
        if ((result as Record<string, string>).status === LlmCacheStatus.UPDATING) {
          if (jobId)
            emitToJob(jobId, 'progress', {
              type: 'section_in_progress',
              section: sectionName,
              data: result,
              jobId,
            });
        } else {
          const sectionData =
            result && typeof result === 'object' && !Array.isArray(result)
              ? (result as MarketInsightsData)
              : null;
          if (sectionData) {
            partialInsights = { ...partialInsights, ...sectionData };
            if (!completedSectionNames.includes(sectionName)) {
              completedSectionNames.push(sectionName);
            }
            persistPartial();
          }

          if (jobId) {
            emitToJob(jobId, 'progress', {
              type: 'section_success',
              section: sectionName,
              data: partialInsights,
              jobId,
            });
          }
        }
        logger.info(`✓ Section complete: ${section}`);
        sectionStates[sectionName] = { status: 'success', data: result as MarketInsightsData };
      }
    };

    try {
      // Step A: Retrieve shared context once using the new retrieval service
      const namespaces = [
        RagNamespace.LABOR_MARKET_STATS,
        RagNamespace.MARKET_NEWS,
        RagNamespace.MARKET_REPORTS,
      ];

      // Build combined query string with location, job, seniority, optional industry
      const queryParts = [`market insights for ${location}`];
      if (job) queryParts.push(`job: ${job}`);
      if (seniority) queryParts.push(`seniority: ${seniority}`);
      if (industry) queryParts.push(`industry: ${industry}`);

      const combinedQuery = queryParts.join(', ');
      const marketInsightsCacheKey = getMarketInsightsCacheKey(location, job, seniority);

      const cachedInsights = await getCachedMarketInsightsFromDb(location, job, seniority);
      if (cachedInsights) {
        logger.info(`📦 Tuple cache HIT for market insights: ${marketInsightsCacheKey}`);
        if (jobId) {
          emitToJob(jobId, 'progress', {
            type: 'job_complete',
            completedSections: [
              'marketReportVerdict',
              'marketReport',
              'industryTrends',
              'newsAndCareerIntel',
            ],
            failedSections: [],
            insights: cachedInsights.insights,
            jobId,
          });
        }
        return { insights: cachedInsights.insights, failedSections: [] };
      }

      console.log(`[RAG Query] About to retrieve for jobId: ${jobId}`);
      console.log(`[RAG Query] Full query string: "${combinedQuery}"`);
      console.log(`[RAG Query] Namespaces: ${namespaces.join(', ')}`);

      const retrievalResp = await retrieve({
        query: combinedQuery,
        namespaces,
        topK: 15,
        useCache: true,
      });

      // Step B: Format context for the LLM using the consumer formatter
      const formattedContext = formatMarketInsightsContext(retrievalResp);

      // Step C: Generate each section using existing LLM + DB cache logic
      const prompts = [
        {
          label: LLM_SECTION_LABELS.marketReportVerdict,
          query: buildMarketReportVerdictPrompt(location, job, seniority),
          cacheKeySuffix: marketInsightsCacheKey,
          maxTokens: 1200,
        },
        {
          label: LLM_SECTION_LABELS.marketReport,
          query: buildMarketReportPrompt(location, job, seniority),
          cacheKeySuffix: marketInsightsCacheKey,
          maxTokens: 16000,
        },
        {
          label: LLM_SECTION_LABELS.industryTrends,
          query: buildIndustryTrendsPrompt(location, job, seniority),
          cacheKeySuffix: marketInsightsCacheKey,
          maxTokens: 16000,
        },
        {
          label: LLM_SECTION_LABELS.newsAndCareerIntel,
          query: buildNewsAndCareerIntelPrompt(location, job, seniority),
          cacheKeySuffix: marketInsightsCacheKey,
          maxTokens: 16000,
        },
      ];

      const responseFormat = 'json';
      const useCache = true;

      const concurrency = parseInt(process.env.OPENAI_MAX_CONCURRENT || '3');
      const limit = pLimit(concurrency);

      const results: Record<string, Record<string, unknown> | string> = {};

      async function generateSingleResponse(
        systemPrompt: string,
        formattedContextText: string,
        queryText: string,
        responseFormat: 'json' | 'text',
        maxRetries = 3,
        maxTokens = 16000,
      ): Promise<Record<string, unknown> | string> {
        let response: Record<string, unknown> | string;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            if (responseFormat === 'json') {
              const userPrompt = `${formattedContextText}\n\n${queryText}`;
              response = await openaiClient.generateJSONCompletion(systemPrompt, userPrompt, {
                max_tokens: maxTokens,
                temperature: 0.7,
              });

              if (!response || typeof response !== 'object') {
                throw new Error('Invalid JSON response: not an object');
              }

              logger.info('📊 Generated JSON response with keys:', Object.keys(response).join(', '));
              return response;
            } else {
              const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `${formattedContextText}\n\n${queryText}` },
              ];
              response = await openaiClient.generateCompletion(messages as any);
              return response;
            }
          } catch (error) {
            if (error instanceof RateLimitError || error instanceof QuotaExceededError || error instanceof ConnectionTimeoutError) {
              const knownError = error as Error;
              logger.error(`🚫 ${knownError.name}: ${knownError.message} - Not retrying`);
              throw error;
            }

            const err = error as Error;
            logger.warn(`⚠️  Generation attempt ${attempt}/${maxRetries} failed:`, err.message);

            if (attempt === maxRetries) {
              logger.error('❌ All retry attempts exhausted');
              throw error;
            }

            const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            logger.info(`⏳ Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }

        throw new Error('Failed to generate response');
      }

      const runSectionGeneration = async (prompt: (typeof prompts)[number]) => {
        try {
          const dbCacheKey = (prompt.cacheKeySuffix && (prompt.cacheKeySuffix as string).startsWith('rag:'))
            ? (prompt.cacheKeySuffix as string)
            : getUniqueDbCacheKeyForLlmResponse('rag', prompt.cacheKeySuffix as string);
          let cached;
          if (useCache) {
            cached = await getCachedLlmResponseFromDb(dbCacheKey, prompt.label as typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS]);
            if (cached) {
              if (cached.status === LlmCacheStatus.UPDATING) {
                logger.info(`Cache Getting Updated: ${prompt.label}`);
                onSectionComplete?.(prompt.label, { status: LlmCacheStatus.UPDATING });
                results[prompt.label] = cached?.data;
                return;
              }
              results[prompt.label] = cached?.data;
              logger.info(`✓ Cache Retrieved: ${prompt.label}`);
              onSectionComplete?.(prompt.label, cached.data);
              return;
            } else {
              const expiredCached = await getCachedLlmResponseFromDb(dbCacheKey, prompt.label as typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS], true);
              if (expiredCached) {
                logger.info(`✓ Cache Expired: ${prompt.label} - showing stale data while updating`);
                results[prompt.label] = expiredCached?.data;
                onSectionComplete?.(prompt.label, { ...expiredCached.data, status: LlmCacheStatus.UPDATING });
              }
            }
          }

          if (useCache) {
            updateCacheResponseInDb(dbCacheKey, prompt.label as typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS], locationDistrict || "");
          }

          logger.info(`🔄 Generating: ${prompt.label}`);
          const response = await generateSingleResponse(
            SYSTEM_PROMPT,
            formattedContext.text,
            prompt.query,
            responseFormat as 'json' | 'text',
            3,
            prompt.maxTokens ?? 16000,
          );

          if (useCache) {
            logger.info(`✓ Cached: ${prompt.label}`);
            cacheLlmResponseToDb(dbCacheKey, typeof response === 'string' ? { text: response } : response, prompt.label as typeof LLM_SECTION_LABELS[keyof typeof LLM_SECTION_LABELS], locationDistrict || "");
          }

          results[prompt.label] = response;
          logger.info(`✓ Completed: ${prompt.label}`);
          if (onSectionComplete) onSectionComplete(prompt.label, response);
        } catch (error) {
          const err = error as Error;
          logger.error(`❌ Failed: ${prompt.label} - ${err.message}`);
          if (onSectionComplete) onSectionComplete(prompt.label, null, err.message);
          throw error;
        }
      };

      const part1Prompts = prompts.filter(
        (p) =>
          p.label === LLM_SECTION_LABELS.marketReportVerdict ||
          p.label === LLM_SECTION_LABELS.marketReport,
      );
      const restPrompts = prompts.filter(
        (p) =>
          p.label !== LLM_SECTION_LABELS.marketReportVerdict &&
          p.label !== LLM_SECTION_LABELS.marketReport,
      );

      // Verdict + lean Part 1 in parallel so FE can paint hero as soon as verdict lands.
      await Promise.allSettled(
        part1Prompts.map((prompt) => limit(() => runSectionGeneration(prompt))),
      );

      await Promise.allSettled(
        restPrompts.map((prompt) => limit(() => runSectionGeneration(prompt))),
      );

      const marketReportVerdict =
        (results[LLM_SECTION_LABELS.marketReportVerdict] as MarketInsightsData) || {};
      const marketReport = (results[LLM_SECTION_LABELS.marketReport] as MarketInsightsData) || {};
      const industryTrends =
        (results[LLM_SECTION_LABELS.industryTrends] as MarketInsightsData) || {};
      const newsAndCareerIntel =
        (results[LLM_SECTION_LABELS.newsAndCareerIntel] as MarketInsightsData) || {};

      const combinedInsights: MarketInsightsData = normalizeMarketReportVerdict({
        ...marketReport,
        ...marketReportVerdict,
        ...industryTrends,
        ...newsAndCareerIntel,
      });

      const completedSections = Object.entries(sectionStates)
        .filter(([_, state]) => state.status === 'success')
        .map(([name]) => name);

      const failedSections = Object.entries(sectionStates)
        .filter(([_, state]) => state.status === 'error')
        .map(([name]) => name);

      logger.info(
        `✓ Job complete: ${completedSections.length}/${Object.keys(sectionStates).length} sections succeeded`,
      );

      if (jobId) {
        emitToJob(jobId, 'progress', {
          type: 'job_complete',
          completedSections,
          failedSections,
          insights: combinedInsights,
          jobId,
        });
      }

      try {
        const tempDir = path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          'temp',
        );
        await mkdir(tempDir, { recursive: true });
        const filename = `insights_${location.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.json`;
        await writeFile(path.join(tempDir, filename), JSON.stringify(combinedInsights, null, 2), 'utf8');
      } catch (fsErr) {
        logger.warn('Failed to write temp file', fsErr);
      }

      return { insights: combinedInsights, failedSections };
    } catch (error) {
      const err = error as Error;
      logger.error(`Pipeline error for ${location}:`, err.message);

      if (jobId) {
        emitToJob(jobId, 'progress', {
          type: 'job_error',
          error: err.message,
          jobId,
        });
      }

      throw error;
    }
  } catch (error) {
    logger.error(`Error in generateMarketInsights for ${location}:`, error);
    if (jobId) {
      emitToJob(jobId, 'progress', {
        type: 'job_error',
        error: 'Failed to generate market insights',
        jobId,
      });
    }
    throw error;
  }
}