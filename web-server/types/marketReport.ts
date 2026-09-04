export type MarketSignalLevel = 'Stable' | 'High' | 'Low';

export interface MarketReportSignals {
  role_demand: MarketSignalLevel;
  competition: MarketSignalLevel;
  evidence_quality: MarketSignalLevel;
}

/** UI hero block for Market Report overview (guest + registered). */
export interface MarketReportVerdict {
  verdict_label: string;
  outlook_label: string;
  headline: string;
  summary: string;
  signals: MarketReportSignals;
}

export interface SummaryKeyStats {
  strongest_opportunity: string;
  highest_risk_sector: string;
  top_skill_demand: string;
  pivot_necessity: string;
}

export interface MarketReportSummary {
  overview: string;
  summary_key_stats: SummaryKeyStats;
}

export interface MarketHealth {
  employment_rate: string;
  job_growth_rate: string;
  trend: string;
}

export interface LabourMarketSnapshot {
  overview: string;
  local_vs_national: string;
  major_drivers: string[];
  market_health: MarketHealth;
}

/** Overview UI: one row in "Three shifts affecting you". */
export interface MarketShift {
  title: string;
  summary: string;
}

/**
 * Overview market-direction chart. NOT requested from the LLM — the shipped
 * Overview chart is currently a static illustration with no live data
 * consumer at all, and building real local-vs-national series requires a
 * geo-code + series-id resolution layer that doesn't exist yet (see
 * docs/product/MarketReportPrompts.docx §3). This type documents the
 * intended contract; normalizeMarketReportVerdict() always injects the
 * `available: false` placeholder shape below until that resolution layer
 * ships.
 */
export interface HiringTrendPoint {
  period: string;
  local_index: number;
  national_index: number;
}

export interface HiringTrendSeries {
  available: boolean;
  window_label: string;
  local_label: string;
  national_label: string;
  points: HiringTrendPoint[];
}

export interface MarketReportData {
  market_report_summary_brief: string;
  market_report_summary: MarketReportSummary;
  labour_market_snapshot: LabourMarketSnapshot;
  report_sources: string[];
  market_report_verdict?: MarketReportVerdict;
  market_shifts?: MarketShift[];
}
