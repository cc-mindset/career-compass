import { generateWithRAG } from './ragService.js';
import { logger } from '../utils/logger.js';
import redisClient from "../lib/redis.js";
import { safeGet, safeSet } from "../lib/redis.js";
import { emitJobProgress } from '../lib/websocket.js';



const SYSTEM_PROMPT = `You are a career development coach and labor market analyst. 

CRITICAL RULES:
1. ONLY use data from the context provided below - DO NOT make up sources
2. ONLY cite sources that appear in the context (BLS reports, news articles, market reports)
3. DO NOT invent source names like "Career Center", "Chamber of Commerce", "Indeed.com" unless they explicitly appear in the context
4. If a source is mentioned, it MUST be from the retrieved context documents
5. Use coaching language that normalizes career pivots and validates concerns

Your goal is to provide actionable career guidance based ONLY on the real data provided in the context.`;


type MarketInsightsData = Record<string, unknown>;

/**
 * Part 1: Core Market Data & Charts
 * Focuses on: executive_summary, labour_market_snapshot, chart_data
 */
function buildCoreDataPrompt(location: string): string {
  return `You are analyzing labor market data for ${location}. Use ONLY THE DATA provided in the context below. DO NOT make up sources or statistics.

IMPORTANT: The context contains documents from your knowledge base. ONLY cite sources that actually appear in the context. Do NOT invent source names.

Generate a JSON response with these sections:

1. executive_summary_brief: 
   - A 2-4 paragraph executive summary focused on the LAST 2 MONTHS of market news and structural shifts for ${location}. 
   - Include: recent layoffs, policy changes, emerging sectors, AI adoption impact, hybrid/remote work trends
   - Use specific numbers and recent dates from the context documents
   - Tone: candid but empowering coaching perspective
   - Example structure for SF: "Over the next 3-10 years, [location] will stay a global jobs hotspot, but the centre of gravity is shifting..."
   - Format as plain text (NOT JSON nested), ~400-600 words

2. executive_summary:
   - overview: 2-3 paragraphs analyzing the ACTUAL labor market conditions based on the data sources. Reference specific BLS statistics, recent news, and economic trends.
   - key_stats: 
     * strongest_opportunity: Specific sector/role backed by data (e.g., "Cloud Infrastructure Engineering - 23% YoY growth per BLS Q3 2024")
     * highest_risk_sector: Specific sector with declining data (e.g., "Retail Management - 8% contraction due to e-commerce shift")
     * top_skill_demand: Actual in-demand skill from job postings data
     * pivot_necessity: "High", "Moderate", or "Low" based on market volatility

2. labour_market_snapshot:
   - overview: 2 paragraphs with SPECIFIC STATISTICS from BLS (employment rates, job growth %, wage trends)
   - local_vs_national: Compare ${location} metrics to national averages using actual data
   - major_drivers: 3-5 specific factors (e.g., "Tech hub expansion in Tempe", "Healthcare aging population", NOT generic phrases)
   - market_health: 
     * employment_rate: Actual % from BLS data
     * job_growth_rate: Actual % from BLS data
     * trend: "Growing", "Stable", or "Declining" based on data

3. chart_data:
   - job_growth: { title, data: [{ month: "Jan 2024", positions: <actual number> }, ...] } 
     Use 12 months of REAL data from BLS. If missing, extrapolate from trends but note it.
   - top_skills_demand: { title: "Top Skills Demand in 2025", categories: [
     {
       quadrant: "Emerging Stars" | "Strategic Must-Haves" | "Stable Foundations" | "Niche Specialists",
       description: Brief description of this category,
       skills: [{
         category: General category name (e.g., "Cloud Computing", "Data Analytics", "AI & Machine Learning"),
         description: What this skill category encompasses,
         examples: Array of 3-4 specific examples (e.g., ["AWS", "Azure", "Google Cloud"] for Cloud Computing),
         demand_level: "High" | "Medium" | "Growing",
         growth_trend: Brief trend description,
         why: Why this skill matters for ${location} job market (1-2 sentences, e.g., "Bay Area AI companies need people who can ship and maintain models, not just research them."),
         so_what: What to do about it / how to start (2-3 sentences with actionable advice, e.g., "Start by watching introductory MLOps content and experimenting with simple model deployment tutorials.")
       }]
     }
   ] }
   Generate exactly 4 quadrant categories with 4 general skill categories each (16 total skills).
   Use GENERAL skill categories (e.g., "Cloud Platforms", "Modern Frameworks", "Database Technologies") not specific tools.
   Each category should have 3-4 concrete examples in the examples array.

4. report_sources: Array of ONLY the actual source names/titles from the context documents you used. DO NOT add sources that don't appear in the context.
   Example: ["U.S. Bureau of Labor Statistics Employment Report", "Reuters - Tech Sector News Oct 2024"]
   DO NOT include: Generic names like "Career Center", "Chamber of Commerce", "Indeed.com" unless they literally appear as document sources in the context.

CRITICAL: 
- Use VARIED growth outlooks (not all "Growing")
- Cite specific data sources (BLS report codes, news article dates, economic indicators)
- Include ACTUAL job titles in key_roles (never leave empty)
- Use REAL salary data - vary by sector appropriately
- Reference specific local factors for ${location}

Return ONLY valid JSON with NO markdown formatting.`;
}

