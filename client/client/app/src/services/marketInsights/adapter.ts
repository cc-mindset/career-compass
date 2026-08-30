import type {
  AdaptedMarketReport,
  AdaptedMarketShift,
  AdaptedOpportunity,
  AdaptedSkill,
  AdaptedSource,
  MarketInsightsPayload,
} from './types';
import { GENERIC_OVERVIEW_HEADLINE } from './constants';

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

/** Maps a deterministic, retrieval-derived EvidenceSourcePayload (see types.ts). */
const mapEvidenceSource = (raw: unknown): AdaptedSource | null => {
  const o = asObj(raw);
  if (!o) return null;
  const name = str(o.label);
  if (!name) return null;
  return {
    name,
    role: str(o.lens, 'Reference'),
    date: str(o.publishedAt, 'Recent'),
  };
};

const mapVerdictSignals = (raw: unknown) => {
  const signals = asObj(raw);
  if (!signals) return null;

  const roleDemand = str(signals.role_demand);
  const competition = str(signals.competition);
  const evidenceQuality = str(signals.evidence_quality);
  if (!roleDemand || !competition || !evidenceQuality) return null;

  return [
    { label: 'Role demand', value: roleDemand },
    { label: 'Competition', value: competition },
    { label: 'Evidence quality', value: evidenceQuality },
  ];
};

const mapShiftRow = (raw: unknown): AdaptedMarketShift | null => {
  const o = asObj(raw);
  if (!o) return null;
  const title = str(o.title || o.name || o.factor || o.sector || o.driver);
  const copy = str(o.summary || o.copy || o.why_it_matters || o.city || o.description);
  if (!title || !copy) return null;
  return { title, copy };
};

const uniqueShifts = (items: AdaptedMarketShift[]): AdaptedMarketShift[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.title}::${item.copy}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Map overview shifts from the best available insights source. */
export function mapMarketShifts(
  insights: MarketInsightsPayload,
  growth: AdaptedOpportunity[],
): AdaptedMarketShift[] {
  const labour = asObj(insights.labour_market_snapshot);
  const comparison = asObj(insights.city_vs_region_comparison);
  const comparisonRows = asArr(comparison?.data);

  const fromMarketShifts = uniqueShifts(
    asArr(insights.market_shifts).map(mapShiftRow).filter(Boolean) as AdaptedMarketShift[],
  );
  if (fromMarketShifts.length >= 3) return fromMarketShifts.slice(0, 3);

  const fromGrowth = uniqueShifts(
    growth.slice(0, 3).map((g) => ({ title: g.name, copy: g.summary })),
  );
  if (fromGrowth.length >= 3) return fromGrowth.slice(0, 3);

  const fromComparison = uniqueShifts(
    comparisonRows.map(mapShiftRow).filter(Boolean) as AdaptedMarketShift[],
  );
  if (fromComparison.length >= 3) return fromComparison.slice(0, 3);

  const drivers = asArr(labour?.major_drivers).map((d) => str(d)).filter(Boolean);
  if (drivers.length > 0) {
    const newsCopies = asArr(insights.market_news).map((item) => {
      if (typeof item === 'string') return str(item);
      const o = asObj(item);
      return str(o?.summary || o?.description || o?.title || o?.headline);
    });

    const fromDrivers = drivers.slice(0, 3).map((title, index) => {
      const comparisonRow = asObj(comparisonRows[index]);
      const copy =
        newsCopies[index] ||
        str(comparisonRow?.city) ||
        str(comparisonRow?.factor) ||
        'Details available in the full report.';
      return { title, copy };
    });

    const distinctCopies = new Set(fromDrivers.map((s) => s.copy));
    if (distinctCopies.size > 1) return fromDrivers;

    if (fromComparison.length > 0) {
      return drivers.slice(0, 3).map((title, index) => ({
        title,
        copy: fromComparison[index]?.copy || fromComparison[0]?.copy || 'Details available in the full report.',
      }));
    }

    return fromDrivers;
  }

  if (fromGrowth.length > 0) return fromGrowth;
  if (fromMarketShifts.length > 0) return fromMarketShifts;
  if (fromComparison.length > 0) return fromComparison.slice(0, 3);

  return [];
};

/**
 * Map API market insights sections into Market Report tab view-models.
 * Tolerates partial / evolving section shapes from the multipart generator.
 */
export function adaptMarketInsights(insights: MarketInsightsPayload | null | undefined): AdaptedMarketReport | null {
  if (!insights) return null;

  const verdict = asObj(insights.market_report_verdict);
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

  // Deterministic, retrieval-derived sources (see web-server lib/evidenceSources.ts)
  // win over the LLM's own self-reported report_sources/sources bag — they can't
  // cite a source that wasn't actually retrieved. Falls back to the legacy bag
  // only when evidence_sources is absent (cached entries from before it existed,
  // fixtures/demo mode).
  const evidenceSources = asArr(insights.evidence_sources)
    .map(mapEvidenceSource)
    .filter(Boolean) as AdaptedSource[];

  const headline =
    str(verdict?.headline) ||
    summaryBrief ||
    str(reportSummary?.overview) ||
    str(labour?.overview) ||
    GENERIC_OVERVIEW_HEADLINE;

  const summary =
    str(verdict?.summary) ||
    summaryBrief ||
    str(labour?.local_vs_national) ||
    headline;

  const shifts = mapMarketShifts(insights, growth);

  const signals =
    mapVerdictSignals(verdict?.signals) ??
    [
      { label: 'Role demand', value: str(marketHealth?.trend, 'Stable') },
      { label: 'Competition', value: str(keyStats?.pivot_necessity, 'High') },
      {
        label: 'Evidence quality',
        value: sourceBag.length >= 8 ? 'High' : sourceBag.length >= 3 ? 'Stable' : 'Low',
      },
    ];

  const tags = skills.slice(0, 4).map((s) => s.name);
  const evidenceTags = [
    news.slice(0, 3),
    growth.slice(0, 3).map((g) => g.name),
    skills.slice(0, 3).map((s) => s.name),
  ].map((row) => (row.length ? row : ['Live market signal']));

  return {
    verdictLabel: str(verdict?.verdict_label, 'Stable market'),
    outlookLabel: str(verdict?.outlook_label, 'Positive 12-month outlook'),
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
    sources: evidenceSources.length ? evidenceSources : sourceBag.map(mapSource),
    evidenceTags,
    newsTitles: news.slice(0, 8),
    fromLive: true,
  };
}
