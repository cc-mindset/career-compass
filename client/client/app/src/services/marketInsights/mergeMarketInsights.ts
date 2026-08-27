import type { MarketInsightsPayload } from './types';
import { adaptMarketInsights } from './adapter';
import { GENERIC_OVERVIEW_HEADLINE } from './constants';

export { GENERIC_OVERVIEW_HEADLINE } from './constants';

const asObj = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const str = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

/** Merge one multipart LLM section payload into accumulated insights. */
export function mergeMarketSection(
  accumulated: MarketInsightsPayload,
  _section: string,
  data: unknown,
): MarketInsightsPayload {
  const sectionData = asObj(data);
  if (!sectionData) return accumulated;
  return { ...accumulated, ...sectionData };
}

/** True when Part 1 data is enough to render the overview hero + shifts. */
export function isMarketOverviewReady(insights: MarketInsightsPayload | null | undefined): boolean {
  if (!insights) return false;
  if (asObj(insights.market_report_verdict)) return true;
  const summary = asObj(insights.market_report_summary);
  const labour = asObj(insights.labour_market_snapshot);
  return Boolean(summary?.overview && labour?.major_drivers);
}

export function mergeStatusInsights(
  accumulated: MarketInsightsPayload,
  statusInsights: MarketInsightsPayload,
): MarketInsightsPayload {
  return { ...accumulated, ...statusInsights };
}

/** True when verdict signals are present (badge + strip can render). */
export function hasMarketVerdictSignals(
  insights: MarketInsightsPayload | null | undefined,
): boolean {
  if (!insights) return false;
  const signals = asObj(asObj(insights.market_report_verdict)?.signals);
  if (!signals) return false;
  return Boolean(
    str(signals.role_demand) && str(signals.competition) && str(signals.evidence_quality),
  );
}

/** True when adapted overview hero has real coaching copy (not generic backfill). */
export function isMarketOverviewDisplayReady(
  insights: MarketInsightsPayload | null | undefined,
): boolean {
  const adapted = adaptMarketInsights(insights);
  if (!adapted) return false;
  const headline = adapted.headline.trim();
  return headline.length > 0 && headline !== GENERIC_OVERVIEW_HEADLINE;
}