/**
 * Part 2: Opportunities & Risks
 * Focuses on: high_growth_sectors, at_risk_sectors, skills_in_demand, pathways
 */
function buildOpportunitiesPrompt(location: string): string {
  return `Generate career opportunities and skills data for ${location}.

Provide a JSON response with these sections:

1. city_vs_region_comparison (ALWAYS GENERATE - REQUIRED):
   - title: "[City Name] vs Broader Region Comparison"
   - data: Array of 4-5 comparison objects with:
     * factor: Comparison category (e.g., "Overall job market trend", "Remote / hybrid work trend", "Notable structural shifts", "Cost of living / compensation", "Industry distribution")
     * city: Conditions in the city (e.g., "${location}")
     * wider_region: Conditions in the broader region (state/metro area outside the city)
   - IMPORTANT: Generate this for ALL locations, not just Bay Area. Use regional data from context.
   - Example for San Francisco:
     {
       "factor": "Overall job market trend",
       "city": "High-skill, high-volatility – strong demand in AI, frontier tech, finance, product, design; repeated restructuring in big tech and startups.",
       "wider_region": "Mixed but resilient – strong in healthcare, education, logistics, clean energy, advanced manufacturing and public services, with tech distributed across the region."
     }

3. high_growth_sectors: Array of EXACTLY 10 sectors with:
   - sector: High-Growth Sector name (e.g., "AI & Advanced Tech (SF, Palo Alto, South Bay)")
   - growth_outlook: "Expanding" | "Growing" (one of these two)
   - example_roles: Array of 4-6 specific job titles and specializations
   - why_it_matters: 2-3 sentences on why this sector matters for ${location} job seekers
   - risk_reality_check: 3-4 sentences grounded in recent news/data about realistic challenges and risks in this sector
   
   NOTE: Generate EXACTLY 10 sectors covering diverse areas. Use the user's provided list as reference.

4. at_risk_sectors: Array of EXACTLY 10 role clusters / sectors with:
   - sector: At-Risk Role Cluster name (e.g., "Traditional front-end / generalist software engineers")
   - automation_reason: Specific reason why this role is at risk (e.g., "AI coding tools, offshore talent, and shift toward AI/infra work")
   - pivot_direction: Where to pivot (e.g., "Aim for AI engineering, infra/platform, security engineering...")
   - risk_reality_check: 4-5 sentences grounded in recent 2025 news/reports about automation impact and hiring realities
   
   NOTE: Generate EXACTLY 10 at-risk clusters. Use the user's provided list as reference, including realistic data about job cuts, AI adoption, and structural shifts.

5. strategies_by_profile:
   - new_graduates: Array of 5-6 brief, actionable strategies
   - mid_career_pivoting: Array of 5-6 brief, actionable strategies
   - newcomers_international: Array of 5-6 brief, actionable strategies

5. action_checklist: Array of 8-10 action items with:
   - action: Brief action
   - category: "Immediate" | "Short-term" | "Long-term"
   - priority: "High" | "Medium" | "Low"
   - estimated_time: Time estimate (e.g., "2 hours", "1 week")

Use coaching language. Cite sources. Return ONLY valid JSON.`;
}

