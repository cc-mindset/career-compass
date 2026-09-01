import { describe, expect, it } from 'vitest';
import { GENERIC_OVERVIEW_HEADLINE } from './constants';
import {
  hasMarketVerdictSignals,
  isMarketOverviewDisplayReady,
  isMarketOverviewReady,
  mergeMarketSection,
} from './mergeMarketInsights';
import { adaptMarketInsights } from './adapter';

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
    const merged = mergeMarketSection({}, 'marketReportVerdict', {
      market_report_verdict: { headline: 'Ready' },
      market_shifts: [{ title: 'Shift A', summary: 'Copy A' }],
    });
    expect(merged.market_report_verdict).toEqual({ headline: 'Ready' });
    expect(merged.market_shifts).toEqual([{ title: 'Shift A', summary: 'Copy A' }]);
  });

  it('verdict payload with market_shifts adapts to three shifts', () => {
    const insights = {
      market_report_verdict: {
        verdict_label: 'Stable market',
        outlook_label: 'Positive 12-month outlook',
        headline: 'Headline',
        summary: 'Summary',
        signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'High' },
      },
      market_shifts: [
        { title: 'Shift one', summary: 'First change for the user.' },
        { title: 'Shift two', summary: 'Second change for the user.' },
        { title: 'Shift three', summary: 'Third change for the user.' },
      ],
    };
    expect(isMarketOverviewReady(insights)).toBe(true);
    const adapted = adaptMarketInsights(insights);
    expect(adapted?.shifts).toHaveLength(3);
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
