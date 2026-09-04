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

  it('overrides evidence_quality from evidence_sources even when the LLM returned a full verdict', () => {
    const insights = {
      market_report_verdict: {
        headline: 'Demand is rising for your role.',
        summary: 'Employers are hiring again in your metro.',
        signals: { role_demand: 'High', competition: 'High', evidence_quality: 'Low' },
      },
      // 8 deduped, retrieval-derived sources -> evidenceFromSourceCount => 'High',
      // overriding the LLM's own self-reported 'Low' above.
      evidence_sources: Array.from({ length: 8 }, (_, i) => ({
        id: `s${i}`,
        namespace: 'market-news',
        lens: 'Market news',
        label: `Source ${i}`,
        sourceCode: `SRC_${i}`,
      })),
    };

    const result = normalizeMarketReportVerdict(insights);
    expect(result.market_report_verdict?.signals.evidence_quality).toBe('High');
    // untouched narrative signals still come from the LLM
    expect(result.market_report_verdict?.signals.role_demand).toBe('High');
  });

  it('overrides evidence_quality from evidence_sources in the backfilled branch too', () => {
    const insights = {
      market_report_summary_brief: 'Demand is steady.',
      report_sources: ['only-one-legacy-source'],
      evidence_sources: [
        { id: 's1', namespace: 'market-news', lens: 'Market news', label: 'A', sourceCode: 'A' },
        { id: 's2', namespace: 'market-news', lens: 'Market news', label: 'B', sourceCode: 'B' },
        { id: 's3', namespace: 'market-news', lens: 'Market news', label: 'C', sourceCode: 'C' },
      ],
    };

    const result = normalizeMarketReportVerdict(insights);
    // 1 legacy source would be 'Low'; 3 real evidence_sources is 'Stable' and wins.
    expect(result.market_report_verdict?.signals.evidence_quality).toBe('Stable');
  });

  it('always injects the hiring_trend_series placeholder — never requested from the LLM', () => {
    const result = normalizeMarketReportVerdict({});
    expect(result.hiring_trend_series).toEqual({
      available: false,
      window_label: '',
      local_label: '',
      national_label: '',
      points: [],
    });
  });

  it('preserves a well-formed hiring_trend_series if one is already present', () => {
    const preComputed = {
      available: true,
      window_label: 'Last 60 days',
      local_label: 'Toronto',
      national_label: 'Canada',
      points: [{ period: 'Week 1', local_index: 101, national_index: 100 }],
    };
    const result = normalizeMarketReportVerdict({ hiring_trend_series: preComputed });
    expect(result.hiring_trend_series).toEqual(preComputed);
  });
});