/**
 * Part 3: Action Plan & Insights
 * Focuses on: strategies, action_checklist, findings, news, opportunities
 */
function buildActionPlanPrompt(location: string): string {
  return `Generate actionable strategies and market intelligence for ${location}. Use ONLY data from the context provided. DO NOT invent sources.

IMPORTANT: ONLY cite sources that actually appear in the retrieved context documents. Do NOT make up source names.

Provide a JSON response with these sections:

1. strategies_by_profile:
   - new_graduates: Array of 10+ specific, actionable strategies
   - mid_career_pivoting: Array of 10+ specific, actionable strategies  
   - newcomers_international: Array of 10+ specific, actionable strategies

2. stop_start_doubledown:
   - stop: Array of 10+ things to stop doing
   - start: Array of 10+ things to start doing
   - double_down: Array of 10+ things to double down on

3. action_checklist: Array of 10+ actions with:
   - action: Specific action item
   - category: "Immediate", "Short-term", "Long-term"
   - timeframe: Specific timeframe (e.g., "This week", "Next 30 days", "3-6 months")
   - local_resources: ACTUAL local resources in ${location} (specific organizations, programs, websites)

4. key_findings: Array of 8-10 findings with VARIED data:
   - impact_level: "High", "Medium", or "Low" (VARY THESE - not all High!)
   - insight: Specific finding citing data (e.g., "Cloud computing jobs grew 34% in Phoenix metro area (BLS Q2 2024)")
   - action_item: Actionable recommendation
   - driving_force: ONLY use sources from the context. Examples of VALID formats:
     * "Bureau of Labor Statistics" (if BLS data in context)
     * "Market report: [specific title from context]"
     * "News article: [specific headline from context]"
     DO NOT use: "Phoenix Business Journal", "Arizona Commerce Authority", "Indeed", "Census Bureau" or ANY source name unless it literally appears in your context documents.
     When in doubt, use "Labor market data" or "Economic indicators"

5. market_risks: Array of 4-6 risks with VARIED severity:
   - risk: Specific risk
   - severity: "High", "Medium", "Low" (MUST VARY - not all same!)
   - affected_sectors: Array of sectors
   - mitigation_strategy: Actionable advice

6. market_news: Array of 5-8 news items with:
   - headline: Actual or synthesized headline from news data
   - summary: 2-3 sentences
   - impact: "Positive", "Negative", "Mixed", "Neutral" (VARY THESE!)
   - relevance_score: Number 1-10
   - source: ACTUAL news source from context
   - date: ACTUAL date from context

7. specific_opportunities: Array of 6-8 opportunities with:
   - title: Specific opportunity
   - description: Details
   - sector: Industry sector
   - skills_required: Array of skills
   - accessibility: "Entry-level", "Mid-level", "Senior", "All levels"

8. closing_perspective: Empowering 2-paragraph conclusion with coaching tone

9. report_sources: Array of ONLY the actual source names from the context documents you referenced. 
    CRITICAL: Only include sources that literally appear in the retrieved context. 
    DO NOT add: "Career Center", "Chamber of Commerce", "Indeed.com", "Upwork", "Remote.co", "Meetup groups" or similar unless they are explicitly in the context.
    If you only have BLS data and news articles, ONLY list those actual sources.

CRITICAL REQUIREMENTS:
- VARY impact levels in key_findings (mix High, Medium, Low)
- VARY severity in risks (mix High, Medium, Low)
- Use DIFFERENT driving_force citations (BLS, news articles, reports, etc.)
- Reference ACTUAL companies, programs, and resources in ${location}
- Cite specific dates, percentages, and statistics from the data

Return ONLY valid JSON with NO markdown formatting.`;
}

