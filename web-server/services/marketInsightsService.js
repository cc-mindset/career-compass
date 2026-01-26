import { generateWithRAG } from './ragService.js';
import { logger } from '../utils/logger.js';

/**
 * Market Insights Service
 * Generates comprehensive market insights for a location using RAG
 */

/**
 * System prompt for market insights generation
 */
const SYSTEM_PROMPT = `You are an expert career coach and labour market analyst who creates comprehensive, data-driven career guidance reports in JSON format.

Your reports combine:
- Real data from BLS statistics, World Economic Forum, OECD, ILO, national/regional labour statistics, and industry reports
- Practical career coaching with empowering, human language
- Concrete, actionable guidance for job seekers

CRITICAL REQUIREMENTS:
1. Base ALL analysis on the provided data sources (news reports, BLS employment statistics, market research)
2. Always cite data sources in plain language (e.g., "based on WEF Future of Jobs findings", "using BLS regional data")
3. If data is limited or conflicting, say so explicitly and explain your reasoning
4. Use plain language - avoid jargon, use short sentences, concrete examples
5. For EVERY bullet list requested, provide AT LEAST 10 items (unless absolutely impossible)
6. Connect big trends directly to what job seekers should THINK, FEEL, and DO

COACHING PHILOSOPHY:
- Normalize career pivots as rational, data-backed decisions
- Explicitly state when roles are shrinking due to MARKET changes, not personal failure
- Use phrases like: "Some roles are shrinking. That means you need a strategic pivot, not just a better CV."
- Validate scary career changes with stats and trends
- Make insights feel like powerful career coaching, not just analysis

TONE: Calm, practical, hopeful, encouraging. Focus on clarity and actionable next steps.`;

/**
 * Build comprehensive career coaching prompt for market insights
 */
function buildMarketInsightsPrompt(location) {
  return `Based on the REAL data provided above, create a comprehensive FUTURE OF WORK career coaching report for job seekers in ${location}.

This report must feel like powerful career coaching, not just labour market analysis. Use the data to empower job seekers to make smart, confident career decisions.

Generate a detailed JSON response. Provide AT LEAST 10 items for each major list section (high_growth_sectors, at_risk_sectors, technical skills, human skills, pathways, strategies per profile, stop/start/double items, action checklist). Include 8-10 key_findings, 4-6 market_risks and sectors_actively_hiring, 5-8 market_news items.

The JSON must include these sections with actual data from the context:
- executive_summary (with overview text and key_stats object)
- labour_market_snapshot (with overview, local_vs_national, major_drivers, market_health)
- high_growth_sectors (array of 10+ sectors with growth_level, why_growing, example_roles, local_or_national, data_source)
- at_risk_sectors (array of 10+ roles with risk_level, why_declining, impact_on_jobseekers, pivot_direction, coaching_message, data_source)
- skills_in_demand (object with technical_digital_skills and human_power_skills arrays, 10+ each)
- pathways (array of 10+ pathway objects with pathway_type, description, examples, accessibility)
- strategies_by_profile (object with new_graduates, mid_career_pivoting, newcomers_international arrays, 10+ each)
- stop_start_doubledown (object with stop, start, double_down arrays, 10+ each)
- action_checklist (array of 10+ actions with action, category, timeframe, local_resources)
- closing_perspective (text paragraph)
- chart_data (with job_growth, salary_trends, top_skills_demand objects)
- sector_analysis (array)
- sectors_actively_hiring (array 4-6 items)
- key_findings (array 8-10 items with impact_level, insight, action_item, driving_force)
- market_risks (array 4-6 items)
- market_news (array 5-8 items)
- specific_opportunities (array 6-8 items)
- report_sources (array)

Use coaching language that normalizes pivots and validates fears. Cite data sources in plain language. Make it empowering and actionable.

Return ONLY valid JSON, no markdown formatting.`;
}

/**
 * Generate market insights for a location
 * @param {string} location - User's location (city, state)
 * @param {string} userId - User ID for potential personalization
 * @returns {Promise<Object>} Market insights data
 */
export async function generateMarketInsights(location, userId) {
  try {
    logger.info(`📊 Generating market insights for location: ${location}`);

    // Generate insights using RAG
    const insights = await generateWithRAG(
      buildMarketInsightsPrompt(location),
      SYSTEM_PROMPT,
      {
        namespaces: ['news-data', 'bls-data', 'reports-data'],
        topKPerNamespace: {
          'news-data': 10,
          'bls-data': 10,
          'reports-data': 8,
        },
        responseFormat: 'json',
        useCache: true,
      }
    );

    logger.info(`✓ Successfully generated market insights for ${location}`);
    
    return insights;
  } catch (error) {
    logger.error('Error generating market insights:', error);
    throw error;
  }
}

/**
 * Validate market insights structure
 * Ensures the generated insights match expected frontend structure
 */
export function validateInsightsStructure(insights) {
  const required = [
    'executive_summary',
    'labour_market_snapshot',
    'high_growth_sectors',
    'at_risk_sectors',
    'skills_in_demand',
    'pathways',
    'strategies_by_profile',
    'stop_start_doubledown',
    'action_checklist',
    'closing_perspective',
    'chart_data',
    'sector_analysis',
    'sectors_actively_hiring',
    'key_findings',
    'market_risks',
    'specific_opportunities',
    'report_sources',
  ];

  const missing = required.filter(field => !(field in insights));

  if (missing.length > 0) {
    logger.warn(`Missing required fields: ${missing.join(', ')}`);
    return false;
  }

  return true;
}
