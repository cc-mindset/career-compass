import { retrieve } from '../ragRetrievalService.js';
import { formatMarketInsightsContext } from '../../lib/ragContextFormatters.js';
import { extractEvidenceSources } from '../../lib/evidenceSources.js';
import { RagNamespace } from '../../types/rag.js';
import { openaiClient, RateLimitError, QuotaExceededError, ConnectionTimeoutError } from '../../lib/openai.js';
import { cacheLlmResponseToDb, getCachedLlmResponseFromDb, getUniqueDbCacheKeyForLlmResponse, updateCacheResponseInDb } from '../db-cache/dbCacheService.js';
import { getCachedMarketInsightsFromDb, getMarketInsightsCacheKey, cacheEvidenceSourcesToDb } from '../db-cache/dbCacheService.js';
import { storeJobPartialResult } from '../../lib/redisQueue.js';
import { generateSingleResponse } from '../llmService.js';
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

export const SYSTEM_PROMPT = `You are Clarity Coach, a labor market analyst and career coach.

Treat the provided context as your research notes. Write as a knowledgeable
analyst -- weave the data naturally into your response. Do NOT supplement thin
context with general knowledge: if the retrieved context does not support a
specific claim, say so in plain language instead of filling the gap.

Grounding rules (hard constraints):
- Never name a source, publisher, or report that is not present in the
  context below.
- Never state a precise statistic unless it is explicitly present in the
  context. Use qualitative language (high/medium/low, strong/moderate/weak)
  when the context does not support a precise number.
- If sources conflict, say so explicitly rather than silently picking one.

Tone: calm, plain language, coaching -- not alarmist, not clinical. This
report may be read by someone recently laid off, someone anxious about
layoffs while still employed, someone looking to grow, or a returning user
checking what changed. Do not assume distress; do not assume comfort. When a
role or sector is shrinking, say plainly that this is a market shift, not a
personal failing -- without making every section carry that message.`;


type MarketInsightsData = Record<string, unknown>;

