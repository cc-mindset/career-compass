import type {
  MarketReportVerdict,
  MarketSignalLevel,
} from '../../types/marketReport';

type MarketInsightsData = Record<string, unknown>;

const SIGNAL_LEVELS: MarketSignalLevel[] = ['Stable', 'High', 'Low'];

const str = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

const asObj = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asArr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const firstSentence = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : trimmed.slice(0, 180).trim();
};

export const coerceSignalLevel = (
  value: unknown,
  fallback: MarketSignalLevel,
): MarketSignalLevel => {
  const normalized = str(value).toLowerCase();
  if (
    normalized.includes('high') ||
    normalized.includes('grow') ||
    normalized.includes('strong') ||
    normalized.includes('critical')
  ) {
    return 'High';
  }
  if (
    normalized.includes('low') ||
    normalized.includes('declin') ||
    normalized.includes('soft') ||
    normalized.includes('weak')
  ) {
    return 'Low';
  }
  if (
    normalized.includes('stable') ||
    normalized.includes('moderate') ||
    normalized.includes('mixed') ||
    normalized.includes('steady')
  ) {
    return 'Stable';
  }
  if (SIGNAL_LEVELS.includes(str(value) as MarketSignalLevel)) {
    return str(value) as MarketSignalLevel;
  }
  return fallback;
};

const verdictFromTrend = (trend: string): string => {
  const level = coerceSignalLevel(trend, 'Stable');
  if (level === 'High') return 'Growing market';
  if (level === 'Low') return 'Softening market';
  return 'Stable market';
};

const outlookFromPivot = (pivot: string): string => {
  const level = coerceSignalLevel(pivot, 'Stable');
  if (level === 'High') return 'Cautious 12-month outlook';
  if (level === 'Low') return 'Positive 12-month outlook';
  return 'Mixed 12-month outlook';
};

const evidenceFromSourceCount = (count: number): MarketSignalLevel => {
  if (count >= 8) return 'High';
  if (count >= 3) return 'Stable';
  return 'Low';
};

const parseVerdict = (raw: unknown): MarketReportVerdict | null => {
  const verdict = asObj(raw);
  if (!verdict) return null;

  const signalsRaw = asObj(verdict.signals);
  const headline = str(verdict.headline);
  const summary = str(verdict.summary);
  if (!headline || !summary || !signalsRaw) return null;

  return {
    verdict_label: str(verdict.verdict_label, 'Stable market'),
    outlook_label: str(verdict.outlook_label, 'Positive 12-month outlook'),
    headline,
    summary,
    signals: {
      role_demand: coerceSignalLevel(signalsRaw.role_demand, 'Stable'),
      competition: coerceSignalLevel(signalsRaw.competition, 'High'),
      evidence_quality: coerceSignalLevel(signalsRaw.evidence_quality, 'Stable'),
    },
  };
};

const backfillVerdict = (insights: MarketInsightsData): MarketReportVerdict => {
  const summaryBrief = str(insights.market_report_summary_brief);
  const reportSummary = asObj(insights.market_report_summary);
  const keyStats = asObj(reportSummary?.summary_key_stats);
  const labour = asObj(insights.labour_market_snapshot);
  const marketHealth = asObj(labour?.market_health);

  const overview = str(reportSummary?.overview);
  const localVsNational = str(labour?.local_vs_national);
  const trend = str(marketHealth?.trend, 'Stable');
  const pivotNecessity = str(keyStats?.pivot_necessity, 'High');

  const sourceCount = [
    ...asArr(insights.report_sources),
    ...asArr(insights.sources),
  ].length;

  const headline =
    summaryBrief ||
    firstSentence(overview) ||
    localVsNational ||
    'Market conditions for your role and location';

  let summary = overview || localVsNational || summaryBrief || headline;
  if (summary.startsWith(headline) && summary.length > headline.length) {
    summary = summary.slice(headline.length).trim();
  }
  if (!summary) summary = headline;

  return {
    verdict_label: verdictFromTrend(trend),
    outlook_label: outlookFromPivot(pivotNecessity),
    headline,
    summary,
    signals: {
      role_demand: coerceSignalLevel(trend, 'Stable'),
      competition: coerceSignalLevel(pivotNecessity, 'High'),
      evidence_quality: evidenceFromSourceCount(sourceCount),
    },
  };
};

/** Ensure combined insights include a prototype-shaped market_report_verdict block. */
export function normalizeMarketReportVerdict(
  insights: MarketInsightsData,
): MarketInsightsData {
  const backfilled = backfillVerdict(insights);
  const parsed = parseVerdict(insights.market_report_verdict);
  if (parsed) {
    return { ...insights, market_report_verdict: parsed };
  }

  const partial = asObj(insights.market_report_verdict);
  const partialSignals = asObj(partial?.signals);

  const market_report_verdict: MarketReportVerdict = {
    verdict_label: str(partial?.verdict_label, backfilled.verdict_label),
    outlook_label: str(partial?.outlook_label, backfilled.outlook_label),
    headline: str(partial?.headline) || backfilled.headline,
    summary: str(partial?.summary) || backfilled.summary,
    signals: partialSignals
      ? {
          role_demand: coerceSignalLevel(partialSignals.role_demand, backfilled.signals.role_demand),
          competition: coerceSignalLevel(partialSignals.competition, backfilled.signals.competition),
          evidence_quality: coerceSignalLevel(
            partialSignals.evidence_quality,
            backfilled.signals.evidence_quality,
          ),
        }
      : backfilled.signals,
  };

  return {
    ...insights,
    market_report_verdict,
  };
}
