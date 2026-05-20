import { retrieve } from '../ragRetrievalService.js';
import { formatMarketInsightsContext } from '../../lib/ragContextFormatters.js';
import { RagNamespace } from '../../types/rag.js';
import { openaiClient, RateLimitError, QuotaExceededError, ConnectionTimeoutError } from '../../lib/openai.js';
import { cacheLlmResponseToDb, getCachedLlmResponseFromDb, getUniqueDbCacheKeyForLlmResponse, updateCacheResponseInDb } from '../db-cache/dbCacheService.js';
import pLimit from 'p-limit';
import { logger } from '../../utils/logger.js';
import { emitToJob } from '../../lib/websocket.js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { LlmCacheStatus } from '../../constants/db.js';
import { LLM_SECTION_LABELS } from '../../constants/index.js';

type SectionName = 'marketReport' | 'industryTrends' | 'newsAndCareerIntel';

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
 * Part 1: Market Report Section (3 articles)
 * Focuses on: market_report_summary_brief, market_report_summary, labour_market_snapshot, city_vs_region_comparison
 */
export function buildMarketReportPrompt(location: string): string {
  return `You are analyzing labor market data for ${location}.

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

CRITICAL: 
- Reference specific local factors for ${location}
- Return ONLY valid JSON with NO markdown formatting.`;
}

/**
 * Part 2: Industry Growth and Decline Trends Section (4 trend cards)
 * Focuses on: growth_sectors, at_risk_sectors, top_skills_demand, market_risks
 */
export function buildIndustryTrendsPrompt(location: string): string {
  return `Generate industry trends and skills data for ${location}.

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
 * Part 3: Market News & Career Intelligence
 * Focuses on: market_news, strategies_by_experience, key_findings
 */
export function buildNewsAndCareerIntelPrompt(location: string): string {
  return `Generate market news and career intelligence for ${location}.

Provide a JSON response with these sections:

1. market_news: Array of 5-8 news items with:
   - headline: Headline synthesized from available data
   - summary: 2-3 sentences
   - impact: "Positive", "Negative", "Mixed", "Neutral" (VARY THESE!)
   - relevance_score: Number 1-10
   - date: Date if available

2. strategies_by_experience:
   - new_graduates: Array of 10+ specific, actionable strategies
   - mid_career_pivoting: Array of 10+ specific, actionable strategies  
   - newcomers_international: Array of 10+ specific, actionable strategies

3. key_findings: Array of 8-10 findings with VARIED data:
   - impact_level: "High", "Medium", or "Low" (VARY THESE - not all High!)
   - insight: Specific finding with data (e.g., "Cloud computing jobs grew 34% in Phoenix metro area")
   - action_item: Actionable recommendation
   - driving_force: The underlying market force driving this finding (e.g., "AI adoption", "Remote work normalization", "Post-pandemic hiring rebound")

CRITICAL REQUIREMENTS:
- VARY impact levels in key_findings (mix High, Medium, Low)
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
  yearsOfExperience?: number
): Promise<{ insights: MarketInsightsData; failedSections: string[] }> {
  const sectionStates: Record<SectionName, SectionState> = {
    marketReport: { status: 'idle' },
    industryTrends: { status: 'idle' },
    newsAndCareerIntel: { status: 'idle' },
  };

  try {
    logger.info(`📊 Starting independent section generation for: ${location}`);

    if (jobId) {
      emitToJob(jobId, 'progress', {
        type: 'job_start',
        stage: 'Preparing market insights',
        jobId
      });
    }

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
          if (jobId) {
            emitToJob(jobId, 'progress', {
              type: 'section_success',
              section: sectionName,
              data: result,
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

      // Build combined query string with location, job, seniority
      const queryParts = [`market insights for ${location}`];
      if (job) queryParts.push(`job: ${job}`);
      if (seniority) queryParts.push(`seniority: ${seniority}`);
      if (yearsOfExperience !== undefined) queryParts.push(`${yearsOfExperience} years experience`);
      const combinedQuery = queryParts.join(', ');

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
        { label: LLM_SECTION_LABELS.marketReport, query: buildMarketReportPrompt(location), cacheKeySuffix: `${location}` },
        { label: LLM_SECTION_LABELS.industryTrends, query: buildIndustryTrendsPrompt(location), cacheKeySuffix: `${location}` },
        { label: LLM_SECTION_LABELS.newsAndCareerIntel, query: buildNewsAndCareerIntelPrompt(location), cacheKeySuffix: `${location}` },
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
        maxRetries = 3
      ): Promise<Record<string, unknown> | string> {
        let response: Record<string, unknown> | string;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            if (responseFormat === 'json') {
              const userPrompt = `${formattedContextText}\n\n${queryText}`;
              response = await openaiClient.generateJSONCompletion(systemPrompt, userPrompt, {
                max_tokens: 16000,
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

      const generationPromises = prompts.map(prompt => limit(async () => {
        try {
          const dbCacheKey = getUniqueDbCacheKeyForLlmResponse('rag', prompt.cacheKeySuffix);
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
            3
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
      }));

      await Promise.allSettled(generationPromises);

      const marketReport = results[LLM_SECTION_LABELS.marketReport] as MarketInsightsData || {};
      const industryTrends = results[LLM_SECTION_LABELS.industryTrends] as MarketInsightsData || {};
      const newsAndCareerIntel = results[LLM_SECTION_LABELS.newsAndCareerIntel] as MarketInsightsData || {};

      const combinedInsights: MarketInsightsData = {
        ...marketReport,
        ...industryTrends,
        ...newsAndCareerIntel,
      };

      const completedSections = Object.entries(sectionStates)
        .filter(([_, state]) => state.status === 'success')
        .map(([name]) => name);

      const failedSections = Object.entries(sectionStates)
        .filter(([_, state]) => state.status === 'error')
        .map(([name]) => name);

      logger.info(`✓ Job complete: ${completedSections.length}/3 sections succeeded`);

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
        const tempDir = path.join(process.cwd(), 'web-server', 'services', 'temp');
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