/**
 * Validate that response has all required fields
 */
function validateCoreData(data: MarketInsightsData): void {
  const required = ['executive_summary', 'labour_market_snapshot', 'chart_data'];
  const missing = required.filter(field => !data[field]);
  if (missing.length > 0) {
    logger.warn(`⚠️  Missing fields in core data (using defaults): ${missing.join(', ')}`);
    // Add missing fields with defaults instead of throwing
    if (!data.executive_summary) data.executive_summary = { overview: 'N/A', key_stats: {} };
    if (!data.labour_market_snapshot) data.labour_market_snapshot = { overview: 'N/A', major_drivers: [], market_health: {} };
    if (!data.chart_data) data.chart_data = { job_growth: { data: [] }, top_skills_demand: { data: [] } };
  }
}

function validateOpportunities(data: MarketInsightsData): void {
  const required = ['high_growth_sectors', 'at_risk_sectors', 'career_pathways', 'strategies_by_profile', 'action_checklist'];
  const missing = required.filter(field => !data[field]);
  if (missing.length > 0) {
    logger.warn(`⚠️  Missing fields in opportunities (using defaults): ${missing.join(', ')}`);
    if (!data.city_vs_region_comparison) data.city_vs_region_comparison = { title: 'City vs Region Comparison', data: [] };
    if (!data.high_growth_sectors) data.high_growth_sectors = [];
    if (!data.at_risk_sectors) data.at_risk_sectors = [];
    if (!data.career_pathways) data.career_pathways = [];
    if (!data.strategies_by_profile) data.strategies_by_profile = { new_graduates: [], mid_career_pivoting: [], newcomers_international: [] };
    if (!data.action_checklist) data.action_checklist = [];
  }
}

function validateActionPlan(data: MarketInsightsData): void {
  const required = ['strategies_by_profile', 'stop_start_doubledown', 'action_checklist', 'key_findings'];
  const missing = required.filter(field => !data[field]);
  if (missing.length > 0) {
    logger.warn(`⚠️  Missing fields in action plan (using defaults): ${missing.join(', ')}`);
    if (!data.strategies_by_profile) data.strategies_by_profile = { new_graduates: [], mid_career_pivoting: [], newcomers_international: [] };
    if (!data.stop_start_doubledown) data.stop_start_doubledown = { stop: [], start: [], double_down: [] };
    if (!data.action_checklist) data.action_checklist = [];
    if (!data.key_findings) data.key_findings = [];
    if (!data.market_risks) data.market_risks = [];
    if (!data.market_news) data.market_news = [];
    if (!data.specific_opportunities) data.specific_opportunities = [];
  }
}

/**
 * Generate market insights using multi-part approach
 * @param {string} location - User's location
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Combined market insights
 */
