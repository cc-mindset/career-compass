import { describe, expect, it } from 'vitest';
import { adaptMarketInsights, mapMarketShifts } from './adapter';
import type { MarketInsightsPayload } from './types';

describe('mapMarketShifts', () => {
  it('uses market_shifts with distinct summaries', () => {
    const payload: MarketInsightsPayload = {
      market_shifts: [
        { title: 'Healthcare demand rising', summary: 'Aging population is expanding care roles.' },
        { title: 'Professional services growth', summary: 'Consulting and tech services are hiring.' },
        { title: 'Public sector stability', summary: 'Government employment anchors the local market.' },
      ],
    };

    const shifts = mapMarketShifts(payload, []);
    expect(shifts).toHaveLength(3);
    expect(new Set(shifts.map((s) => s.copy)).size).toBe(3);
  });

  it('does not duplicate local_vs_national for every major_driver', () => {
    const shared = 'Sudbury demonstrates a lower unemployment rate versus national figures.';
    const payload: MarketInsightsPayload = {
      labour_market_snapshot: {
        major_drivers: [
          'Healthcare demand due to aging population',
          'Growth in professional and technical services',
          'Strong public sector employment',
        ],
        local_vs_national: shared,
      },
      city_vs_region_comparison: {
        title: 'Sudbury vs region',
        data: [
          { factor: 'Healthcare demand', city: 'Hospital expansions drive nursing hiring.', wider_region: 'Regional care demand is steady.' },
          { factor: 'Professional services', city: 'Consulting firms are adding analysts.', wider_region: 'Broader region sees moderate growth.' },
          { factor: 'Public sector', city: 'Municipal and provincial roles remain stable.', wider_region: 'Public employment is flat region-wide.' },
        ],
      },
    };

    const adapted = adaptMarketInsights({
      ...payload,
      market_report_verdict: {
        verdict_label: 'Stable market',
        outlook_label: 'Mixed 12-month outlook',
        headline: 'Sudbury hiring remains steady for your role.',
        summary: 'Local demand is resilient across healthcare and public sector roles.',
        signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'Stable' },
      },
    });

    expect(adapted!.shifts).toHaveLength(3);
    expect(adapted!.shifts.every((s) => s.copy !== shared)).toBe(true);
    expect(new Set(adapted!.shifts.map((s) => s.copy)).size).toBe(3);
  });
});

describe('adaptMarketInsights', () => {
  it('returns null for missing insights', () => {
    expect(adaptMarketInsights(null)).toBeNull();
    expect(adaptMarketInsights(undefined)).toBeNull();
  });

  it('maps live growth sectors and skills without inventing sector names', () => {
    const payload: MarketInsightsPayload = {
      market_report_summary_brief: 'Demand is steady in Toronto product roles.',
      market_report_verdict: {
        verdict_label: 'Stable market',
        outlook_label: 'Cautious 12-month outlook',
        headline: 'Demand is steady in Toronto product roles.',
        summary:
          'Toronto hiring remains resilient for senior product leaders. Employers continue to prioritize regulated-platform experience and AI-enabled delivery.',
        signals: {
          role_demand: 'Stable',
          competition: 'High',
          evidence_quality: 'Stable',
        },
      },
      market_report_summary: {
        overview:
          'Toronto hiring remains resilient for senior product leaders. Employers continue to prioritize regulated-platform experience and AI-enabled delivery.',
        summary_key_stats: {
          strongest_opportunity: 'Fintech product',
          highest_risk_sector: 'Retail management',
          top_skill_demand: 'Stakeholder management',
          pivot_necessity: 'High',
        },
      },
      labour_market_snapshot: {
        market_health: { trend: 'Stable', job_growth_rate: '2.1%' },
        major_drivers: ['Fintech hiring'],
        local_vs_national: 'Toronto demand runs above the national baseline.',
      },
      growth_sectors: [
        {
          sector: 'Fintech product',
          why_it_matters: 'Digital banking investment continues.',
          growth_outlook: 'Growing',
        },
      ],
      top_skills_demand: {
        categories: [
          {
            skills: [
              {
                category: 'Stakeholder management',
                demand_level: 'High',
                why: 'Cross-team delivery is required.',
              },
            ],
          },
        ],
      },
      report_sources: [
        { name: 'BLS', role: 'Stats', date: '2026-01' },
        { name: 'StatsCan', role: 'Stats', date: '2026-01' },
        { name: 'Indeed', role: 'Postings', date: '2026-01' },
      ],
    };

    const adapted = adaptMarketInsights(payload);
    expect(adapted).not.toBeNull();
    expect(adapted!.fromLive).toBe(true);
    expect(adapted!.headline).toBe('Demand is steady in Toronto product roles.');
    expect(adapted!.summary).toContain('Toronto hiring remains resilient');
    expect(adapted!.verdictLabel).toBe('Stable market');
    expect(adapted!.outlookLabel).toBe('Cautious 12-month outlook');
    expect(adapted!.signals).toEqual([
      { label: 'Role demand', value: 'Stable' },
      { label: 'Competition', value: 'High' },
      { label: 'Evidence quality', value: 'Stable' },
    ]);
    expect(adapted!.opportunities[0]?.name).toBe('Fintech product');
    expect(adapted!.skills[0]?.name).toBe('Stakeholder management');
    expect(adapted!.sources[0]?.name).toBe('BLS');
    expect(adapted!.opportunities.some((o) => o.name === 'Invented Sector')).toBe(
      false,
    );
  });

  it('prefers deterministic evidence_sources over the LLM-reported source bag', () => {
    const payload: MarketInsightsPayload = {
      market_report_verdict: {
        verdict_label: 'Stable market',
        outlook_label: 'Cautious 12-month outlook',
        headline: 'Demand holds for your role.',
        summary: 'Employers keep hiring for this role.',
        signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'High' },
      },
      // LLM's own self-reported bag — should be ignored when evidence_sources exists.
      report_sources: ['ChatGPT-invented Report 2026'],
      evidence_sources: [
        {
          id: 'labor-market-stats::STATSCAN_LFS::',
          namespace: 'labor-market-stats',
          lens: 'Labor market statistics',
          label: 'Statistics Canada — Labour Force Survey (LFS)',
          sourceCode: 'STATSCAN_LFS',
        },
        {
          id: 'market-news::Reuters::Layoffs hit tech',
          namespace: 'market-news',
          lens: 'Market news',
          label: 'Reuters — Layoffs hit tech (2026)',
          sourceCode: 'Reuters',
          title: 'Layoffs hit tech',
          publishedAt: '2026-02-01',
        },
      ],
    };

    const adapted = adaptMarketInsights(payload);
    expect(adapted!.sources).toEqual([
      { name: 'Statistics Canada — Labour Force Survey (LFS)', role: 'Labor market statistics', date: 'Recent' },
      { name: 'Reuters — Layoffs hit tech (2026)', role: 'Market news', date: '2026-02-01' },
    ]);
    expect(adapted!.sources.some((s) => s.name === 'ChatGPT-invented Report 2026')).toBe(false);
  });

  it('falls back to the legacy source bag when evidence_sources is absent', () => {
    const payload: MarketInsightsPayload = {
      market_report_verdict: {
        verdict_label: 'Stable market',
        outlook_label: 'Cautious 12-month outlook',
        headline: 'Demand holds for your role.',
        summary: 'Employers keep hiring for this role.',
        signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'Stable' },
      },
      report_sources: ['Indeed Hiring Lab'],
    };

    const adapted = adaptMarketInsights(payload);
    expect(adapted!.sources[0]?.name).toBe('Indeed Hiring Lab');
  });
});
