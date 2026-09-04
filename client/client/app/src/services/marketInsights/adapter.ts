import type {
  AdaptedFocusWeek,
  AdaptedHiringTrend,
  AdaptedHiringTrendPoint,
  AdaptedMarketInsight,
  AdaptedMarketReport,
  AdaptedMarketShift,
  AdaptedOpportunity,
  AdaptedSkill,
  AdaptedSource,
  MarketInsightsPayload,
} from './types';
import { GENERIC_OVERVIEW_HEADLINE } from './constants';

/** Fixed order of the Evidence tab's 3 groups — must match EVIDENCE_GROUPS in
 * views/market-workspace/data.ts and evidence_lens_coverage's keys in the
 * Part 3 prompt (marketInsightsService_multipart.ts). */
const EVIDENCE_LENS_GROUPS = [
  'Technology & regulation',
  'Economy & industry',
  'People & place',
] as const;

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

/**
 * Flattens growth_sectors[].example_roles into role-level opportunity rows,
 * each carrying its parent sector's why_it_matters/growth_outlook as context.
 * This is what "Best matches" / "Emerging roles" should be built from — specific
 * job titles, not sector names — so they're genuinely distinct from the
 * "Hiring sectors" view (which reads growth_sectors directly, see sectors: growth
 * below). Same source field, different sub-field, no new LLM cost.
 */
