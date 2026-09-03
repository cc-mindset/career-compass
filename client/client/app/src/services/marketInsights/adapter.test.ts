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

  it('maps growth_locations, priority_capabilities and thirty_day_focus (NEW fields)', () => {
    const payload: MarketInsightsPayload = {
      growth_locations: [
        { name: 'Toronto, Ontario', summary: 'Largest local market.', signal: 'Strongest market' },
      ],
      priority_capabilities: [
        { name: 'AI workflow design', demand_level: 'High demand', evidence_building_action: 'Build one case study.' },
      ],
      thirty_day_focus: [{ label: 'Week 1', action: 'Choose one AI-enabled example.' }],
    };

    const adapted = adaptMarketInsights(payload);
    expect(adapted!.locations).toEqual([
      { name: 'Toronto, Ontario', summary: 'Largest local market.', signal: 'Strongest market' },
    ]);
    expect(adapted!.capabilities[0]).toMatchObject({ name: 'AI workflow design', demand: 'High demand' });
    expect(adapted!.focusWeeks).toEqual([{ label: 'Week 1', action: 'Choose one AI-enabled example.' }]);
  });

  it('"Best matches"/"Emerging" read specific job titles (example_roles), not sector names — genuinely distinct from "Sectors"', () => {
    const payload: MarketInsightsPayload = {
      growth_sectors: [
        {
          sector: 'AI & Advanced Tech',
          growth_outlook: 'Expanding',
          why_it_matters: 'AI investment is broad-based.',
          example_roles: ['AI Product Lead', 'ML Platform Engineer'],
        },
        {
          sector: 'FinTech & Payments',
          growth_outlook: 'Growing',
          why_it_matters: 'Payments modernization continues.',
          example_roles: ['Payments Product Manager', 'Risk Platform Lead'],
        },
      ],
    };

    const adapted = adaptMarketInsights(payload);
    // "Best matches" shows specific job titles, not sector names.
    expect(adapted!.opportunities.map((o) => o.name)).toEqual([
      'AI Product Lead',
      'ML Platform Engineer',
      'Payments Product Manager',
      'Risk Platform Lead',
    ]);
    // "Sectors" shows sector names — a genuinely different list.
    expect(adapted!.sectors.map((s) => s.name)).toEqual(['AI & Advanced Tech', 'FinTech & Payments']);
    // "Emerging" prefers roles from a "Growing"-flagged parent sector.
    expect(adapted!.emerging.map((e) => e.name)).toEqual(
      expect.arrayContaining(['Payments Product Manager', 'Risk Platform Lead']),
    );
  });

  it('"sectors" no longer falls through to risk data (previous client routing bug)', () => {
    const payload: MarketInsightsPayload = {
      growth_sectors: [
        { sector: 'Fintech product', why_it_matters: 'Investment continues.', growth_outlook: 'Expanding' },
      ],
      at_risk_sectors: [{ sector: 'Retail ops', automation_reason: 'Self-checkout.', pivot_direction: 'Logistics' }],
    };

    const adapted = adaptMarketInsights(payload);
    expect(adapted!.sectors.some((s) => s.name === 'Retail ops')).toBe(false);
    expect(adapted!.sectors[0]?.name).toBe('Fintech product');
  });

  it('"emerging" prefers growth_outlook === "Growing" instead of duplicating "best matches"', () => {
    const payload: MarketInsightsPayload = {
      growth_sectors: [
        { sector: 'Fintech product', growth_outlook: 'Expanding', why_it_matters: 'a' },
        { sector: 'AI product ops', growth_outlook: 'Growing', why_it_matters: 'b' },
      ],
    };

    const adapted = adaptMarketInsights(payload);
    expect(adapted!.emerging[0]?.name).toBe('AI product ops');
  });

  it('builds evidenceTags from evidence_lens_coverage, in the fixed 3-group order', () => {
    const payload: MarketInsightsPayload = {
      evidence_lens_coverage: {
        'Technology & regulation': ['Generative AI & automation'],
        'Economy & industry': [],
        'People & place': ['Local business trends'],
      },
    };

    const adapted = adaptMarketInsights(payload);
    expect(adapted!.evidenceTags[0]).toEqual(['Generative AI & automation']);
    expect(adapted!.evidenceTags[1]).toEqual(['Live market signal']); // empty group falls back
    expect(adapted!.evidenceTags[2]).toEqual(['Local business trends']);
  });

  it('derives up to 10 distinct "See all insights" items, not 3 duplicated ones', () => {
    const payload: MarketInsightsPayload = {
      market_shifts: [
        { title: 'Shift A', summary: 'Summary A' },
        { title: 'Shift B', summary: 'Summary B' },
        { title: 'Shift C', summary: 'Summary C' },
      ],
      growth_sectors: [
        { sector: 'Sector A', why_it_matters: 'Why A', growth_outlook: 'Growing' },
        { sector: 'Sector B', why_it_matters: 'Why B', growth_outlook: 'Growing' },
        { sector: 'Sector C', why_it_matters: 'Why C', growth_outlook: 'Growing' },
      ],
      at_risk_sectors: [
        { sector: 'Risk A', risk_reality_check: 'Check A', pivot_direction: 'Pivot A' },
        { sector: 'Risk B', risk_reality_check: 'Check B', pivot_direction: 'Pivot B' },
      ],
      priority_capabilities: [
        { name: 'Cap A', demand_level: 'High demand', evidence_building_action: 'Action A' },
        { name: 'Cap B', demand_level: 'Growing', evidence_building_action: 'Action B' },
      ],
    };

    const adapted = adaptMarketInsights(payload);
    expect(adapted!.insights).toHaveLength(10);
    // meaning/action must not be identical across every item (the bug being fixed).
    const distinctMeanings = new Set(adapted!.insights.map((i) => i.meaning));
    expect(distinctMeanings.size).toBeGreaterThan(1);
    const distinctActions = new Set(adapted!.insights.map((i) => i.action));
    expect(distinctActions.size).toBeGreaterThan(1);
    expect(adapted!.insights.map((i) => i.category)).toEqual([
      'Market shift', 'Market shift', 'Market shift',
      'Opportunity', 'Opportunity', 'Opportunity',
      'Risk', 'Risk',
      'Skills', 'Skills',
    ]);
  });
});
