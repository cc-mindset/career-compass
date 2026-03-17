export interface MarketNewsItem {
  headline: string;
  summary: string;
  impact: string;
  relevance_score: number;
  source: string;
  date: string;
}

export interface StrategiesByExperience {
  new_graduates: string[];
  mid_career_pivoting: string[];
  newcomers_international: string[];
}

export interface KeyFinding {
  impact_level: string;
  insight: string;
  action_item: string;
  driving_force: string;
}

export interface MarketNewsData {
  market_news: MarketNewsItem[];
  strategies_by_experience: StrategiesByExperience;
  key_findings: KeyFinding[];
  report_sources: string[];
}
