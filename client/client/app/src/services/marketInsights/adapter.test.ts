import { describe, expect, it } from 'vitest';
import { adaptMarketInsights } from './adapter';
import type { MarketInsightsPayload } from './types';

describe('adaptMarketInsights', () => {
  it('returns null for missing insights', () => {
    expect(adaptMarketInsights(null)).toBeNull();
    expect(adaptMarketInsights(undefined)).toBeNull();
  });

  it('maps live growth sectors and skills without inventing sector names', () => {
    const payload: MarketInsightsPayload = {
      market_report_summary_brief: 'Demand is steady in Toronto product roles.',
      labour_market_snapshot: {
        market_health: { trend: 'Stable', job_growth_rate: '2.1%' },
        major_drivers: ['Fintech hiring'],
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
      report_sources: [{ name: 'BLS', role: 'Stats', date: '2026-01' }],
    };

    const adapted = adaptMarketInsights(payload);
    expect(adapted).not.toBeNull();
    expect(adapted!.fromLive).toBe(true);
    expect(adapted!.summary).toContain('Demand is steady');
    expect(adapted!.opportunities[0]?.name).toBe('Fintech product');
    expect(adapted!.skills[0]?.name).toBe('Stakeholder management');
    expect(adapted!.sources[0]?.name).toBe('BLS');
    expect(adapted!.opportunities.some((o) => o.name === 'Invented Sector')).toBe(
      false,
    );
  });
});