export async function generateMarketInsights(
  location: string,userId: string, jobId?: string, error?: string): Promise<MarketInsightsData>{
  try {
    logger.info(`📊 Starting multi-part market insights generation for: ${location}`);

    //Adding redis logging for monitoring
    const cacheKey = `market_insights:${location.toLowerCase().replace(/\s+/g, "_")}`;

    const cached = await safeGet(cacheKey);

    if (cached) {
      logger.info(`-->> Redis cache hit for ${location}.`);
      logger.info(`-->>Cache key: ${cacheKey} hit.`);
      //use websocket to emit progress if jobId provided
      if (jobId) {
        emitJobProgress(jobId, { 
          stage: 'completed', 
          insights: JSON.parse(cached) 
        });
      }
      return JSON.parse(cached);
  }

logger.info(`🧊 Redis cache miss for ${location}. Running full pipeline...`);

    // Part 1: Core data and charts (most important)
    logger.info('📊 Part 1/3: Fetching core market data and charts...');
    let coreData: MarketInsightsData;
    try {
        // Part 1: Core data and charts
      logger.info('📊 Part 1/3: Fetching core market data...');
      if (jobId) {
        emitJobProgress(jobId, { 
          stage: 'Fetching core market data', 
          progress: 33 
        });
      }
      const result = await generateWithRAG(
        buildCoreDataPrompt(location),
        SYSTEM_PROMPT,
        {
          namespaces: ['bls-data', 'news-data', 'reports-data'],
          topKPerNamespace: {
            'bls-data': 12,
            'news-data': 10,
            'reports-data': 8,
          },
          responseFormat: 'json',
          useCache: true,
        }
      ) as Record<string, unknown>;
      
      coreData = result;
      validateCoreData(coreData);
      logger.info('✓ Part 1/3 completed: Core data received');
      // Emit progress after Part 1 completes successfully
      if (jobId) {
        emitJobProgress(jobId, { 
          stage: 'Core market data received', 
          progress: 33 
        });
      }
    } catch (error) {
      const err = error as Error;
      
      logger.error('❌ Part 1/3 failed:', err.message);
        // Emit error if jobId exists
        if (jobId) {
          emitJobProgress(jobId, {   
            stage: 'error', 
            error: 'Failed to fetch core market data' 
          });
        }
  
      // Provide minimal fallback for core data
      coreData = {
        executive_summary_brief: 'Market summary temporarily unavailable. Please try again.',
        executive_summary: {
          overview: 'Market data temporarily unavailable. Please try again.',
          key_stats: {
            strongest_opportunity: 'Data pending',
            highest_risk_sector: 'Data pending',
            top_skill_demand: 'Data pending',
            pivot_necessity: 'Low'
          }
        },
        labour_market_snapshot: {
          overview: 'Market snapshot temporarily unavailable.',
          local_vs_national: 'Data pending',
          major_drivers: ['Data temporarily unavailable'],
          market_health: {
            employment_rate: 'N/A',
            job_growth_rate: 'N/A',
            trend: 'Stable'
          }
        },
        chart_data: {
          job_growth: { title: 'Job Growth', data: [] },
          top_skills_demand: { title: 'Skills Demand', data: [] }
        }
      };
      logger.warn('⚠️  Using fallback data for Part 1');
    }

    // Part 2: Opportunities and skills (high value)
    logger.info('📊 Part 2/3: Fetching opportunities and skills analysis...');
    if (jobId) {
      emitJobProgress(jobId, { 
        stage: 'Analyzing opportunities and skills', 
        progress: 66 
      });
    }
    let opportunities: MarketInsightsData;
    try {
      const result = await generateWithRAG(
        buildOpportunitiesPrompt(location),
        SYSTEM_PROMPT,
        {
          namespaces: ['bls-data', 'news-data', 'reports-data'],
          topKPerNamespace: {
            'bls-data': 8,
            'news-data': 8,
            'reports-data': 5,
          },
          responseFormat: 'json',
          useCache: true,
        }
      ) as Record<string, unknown>;
      
      opportunities = result;
      validateOpportunities(opportunities);
      logger.info('✓ Part 2/3 completed: Opportunities data received');
      // Emit progress after Part 2 completes successfully
      if (jobId) {
        emitJobProgress(jobId, { 
          stage: 'Opportunities and skills analysis complete', 
          progress: 66 
        });
      }
    } catch (error) {
      const err = error as Error;
      logger.error('❌ Part 2/3 failed:', err.message);
      // Emit error if jobId exists
        if (jobId) {
          emitJobProgress(jobId, {   
            stage: 'error', 
            error: 'Failed to fetch opportunities and skills data' 
          });
        }
      // Provide minimal fallback
      opportunities = {
        city_vs_region_comparison: { title: 'City vs Region Comparison', data: [] },
        high_growth_sectors: [],
        at_risk_sectors: [],
        career_pathways: [],
        strategies_by_profile: {
          new_graduates: [],
          mid_career_pivoting: [],
          newcomers_international: []
        },
        action_checklist: []
      };
      logger.warn('⚠️  Using fallback data for Part 2');
    }

    // Part 3: Action plans and insights (supplementary)
    logger.info('📊 Part 3/3: Fetching action plans and market intelligence...');
    if (jobId) {
      emitJobProgress(jobId, { 
        stage: 'Building action plans and insights', 
        progress: 90 
      });
    }
    let actionPlan: MarketInsightsData;
    try {
      const result = await generateWithRAG(
        buildActionPlanPrompt(location),
        SYSTEM_PROMPT,
        {
          namespaces: ['news-data', 'bls-data', 'reports-data'],
          topKPerNamespace: {
            'news-data': 12,
            'bls-data': 10,
            'reports-data': 8,
          },
          responseFormat: 'json',
          useCache: true,
        }
      ) as Record<string, unknown>;
      
      actionPlan = result;
      validateActionPlan(actionPlan);
      logger.info('✓ Part 3/3 completed: Action plan data received');
      // Emit progress after Part 3 completes successfully
      if (jobId) {
        emitJobProgress(jobId, { 
          stage: 'Action plans and insights complete', 
          progress: 95 
        });
      }
    } catch (error) {
      const err = error as Error;
      logger.error('❌ Part 3/3 failed:', err.message);
      // Emit error if jobId exists
      if (jobId) {
        emitJobProgress(jobId, {   
          stage: 'error', 
          error: 'Failed to fetch action plans and insights data' 
        });
      }
      // Provide minimal fallback
      actionPlan = {
        strategies_by_profile: {
          new_graduates: [],
          mid_career_pivoting: [],
          newcomers_international: []
        },
        stop_start_doubledown: {
          stop: [],
          start: [],
          double_down: []
        },
        action_checklist: [],
        key_findings: [],
        market_risks: [],
        market_news: [],
        specific_opportunities: [],
        closing_perspective: 'Market insights will be available shortly.',
        report_sources: []
      };
      logger.warn('⚠️  Using fallback data for Part 3');
    }

    // Combine all parts and merge report_sources arrays
    const combinedInsights: MarketInsightsData = {
      ...coreData,
      ...opportunities,
      ...actionPlan,
    };

    // Merge report_sources from all three parts to show ALL sources used
    const allSources = new Set<string>();
    if (coreData.report_sources && Array.isArray(coreData.report_sources)) {
      (coreData.report_sources as string[]).forEach(source => allSources.add(source));
    }
    if (opportunities.report_sources && Array.isArray(opportunities.report_sources)) {
      (opportunities.report_sources as string[]).forEach(source => allSources.add(source));
    }
    if (actionPlan.report_sources && Array.isArray(actionPlan.report_sources)) {
      (actionPlan.report_sources as string[]).forEach(source => allSources.add(source));
    }
    
    // Update combined insights with all unique sources
    combinedInsights.report_sources = Array.from(allSources).filter(s => s && s.trim());

    logger.info(`✓ Successfully generated complete market insights for ${location}`);
    logger.info(`📊 Response includes: ${Object.keys(combinedInsights).length} sections`);
    logger.info(`📚 Total sources used: ${(combinedInsights.report_sources as string[]).length}`);
    
    // Store in Redis cache for 30 minutes
    const result = await safeSet(cacheKey, JSON.stringify(combinedInsights), 60 * 30);
    if (result) {
    logger.info(`-->>Cache key: ${cacheKey} set with 30 min TTL`);
    logger.info(`-->>Stored market insights in Redis cache for ${location} (30 min TTL)`);
    }
    // Send final result via WebSocket
    if (jobId) {
      emitJobProgress(jobId, { 
        stage: 'completed', 
        insights: combinedInsights 
      });
    }
    return combinedInsights;
  } catch (error) {
      logger.error(`Error generating market insights for ${location}:`, error);

        // Emit error via WebSocket if jobId exists
        if (jobId) {
          emitJobProgress(jobId, { 
            stage: 'error', 
            error: 'Failed to generate market insights' 
          });
        }
        throw error;
  }
}