/**
 * Fast overview hero + "What changed" shifts (streams early for FE navigation).
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

Return ONLY a JSON object with these required keys:

1. market_report_verdict (UI hero card):
- verdict_label: Short market badge, e.g. "Stable market", "Growing market", or "Softening market"
- outlook_label: Short outlook line, e.g. "Positive 12-month outlook", "Mixed 12-month outlook", or "Cautious 12-month outlook"
- headline: ONE coaching sentence for the hero title (max ~120 characters). Specific to the user's role and ${location}.
- summary: 1-2 sentences of body copy expanding on the headline
- signals: Object with EXACTLY these keys, each value MUST be one of "Stable", "High", or "Low":
  * role_demand: Overall hiring demand for the user's role/seniority in ${location}
  * competition: How competitive applications are for comparable roles
  * evidence_quality: Confidence in the evidence backing this report

2. market_shifts (overview UI — REQUIRED; exactly 3 items for "Three shifts affecting you"):
- Array of exactly 3 objects, each with:
  * title: Short shift headline (max ~80 characters) specific to ${location} and the user's role
  * summary: ONE sentence explaining what changed and how it affects the user — unique per item
- Do NOT repeat the same summary text across items
- Example:
  [
    { "title": "AI-enabled delivery is becoming baseline", "summary": "Employers expect practical evidence of AI improving workflows and customer outcomes." },
    { "title": "Commercial ownership matters more", "summary": "Senior postings increasingly emphasize revenue, margin, and operating efficiency." },
    { "title": "Regulated-platform experience stays valuable", "summary": "Compliance and risk experience continue to differentiate candidates in financial services." }
  ]

Example:
{
  "market_report_verdict": {
    "verdict_label": "Stable market",
    "outlook_label": "Positive 12-month outlook",
    "headline": "Your experience remains relevant, but the strongest senior roles are changing.",
    "summary": "Toronto employers continue to hire experienced product leaders. The clearest shift is toward AI-enabled delivery and commercial ownership.",
    "signals": { "role_demand": "Stable", "competition": "High", "evidence_quality": "High" }
  },
  "market_shifts": [
    { "title": "AI-enabled delivery is becoming baseline", "summary": "Employers expect practical evidence of AI improving workflows and customer outcomes." },
    { "title": "Commercial ownership matters more", "summary": "Senior postings increasingly emphasize revenue, margin, and operating efficiency." },
    { "title": "Regulated-platform experience stays valuable", "summary": "Compliance and risk experience continue to differentiate candidates in financial services." }
  ]
}

CRITICAL:
- Keep the response focused — verdict + market_shifts only, no other keys
- Reference specific local factors for ${location}
- Return ONLY valid JSON with NO markdown formatting.`;
}

/**
 * Lean Part 1: brief, summary, labour (no verdict / shifts — separate call).
 *
 * city_vs_region_comparison was removed (2026-09): it was marked
 * "ALWAYS GENERATE" but verified to have zero UI consumer anywhere, in the
 * prototype or the shipped client — pure token cost and hallucination
 * surface for nothing displayed. See docs/product/MarketReportPrompts.docx §3.
 *
 * hiring_trend_series (the Overview "Market direction" chart) is
 * intentionally NOT requested here — see normalizeMarketReportVerdict.ts,
 * which always injects an honest "not available" placeholder instead of
 * letting the model fabricate a trend line.
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

CRITICAL:
- Do NOT include market_report_verdict or market_shifts (generated in a separate call)
- Reference specific local factors for ${location}
- Return ONLY valid JSON with NO markdown formatting.`;
}

/**
 * Part 2: Industry Growth and Decline Trends Section
 * Focuses on: growth_sectors, at_risk_sectors, top_skills_demand, market_risks (unchanged),
 * plus growth_locations, priority_capabilities, thirty_day_focus (NEW, 2026-09) — see
 * docs/product/MarketReportPrompts.docx §4.
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

4. growth_locations: Array of EXACTLY 3 locations:
   - name: e.g. "Toronto, Ontario" -- the user's stated location plus up to 2 realistic
     alternatives grounded in retrieved geographic/labor data. If fewer than 3 are
     supportable by context, return fewer -- do NOT invent a location.
   - summary: one sentence -- why this location fits this user
   - signal: e.g. "Strongest market" | "High reach" | "Growing market"
   - marketDetail: what the market actually shows for this location
   - meaningDetail: what this means for the user's search

5. priority_capabilities: Array of EXACTLY 3 capabilities:
   - Select exactly the 3 skills from top_skills_demand most impactful for THIS user's
     role, seniority and location. Do NOT introduce a skill that isn't already present
     in top_skills_demand.
   - name: skill name (must match a top_skills_demand entry)
   - demand_level: "High demand" | "Growing" | "Medium demand"
   - evidence_building_action: ONE concrete, specific action -- not generic advice --
     the user can complete and add to their Career Profile

6. thirty_day_focus: Array of EXACTLY 3 week-labeled steps:
   - Sequence the 3 priority_capabilities' evidence_building_actions into a realistic
     short plan. Exactly 3 items, no more.
   - label: "Week 1" | "Week 2" | "Weeks 3-4"
   - action: the concrete step for that week

7. market_risks: Array of 4-6 risks with VARIED severity:
   - risk: Specific risk
   - severity: "High", "Medium", "Low" (MUST VARY - not all same!)
   - affected_sectors: Array of sectors
   - mitigation_strategy: Actionable advice

Use coaching language. Return ONLY valid JSON.`;
}

/**
 * Part 3: Sources & Evidence
 * Focuses on: report_sources (unchanged), plus evidence_lens_coverage (NEW, 2026-09).
 *
 * market_news was REMOVED (2026-09): verified it is never displayed as a news list
 * anywhere (prototype or shipped client), and its only two client-side fallback
 * consumers (shift-copy filler, evidenceTags filler) are both unreachable in normal
 * operation now that market_shifts (Part 1) and evidence_lens_coverage (below) are
 * both required fields that take priority over those fallbacks. Generating 5-8 full
 * news items every report for paths that don't fire was pure token cost and
 * hallucination surface — same reasoning already applied to city_vs_region_comparison.
 * report_sources is a fallback for legacy cache/fixture paths that predate
 * deterministic evidence_sources (see lib/evidenceSources.ts) -- do not expand it
 * toward richer generation.
 */
