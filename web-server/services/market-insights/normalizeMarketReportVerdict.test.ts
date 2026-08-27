import { describe, expect, it } from 'vitest';
import { normalizeMarketReportVerdict } from './normalizeMarketReportVerdict';

describe('normalizeMarketReportVerdict', () => {
  it('returns LLM verdict when present and coerces signal enums', () => {
    const insights = {
      market_report_verdict: {
        verdict_label: ' Growing market ',
        outlook_label: 'Positive 12-month outlook',
        headline: 'Demand is rising for your role.',
        summary: 'Employers are hiring again in your metro.',
        signals: {
          role_demand: 'Growing',
          competition: 'very high',
          evidence_quality: 'High',
        },
      },
    };

    const result = normalizeMarketReportVerdict(insights);
    expect(result.market_report_verdict).toEqual({
      verdict_label: 'Growing market',
      outlook_label: 'Positive 12-month outlook',
      headline: 'Demand is rising for your role.',
      summary: 'Employers are hiring again in your metro.',
      signals: {
        role_demand: 'High',
        competition: 'High',
        evidence_quality: 'High',
      },
    });
  });

  it('backfills verdict from legacy fields when market_report_verdict is missing', () => {
    const insights = {
      market_report_summary_brief:
        'Demand is steady in Toronto product roles.',
      market_report_summary: {
        overview:
          'Toronto hiring remains resilient for senior product leaders. Employers continue to prioritize regulated-platform experience.',
        summary_key_stats: {
          strongest_opportunity: 'Fintech',
          highest_risk_sector: 'Retail',
          top_skill_demand: 'Stakeholder management',
          pivot_necessity: 'High',
        },
      },
      labour_market_snapshot: {
        market_health: { trend: 'Stable' },
        local_vs_national: 'Toronto demand runs above the national baseline.',
      },
      report_sources: ['BLS', 'StatsCan', 'Indeed'],
    };

    const result = normalizeMarketReportVerdict(insights);
    expect(result.market_report_verdict?.verdict_label).toBe('Stable market');
    expect(result.market_report_verdict?.outlook_label).toBe('Cautious 12-month outlook');
    expect(result.market_report_verdict?.headline).toBe(
      'Demand is steady in Toronto product roles.',
    );
    expect(result.market_report_verdict?.summary).toContain('Toronto hiring remains resilient');
    expect(result.market_report_verdict?.signals).toEqual({
      role_demand: 'Stable',
      competition: 'High',
      evidence_quality: 'Stable',
    });
  });
});
