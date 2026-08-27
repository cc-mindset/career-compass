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

export interface ComparisonData {
  factor: string;
  city: string;
  wider_region: string;
}

export interface CityVsRegionComparison {
  title: string;
  data: ComparisonData[];
}

/** Overview UI: one row in "Three shifts affecting you". */
export interface MarketShift {
  title: string;
  summary: string;
}

export interface MarketReportData {
  market_report_summary_brief: string;
  market_report_summary: MarketReportSummary;
  labour_market_snapshot: LabourMarketSnapshot;
  city_vs_region_comparison: CityVsRegionComparison;
  report_sources: string[];
  market_report_verdict?: MarketReportVerdict;
  market_shifts?: MarketShift[];
}
