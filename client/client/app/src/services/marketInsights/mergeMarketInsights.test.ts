import { describe, expect, it } from 'vitest';
import { GENERIC_OVERVIEW_HEADLINE } from './constants';
import {
  hasMarketVerdictSignals,
  isMarketOverviewDisplayReady,
  isMarketOverviewReady,
  mergeMarketSection,
} from './mergeMarketInsights';

describe('mergeMarketInsights', () => {
  it('isMarketOverviewReady is true when market_report_verdict has signals', () => {
    expect(
      isMarketOverviewReady({
        market_report_verdict: {
          verdict_label: 'Stable market',
          outlook_label: 'Positive 12-month outlook',
          headline: 'Headline',
          summary: 'Summary',
          signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'High' },
        },
      }),
    ).toBe(true);
  });

  it('isMarketOverviewReady is false for verdict without signals', () => {
    expect(
      isMarketOverviewReady({
        market_report_verdict: { headline: 'Pending' },
      }),
    ).toBe(false);
  });

  it('isMarketOverviewReady is false before Part 1 lands', () => {
    expect(isMarketOverviewReady({ growth_sectors: [] })).toBe(false);
  });

  it('mergeMarketSection spreads section keys into accumulated insights', () => {
    const merged = mergeMarketSection({}, 'marketReport', {
      market_report_verdict: { headline: 'Ready' },
      labour_market_snapshot: { major_drivers: ['AI hiring'] },
    });
    expect(merged.market_report_verdict).toEqual({ headline: 'Ready' });
    expect(merged.labour_market_snapshot).toEqual({ major_drivers: ['AI hiring'] });
  });

  it('isMarketOverviewDisplayReady is false for generic backfill headline', () => {
    expect(
      isMarketOverviewDisplayReady({
        market_report_verdict: {
          verdict_label: 'Stable market',
          headline: GENERIC_OVERVIEW_HEADLINE,
          summary: GENERIC_OVERVIEW_HEADLINE,
          signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'Stable' },
        },
      }),
    ).toBe(false);
  });

  it('isMarketOverviewDisplayReady is true for a real coaching headline', () => {
    expect(
      isMarketOverviewDisplayReady({
        market_report_verdict: {
          verdict_label: 'Stable market',
          headline: 'Edmonton demand is steady for senior digital marketing roles.',
          summary: 'Employers continue hiring in financial services marketing.',
          signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'High' },
        },
      }),
    ).toBe(true);
  });

  it('hasMarketVerdictSignals is true when verdict signals exist', () => {
    expect(
      hasMarketVerdictSignals({
        market_report_verdict: {
          signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'Stable' },
        },
      }),
    ).toBe(true);
  });

  it('hasMarketVerdictSignals is false without signals', () => {
    expect(
      hasMarketVerdictSignals({
        market_report_verdict: { headline: 'Pending' },
      }),
    ).toBe(false);
  });
});
