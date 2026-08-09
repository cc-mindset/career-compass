import type {
  AdaptedMarketReport,
  AdaptedOpportunity,
  AdaptedSkill,
  AdaptedSource,
  MarketInsightsPayload,
} from './types';

const str = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

const asObj = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asArr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const demandWidth = (demand: string): string => {
  const d = demand.toLowerCase();
  if (d.includes('critical') || d.includes('very high') || d.includes('hot')) return '92%';
  if (d.includes('high')) return '84%';
  if (d.includes('medium') || d.includes('moderate')) return '68%';
  if (d.includes('low')) return '42%';
  return '74%';
};

const mapGrowthSector = (raw: unknown): AdaptedOpportunity | null => {
  const o = asObj(raw);
  if (!o) return null;
  const name = str(o.sector || o.name || o.title);
  if (!name) return null;
  return {
    name,
    summary: str(o.why_it_matters || o.growth_outlook || o.summary, 'Growth outlook available in full report.'),
    signal: str(o.growth_outlook || o.signal, 'Growing'),
  };
};

const mapRiskSector = (raw: unknown): AdaptedOpportunity | null => {
  const o = asObj(raw);
  if (!o) return null;
  const name = str(o.sector || o.name || o.risk);
  if (!name) return null;
  return {
    name,
    summary: str(o.automation_reason || o.mitigation_strategy || o.summary, 'Risk detail available in full report.'),
    signal: str(o.severity || o.risk_reality_check || o.signal, 'At risk'),
  };
};

const mapSkill = (raw: unknown): AdaptedSkill | null => {
  const o = asObj(raw);
  if (!o) return null;
  const name = str(o.category || o.name || o.skill);
  if (!name) return null;
  const demand = str(o.demand_level || o.growth_trend || o.demand, 'In demand');
  return {
    name,
    demand,
    action: str(o.why || o.so_what || o.description, 'Prioritize in your next learning sprint.'),
    width: demandWidth(demand),
  };
};

const mapSource = (raw: unknown, index: number): AdaptedSource => {
  if (typeof raw === 'string') {
    return { name: raw, role: 'Source', date: 'Recent' };
  }
  const o = asObj(raw);
  return {
    name: str(o?.name || o?.title || o?.source, `Source ${index + 1}`),
    role: str(o?.role || o?.publisher || o?.type, 'Reference'),
    date: str(o?.date || o?.published_at, 'Recent'),
  };
};

/**
 * Map API market insights sections into Market Report tab view-models.
 * Tolerates partial / evolving section shapes from the multipart generator.
 */
export function adaptMarketInsights(insights: MarketInsightsPayload | null | undefined): AdaptedMarketReport | null {
  if (!insights) return null;

  const summaryBrief = str(insights.market_report_summary_brief);
  const reportSummary = asObj(insights.market_report_summary);
  const keyStats = asObj(reportSummary?.summary_key_stats);
  const labour = asObj(insights.labour_market_snapshot);
  const marketHealth = asObj(labour?.market_health);

  const growth = asArr(insights.growth_sectors).map(mapGrowthSector).filter(Boolean) as AdaptedOpportunity[];
  const risks = [
    ...asArr(insights.at_risk_sectors).map(mapRiskSector),
    ...asArr(insights.market_risks).map(mapRiskSector),
  ].filter(Boolean) as AdaptedOpportunity[];

  const skillCategories = asObj(insights.top_skills_demand);
  const nestedSkills = asArr(skillCategories?.categories).flatMap((cat) => {
    const c = asObj(cat);
    return asArr(c?.skills);
  });
  const flatSkills = asArr(insights.skills);
  const skills = [...nestedSkills, ...flatSkills].map(mapSkill).filter(Boolean) as AdaptedSkill[];

  const news = asArr(insights.market_news)
    .map((item) => {
      if (typeof item === 'string') return item;
      const o = asObj(item);
      return str(o?.title || o?.headline);
    })
    .filter(Boolean);

  const sourceBag = [
    ...asArr(insights.report_sources),
    ...asArr(insights.sources),
  ];

  const headline =
    str(reportSummary?.overview) ||
    summaryBrief ||
    str(labour?.overview) ||
    'Market conditions for your role and location';

  const summary =
    summaryBrief ||
    str(labour?.local_vs_national) ||
    headline;

  const drivers = asArr(labour?.major_drivers).map((d) => str(d)).filter(Boolean);
  const shifts =
    drivers.length > 0
      ? drivers.slice(0, 3).map((title) => ({
          title,
          copy: str(labour?.local_vs_national, 'Local demand is shifting relative to the wider region.'),
        }))
      : growth.slice(0, 3).map((g) => ({ title: g.name, copy: g.summary }));

  const signals = [
    {
      label: 'Opportunity',
      value: str(keyStats?.strongest_opportunity || growth[0]?.name, 'See opportunities'),
    },
    {
      label: 'Risk',
      value: str(keyStats?.highest_risk_sector || risks[0]?.name, 'See risks'),
    },
    {
      label: 'Skill demand',
      value: str(keyStats?.top_skill_demand || skills[0]?.name, 'See skills'),
    },
    {
      label: 'Job growth',
      value: str(marketHealth?.job_growth_rate || marketHealth?.trend, '—'),
    },
  ];

  const tags = skills.slice(0, 4).map((s) => s.name);
  const evidenceTags = [
    news.slice(0, 3),
    growth.slice(0, 3).map((g) => g.name),
    skills.slice(0, 3).map((s) => s.name),
  ].map((row) => (row.length ? row : ['Live market signal']));

  return {
    verdictLabel: str(marketHealth?.trend, 'Live outlook'),
    outlookLabel: str(marketHealth?.employment_rate || keyStats?.pivot_necessity, 'Market snapshot'),
    headline,
    summary,
    signals,
    shifts: shifts.length
      ? shifts
      : [{ title: 'Market update', copy: summary }],
    recommendation: {
      title: 'What this means for you',
      copy: str(
        keyStats?.pivot_necessity || labour?.local_vs_national,
        'Use the opportunities and skills tabs to prioritize your next move.',
      ),
    },
    path: {
      title: 'Suggested focus',
      copy: str(
        growth[0]?.summary || skills[0]?.action,
        'Lean into the highest-demand skills and growth sectors in this report.',
      ),
      tags: tags.length ? tags : ['Market skills'],
    },
    opportunities: growth.slice(0, 6),
    emerging: growth.slice(0, 3),
    risks: risks.slice(0, 6),
    skills: skills.slice(0, 8),
    sources: sourceBag.map(mapSource),
    evidenceTags,
    newsTitles: news.slice(0, 8),
    fromLive: true,
  };
}
