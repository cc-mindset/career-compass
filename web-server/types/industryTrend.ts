export interface GrowthSector {
  sector: string;
  growth_outlook: string;
  example_roles: string[];
  why_it_matters: string;
  risk_reality_check: string;
}

export interface AtRiskSector {
  sector: string;
  automation_reason: string;
  pivot_direction: string;
  risk_reality_check: string;
}

export interface Skill {
  category: string;
  description: string;
  examples: string[];
  demand_level: string;
  growth_trend: string;
  why: string;
  so_what: string;
}

export interface SkillCategory {
  category: string;
  description: string;
  skills: Skill[];
}

export interface TopSkillsDemand {
  title: string;
  categories: SkillCategory[];
}

export interface MarketRisk {
  risk: string;
  severity: string;
  affected_sectors: string[];
  mitigation_strategy: string;
}

export interface IndustryTrendData {
  growth_sectors: GrowthSector[];
  at_risk_sectors: AtRiskSector[];
  top_skills_demand: TopSkillsDemand;
  market_risks: MarketRisk[];
  report_sources: string[];
}
