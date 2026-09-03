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
  quadrant: string;
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

/** Opportunities tab "Locations" view — NEW, replaces a client routing bug that showed risk data here. */
export interface GrowthLocation {
  name: string;
  summary: string;
  signal: string;
  marketDetail: string;
  meaningDetail: string;
}

/** Skills & actions tab "3 capabilities" — NEW, replaces reading raw top_skills_demand (up to 8 entries) directly. */
export interface PriorityCapability {
  name: string;
  demand_level: string;
  evidence_building_action: string;
}

/** Skills & actions tab "30-day focus" — NEW, currently 100% hardcoded client-side. */
export interface ThirtyDayFocusItem {
  label: string;
  action: string;
}

export interface IndustryTrendData {
  growth_sectors: GrowthSector[];
  at_risk_sectors: AtRiskSector[];
  top_skills_demand: TopSkillsDemand;
  growth_locations?: GrowthLocation[];
  priority_capabilities?: PriorityCapability[];
  thirty_day_focus?: ThirtyDayFocusItem[];
  market_risks: MarketRisk[];
  report_sources: string[];
}