const flattenExampleRoles = (rawGrowthSectors: unknown[]): AdaptedOpportunity[] => {
  const seen = new Set<string>();
  const rows: AdaptedOpportunity[] = [];
  for (const raw of rawGrowthSectors) {
    const o = asObj(raw);
    if (!o) continue;
    const sectorSummary = str(o.why_it_matters, 'Growth outlook available in full report.');
    const signal = str(o.growth_outlook, 'Growing');
    for (const roleRaw of asArr(o.example_roles)) {
      const name = str(roleRaw);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      rows.push({ name, summary: sectorSummary, signal });
    }
  }
  return rows;
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

/** Maps a growth_locations entry (NEW) into the same shape as growth/risk rows. */
const mapGrowthLocation = (raw: unknown): AdaptedOpportunity | null => {
  const o = asObj(raw);
  if (!o) return null;
  const name = str(o.name);
  if (!name) return null;
  return {
    name,
    summary: str(o.summary || o.marketDetail, 'Location detail available in full report.'),
    signal: str(o.signal, 'Growing market'),
  };
};

/** Maps a priority_capabilities entry (NEW) into the same shape as skill rows. */
const mapCapability = (raw: unknown): AdaptedSkill | null => {
  const o = asObj(raw);
  if (!o) return null;
  const name = str(o.name);
  if (!name) return null;
  const demand = str(o.demand_level, 'In demand');
  return {
    name,
    demand,
    action: str(o.evidence_building_action, 'Add one measurable example to your Career Profile.'),
    width: demandWidth(demand),
  };
};

/** Maps a thirty_day_focus entry (NEW). */
const mapFocusWeek = (raw: unknown): AdaptedFocusWeek | null => {
  const o = asObj(raw);
  if (!o) return null;
  const label = str(o.label);
  const action = str(o.action);
  if (!label || !action) return null;
  return { label, action };
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

const UNAVAILABLE_HIRING_TREND: AdaptedHiringTrend = {
  available: false,
  windowLabel: '',
  localLabel: '',
  nationalLabel: '',
  points: [],
};

/** Maps hiring_trend_series (see web-server hiringTrendService.ts) — real
 * unemployment-rate data or an honest `available: false`, never LLM output. */
const mapHiringTrend = (raw: unknown): AdaptedHiringTrend => {
  const o = asObj(raw);
  if (!o || o.available !== true) return UNAVAILABLE_HIRING_TREND;

  const points = asArr(o.points)
    .map((rawPoint): AdaptedHiringTrendPoint | null => {
      const p = asObj(rawPoint);
      if (!p) return null;
      const period = str(p.period);
      const localValue = p.local_index;
      const nationalValue = p.national_index;
      if (!period || typeof localValue !== 'number' || typeof nationalValue !== 'number') return null;
      return { period, localValue, nationalValue };
    })
    .filter(Boolean) as AdaptedHiringTrendPoint[];

  if (points.length < 2) return UNAVAILABLE_HIRING_TREND;

  return {
    available: true,
    windowLabel: str(o.window_label),
    localLabel: str(o.local_label),
    nationalLabel: str(o.national_label),
    points,
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

const firstSentence = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : trimmed.slice(0, 160).trim();
};

/**
 * Derives the "See all insights" (10-item) list from content already
 * generated in Parts 1-2 — NOT a new LLM call (see
 * docs/product/MarketReportPrompts.docx §6). Replaces the previous
 * MarketInsightList derivation, which capped at 3 items (market_shifts
 * only) and repeated the same meaning/action text across every item.
 */
function deriveMarketInsights(
  insights: MarketInsightsPayload,
  shifts: AdaptedMarketShift[],
  growth: AdaptedOpportunity[],
  risks: AdaptedOpportunity[],
  capabilities: AdaptedSkill[],
  sources: AdaptedSource[],
): AdaptedMarketInsight[] {
  const sourceFor = (index: number) => sources[index]?.name || 'Live market analysis';
  const rawGrowth = asArr(insights.growth_sectors).map(asObj) as (Record<string, unknown> | null)[];
  const rawRisk = asArr(insights.at_risk_sectors).map(asObj) as (Record<string, unknown> | null)[];

  const fromShifts: AdaptedMarketInsight[] = shifts.slice(0, 3).map((shift, index) => ({
    title: shift.title,
    summary: shift.copy,
    category: 'Market shift',
    meaning: shift.copy,
    action: `Reflect this shift in your Career Profile: ${shift.title}.`,
    source: sourceFor(index),
  }));

  const fromGrowth: AdaptedMarketInsight[] = growth.slice(0, 3).map((g, index) => ({
    title: g.name,
    summary: firstSentence(g.summary),
    category: 'Opportunity',
    meaning: str(rawGrowth[index]?.why_it_matters, g.summary),
    action: `Explore roles in ${g.name}.`,
    source: sourceFor(fromShifts.length + index),
  }));

  const fromRisks: AdaptedMarketInsight[] = risks.slice(0, 2).map((r, index) => ({
    title: r.name,
    summary: firstSentence(r.summary),
    category: 'Risk',
    meaning: str(rawRisk[index]?.risk_reality_check, r.summary),
    action: str(rawRisk[index]?.pivot_direction, 'Review this risk in the full report.'),
    source: sourceFor(fromShifts.length + fromGrowth.length + index),
  }));

  const fromCapabilities: AdaptedMarketInsight[] = capabilities.slice(0, 2).map((c, index) => ({
    title: c.name,
    summary: `${c.demand} demand — evidence opportunity.`,
    category: 'Skills',
    meaning: `${c.demand} for this capability among roles like yours.`,
    action: c.action,
    source: sourceFor(fromShifts.length + fromGrowth.length + fromRisks.length + index),
  }));

  return [...fromShifts, ...fromGrowth, ...fromRisks, ...fromCapabilities];
}

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

  // Sector-level (name = sector, e.g. "AI & Advanced Tech (SF, Palo Alto, South Bay)").
  // Used for "Hiring sectors" (sectors: growth, below) and as broader context
  // elsewhere (shift fallback copy, evidence tag fallback) — NOT for "Best
  // matches" / "Emerging roles", which need specific job titles instead.
  const growth = asArr(insights.growth_sectors).map(mapGrowthSector).filter(Boolean) as AdaptedOpportunity[];
  const risks = [
    ...asArr(insights.at_risk_sectors).map(mapRiskSector),
    ...asArr(insights.market_risks).map(mapRiskSector),
  ].filter(Boolean) as AdaptedOpportunity[];

  // Role-level (name = specific job title, e.g. "AI Product Lead") — flattened
  // from growth_sectors[].example_roles (see flattenExampleRoles). This is what
  // "Best matches" / "Emerging roles" are built from, so they're genuinely
  // distinct from "Hiring sectors" instead of both reading the same sector list.
  // Falls back to sector-level growth if example_roles is absent (older cache).
  const roles = flattenExampleRoles(asArr(insights.growth_sectors));
  const rolePool = roles.length ? roles : growth;

  const opportunities = rolePool.slice(0, 6);

  // "Emerging roles to watch" used to just be growth.slice(0, 3) — literally the
  // first 3 of "Best matches" shown again. Prefer roles whose parent sector is
  // flagged growth_outlook === "Growing" (distinct signal from "Expanding"),
  // then fill remaining slots from the rest of the pool so this never comes
  // back empty.
  const growingRoles = rolePool.filter((r) => r.signal.toLowerCase() === 'growing');
  const growingNames = new Set(growingRoles.map((r) => r.name));
  const emerging = [...growingRoles, ...rolePool.filter((r) => !growingNames.has(r.name))].slice(0, 3);

  // Opportunities tab "Locations" view — NEW field. Previously this view (and
  // "Hiring sectors") both fell through to risk data in a client routing bug;
  // that bug is fixed in index.tsx's OpportunityRows, which now reads these.
  const locations = asArr(insights.growth_locations).map(mapGrowthLocation).filter(Boolean) as AdaptedOpportunity[];

  const skillCategories = asObj(insights.top_skills_demand);
  const nestedSkills = asArr(skillCategories?.categories).flatMap((cat) => {
    const c = asObj(cat);
    return asArr(c?.skills);
  });
  const flatSkills = asArr(insights.skills);
  const skills = [...nestedSkills, ...flatSkills].map(mapSkill).filter(Boolean) as AdaptedSkill[];

  // Skills & actions tab "3 capabilities" — NEW field, replaces SkillsTab
  // previously reading raw top_skills_demand directly (up to 8 entries).
  const capabilities = asArr(insights.priority_capabilities).map(mapCapability).filter(Boolean) as AdaptedSkill[];

  // Skills & actions tab "30-day focus" — NEW field, previously 100% hardcoded.
  const focusWeeks = asArr(insights.thirty_day_focus).map(mapFocusWeek).filter(Boolean) as AdaptedFocusWeek[];

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

  // Evidence tab's 3 thematic groups. Prefer the deterministic, fixed-taxonomy
  // evidence_lens_coverage (see types/careerIntel.ts) — real topic tagging
  // against 9 fixed tags. Falls back to the old mechanism (news headlines /
  // sector names / skill names shoved into the 3 slots positionally,
  // mislabeled under whichever heading they land on) only for cache entries
  // written before evidence_lens_coverage existed.
  const lensCoverage = asObj(insights.evidence_lens_coverage);
  const evidenceTags = (
    lensCoverage
      ? EVIDENCE_LENS_GROUPS.map((key) => asArr(lensCoverage[key]).map((t) => str(t)).filter(Boolean))
      : [
          news.slice(0, 3),
          growth.slice(0, 3).map((g) => g.name),
          skills.slice(0, 3).map((s) => s.name),
        ]
  ).map((row) => (row.length ? row : ['Live market signal']));

  const resolvedSources = evidenceSources.length ? evidenceSources : sourceBag.map(mapSource);

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
    opportunities,
    emerging,
    sectors: growth, // sector-level list — genuinely distinct from opportunities/emerging above

    locations,
    risks: risks.slice(0, 6),
    skills: skills.slice(0, 8),
    capabilities,
    focusWeeks,
    sources: resolvedSources,
    evidenceTags,
    insights: deriveMarketInsights(insights, shifts, growth, risks, capabilities, resolvedSources),
    hiringTrend: mapHiringTrend(insights.hiring_trend_series),
    fromLive: true,
  };
}
