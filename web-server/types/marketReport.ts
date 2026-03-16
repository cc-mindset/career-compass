export interface KeyStats {
  strongest_opportunity: string;
  highest_risk_sector: string;
  top_skill_demand: string;
  pivot_necessity: string;
}

export interface ExecutiveSummary {
  overview: string;
  key_stats: KeyStats;
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

export interface MarketReportData {
  executive_summary_brief: string;
  executive_summary: ExecutiveSummary;
  labour_market_snapshot: LabourMarketSnapshot;
  city_vs_region_comparison: CityVsRegionComparison;
  report_sources: string[];
}