// marketInsightsService_multipart.ts with 10 word prompt but same code:

// import { generateWithRAG } from './ragService.js';
// import { logger } from '../utils/logger.js';
// import redisClient from "../lib/redis.js";
// import { safeGet, safeSet } from "../lib/redis.js"; 
// const SYSTEM_PROMPT = `You are a career development coach and labor market analyst. `;
// /**
//  * Generate market insights using multi-part approach
//  * @param {string} location - User's location
//  * @param {string} userId - User ID
//  * @returns {Promise<Object>} Combined market insights
//  */
// export async function generateMarketInsights(location: string, userId: string): Promise<MarketInsightsData> {
//   try {
//     logger.info(`📊 Starting multi-part market insights generation for: ${location}`)  ;
//     //Adding redis logging for monitoring
//     const cacheKey = `market_insights:${location.toLowerCase().replace(/\s+/g, "_")}`;
//     const cached = await safeGet(cacheKey);
//     if (cached) {
//       logger.info(`-->> Redis cache hit for ${location}.`);
//       logger.info(`-->>Cache key: ${cacheKey} hit.`);
//       return JSON.parse(cached);
//   }
// logger.info(`🧊 Redis cache miss for ${location}. Running full pipeline...`) ;
//     // Part 1: Core data and charts (most important)
//     logger.info('📊 Part 1/3: Fetching core market data and charts...') ;
//     let coreData: MarketInsightsData;
//     try {
//       const result = await generateWithRAG(
//         buildCoreDataPrompt(location),
//         SYSTEM_PROMPT,
//         {
//           namespaces: ['bls-data', 'news-data', 'reports-data'],
//           topKPerNamespace: {
//             'bls-data': 12,
//             'news-data': 10,
//             'reports-data': 8,
//           },
//           responseFormat: 'json',
//           useCache: true,
//         }
//       ) as Record<string, unknown>;
//       coreData = result;
//       validateCoreData(coreData);
//       logger.info('✓ Part 1/3 completed: Core data received') ;
//     } catch (error) {
//       const err = error as Error;
//       logger.error('❌ Part 1/3 failed:', err.message) ;
//       // Provide minimal fallback for core data
//       coreData = {
//         executive_summary_brief: 'Market summary temporarily unavailable. Please try again.',
//         executive_summary: {
//           overview: 'Market data temporarily unavailable. Please try again.',
//           key_stats: {
//             strongest_opportunity: 'Data pending',
//             highest_risk_sector: 'Data pending',
//             top_skill_demand: 'Data pending',
//             pivot_necessity: 'Low'
//           }
//         },
//         labour_market_snapshot: {
//           overview: 'Market snapshot temporarily unavailable.',
//           local_vs_national: 'Data pending',
//           major_drivers: ['Data temporarily unavailable'],
//           market_health: {
//             employment_rate: 'N/A',
//             job_growth_rate: 'N/A',
//             trend: 'Stable'
//           }
//         },
//         chart_data: {
//           job_growth: { title: 'Job Growth', data: [] },
//           top_skills_demand: { title: 'Skills Demand', data: [] }
//         }
//       };
//       logger.warn('⚠️  Using fallback data for Part 1') ;
//     }
//     // Part 2: Opportunities and skills (high value)
//     logger.info('📊 Part 2/3: Fetching opportunities and skills analysis...') ;
//     let opportunities: MarketInsightsData;
//     try {
//       const result = await generateWithRAG(
//         buildOpportunitiesPrompt(location),
//         SYSTEM_PROMPT,
//         {
//           namespaces: ['bls-data', 'news-data', 'reports-data'],
//           topKPerNamespace: {
//             'bls-data': 8,
//             'news-data': 8,
//             'reports-data': 5,
//           },
//           responseFormat: 'json',
//           useCache: true,
//         }                  
//       ) as Record<string, unknown>;
//       opportunities = result;
//       validateOpportunities(opportunities);
//       logger.info('✓ Part 2/3 completed: Opportunities data received') ;
//     } catch (error) {
//       const err = error as Error;
//       logger.error('❌ Part 2/3 failed:', err.message) ;
//       // Provide minimal fallback
//       opportunities = {
//         city_vs_region_comparison: { title: 'City vs Region Comparison', data: [] },
//         high_growth_sectors: [],
//         at_risk_sectors: [],
//         career_pathways: [],
//         strategies_by_profile: {
//           new_graduates: [],
//           mid_career_pivoting: [],
//           newcomers_international: []
//         },
//         action_checklist: []           
//       };
//       logger.warn('⚠️  Using fallback data for Part 2') ;
//     }
//     // Part 3: Action plans and insights (supplementary)
//     logger.info('📊 Part 3/3: Fetching action plans and market intelligence...') ;
//     let actionPlan: MarketInsightsData;
//     try {
//       const result = await generateWithRAG(
//         buildActionPlanPrompt(location),
//         SYSTEM_PROMPT,
//         {
//           namespaces: ['news-data', 'bls-data', 'reports-data'],
//           topKPerNamespace: {
//             'news-data': 12,
//             'bls-data': 10,
//             'reports-data': 8,
//           },
//           responseFormat: 'json',
//           useCache: true,
//         }
//       ) as Record<string, unknown>;
//       actionPlan = result;
//       validateActionPlan(actionPlan);
//       logger.info('✓ Part 3/3 completed: Action plan data received') ;
//     } catch (error) {
//       const err = error as Error;
//       logger.error(' ❌ Part 3/3 failed:', err.message) ;      
//       // Provide minimal fallback
//       actionPlan = {
//         strategies_by_profile: {
//           new_graduates: [],
//           mid_career_pivoting: [],
//           newcomers_international: []
//         },
//         stop_start_doubledown: {
//           stop: [],
//           start: [],
//           double_down: []
//         },
//         action_checklist: [],
//         key_findings: [],
//         market_risks: [],
//         market_news: [],
//         specific_opportunities: [],
//         closing_perspective: 'Market insights will be available shortly.',
//         report_sources: []
//       };
//       logger.warn('⚠️  Using fallback data for Part 3') ;
//     }
//     // Combine all parts and merge report_sources arrays
//     const combinedInsights: MarketInsightsData = {
//       ...coreData,
//       ...opportunities,
//       ...actionPlan,
//     };
//     // Merge report_sources from all three parts to show ALL sources used
//     const allSources = new Set<string>();
//     if   (coreData.report_sources && Array.isArray(coreData.report_sources)) {
//       (coreData.report_sources as string[]).forEach(source => allSources.add(source));
//     }    
//     if (opportunities.report_sources && Array.isArray(opportunities.report_sources)) {
//       (opportunities.report_sources as string[]).forEach(source => allSources.add(source));
//     }
//     if (actionPlan.report_sources && Array.isArray(actionPlan.report_sources)) {
//       (actionPlan.report_sources as string[]).forEach(source => allSources.add(source));
//     }
//     // Update combined insights with all unique sources
//     combinedInsights.report_sources = Array.from(allSources).filter(s => s && s.trim());
//     logger.info(`✓ Successfully generated complete market insights for ${location}`) ;
//     logger.info(`📊 Response includes: ${Object.keys(combinedInsights).length} sections`) ;
//     logger.info(`📚 Total sources used: ${(combinedInsights.report_sources as string[]).length}`) 
//   // Store in Redis cache for 30 minutes
//   await safeSet(cacheKey, JSON.stringify(combinedInsights), 60 * 30)
//  logger.info(`-->>Cache key: ${cacheKey} set with 30 min TTL`) 
//   logger.info(`-->>Stored market insights in Redis cache for ${location} (30 min TTL)`) 
//   return combinedInsights;
//   } catch (error) {
//     logger.error(`Error generating market insights for ${location}:`, error) ;
//     throw error;
//   }
// }