export function buildNewsAndCareerIntelPrompt(location: string, job?: string, seniority?: string): string {
  const roleContext = [job ? `occupation: ${job}` : null, seniority ? `seniority: ${seniority}` : null]
    .filter(Boolean)
    .join('; ');

  return `Generate career intelligence sources for ${location}.
${roleContext ? `Additional user context: ${roleContext}. Use this only to tailor the analysis and examples; do not change the output structure or add new fields.` : ''}

Provide a JSON response with these sections:

1. report_sources: Array of 3-8 source names, article titles, or URLs referenced across
   this report.

2. evidence_lens_coverage: Object with EXACTLY these 3 fixed group keys. These 9 tags
   are FIXED -- do not invent new ones and do not rename them. For each group, return
   only the tags from its fixed list that are substantively covered by content actually
   generated across Parts 1-3 of this report. A tag included here must be traceable to
   specific content in this report, not included because it is plausible in general.
   {
     "Technology & regulation": [ /* subset of: "Generative AI & automation",
       "Digital sovereignty", "Cybersecurity and regulation" */ ],
     "Economy & industry": [ /* subset of: "Macroeconomic indicators",
       "Supply-chain change", "Trade wars & reshoring" */ ],
     "People & place": [ /* subset of: "Demographics & immigration",
       "Local business trends", "Energy and infrastructure" */ ]
   }

CRITICAL REQUIREMENTS:
- Keep the response focused on sources and evidence_lens_coverage only.
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
        RagNamespace.GEO_LABOR_SIGNALS,
        RagNamespace.FORWARD_LOOKING,
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
        topK: 10,
        useCache: true,
      });

      // Step B: Format context for the LLM using the consumer formatter
      const formattedContext = formatMarketInsightsContext(retrievalResp);

      // Deterministic evidence provenance — derived from what was actually
      // retrieved, independent of whatever the LLM later claims it used.
      // Cached under the same key as the LLM sections so it also survives
      // the full tuple-cache-hit path above (see dbCacheService).
      const evidenceSources = extractEvidenceSources(retrievalResp);
      void cacheEvidenceSourcesToDb(marketInsightsCacheKey, evidenceSources, locationDistrict || '');

      // Step C: Generate each section using existing LLM + DB cache logic
      const prompts = [
        {
          label: LLM_SECTION_LABELS.marketReportVerdict,
          query: buildMarketReportVerdictPrompt(location, job, seniority),
          cacheKeySuffix: marketInsightsCacheKey,
          maxTokens: 1800,
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
            prompt.maxTokens,
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

      // Verdict + shifts and lean Part 1 in parallel so FE can paint hero + What changed early.
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
        evidence_sources: evidenceSources,
      });

      const completedSections = Object.entries(sectionStates)
        .filter(([_, state]) => state.status === 'success')
        .map(([name]) => name);

      const failedSections = Object.entries(sectionStates)
        .filter(([_, state]) => state.status === 'error')
        .map(([name]) => name);

      logger.info(`✓ Job complete: ${completedSections.length}/4 sections succeeded`);

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

export type MarketReportVerdictParams = {
  location: string;
  locationDistrict?: string;
  job?: string;
  seniority?: string;
  industry?: string;
};

/**
 * Domain producer for the market verdict (+ shifts) section.
 * Delivery (coalesce / emit / lane) belongs to `startPriorityJobSection`.
 */
export async function produceMarketReportVerdict(
  params: MarketReportVerdictParams,
): Promise<MarketInsightsData> {
  const { location, locationDistrict, job, seniority, industry } = params;

  const queryParts = [`market insights for ${location}`];
  if (job) queryParts.push(`job: ${job}`);
  if (seniority) queryParts.push(`seniority: ${seniority}`);
  if (industry) queryParts.push(`industry: ${industry}`);

  const marketInsightsCacheKey = getMarketInsightsCacheKey(location, job, seniority);
  const dbCacheKey = marketInsightsCacheKey.startsWith('rag:')
    ? marketInsightsCacheKey
    : getUniqueDbCacheKeyForLlmResponse('rag', marketInsightsCacheKey);

  const cached = await getCachedLlmResponseFromDb(
    dbCacheKey,
    LLM_SECTION_LABELS.marketReportVerdict,
  );
  if (cached?.data && cached.status === LlmCacheStatus.ACTIVE) {
    logger.info(`Market verdict cache HIT for ${location}`);
    return cached.data as MarketInsightsData;
  }

  const retrievalResp = await retrieve({
    query: queryParts.join(', '),
    namespaces: [
      RagNamespace.LABOR_MARKET_STATS,
      RagNamespace.MARKET_NEWS,
      RagNamespace.MARKET_REPORTS,
    ],
    topK: 15,
    useCache: true,
  });
  const formattedContext = formatMarketInsightsContext(retrievalResp);

  await updateCacheResponseInDb(
    dbCacheKey,
    LLM_SECTION_LABELS.marketReportVerdict,
    locationDistrict || '',
  );

  const response = await generateSingleResponse(
    SYSTEM_PROMPT,
    formattedContext.text,
    buildMarketReportVerdictPrompt(location, job, seniority),
    'json',
    3,
    { maxTokens: 1800, temperature: 0.7 },
  );

  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Failed to generate market verdict');
  }

  const payload = response as MarketInsightsData;
  await cacheLlmResponseToDb(
    dbCacheKey,
    payload,
    LLM_SECTION_LABELS.marketReportVerdict,
    locationDistrict || '',
  );
  return payload;
}
