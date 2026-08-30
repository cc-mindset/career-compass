import { RagNamespace } from "../types/rag.js";
import type { EvidenceLens } from "../types/evidence.js";
import { logger } from "../utils/logger.js";

/**
 * Human-readable display names for the closed set of source codes emitted by
 * the market_stats ingestion pipeline. Traced against the actual fetchers:
 *   ai-enabler/rag-pipeline/src/pipelines/market_stats/fetcher_bls.py       (_resolve_source)
 *   ai-enabler/rag-pipeline/src/pipelines/market_stats/fetcher_statscan.py (_resolve_source)
 *   ai-enabler/rag-pipeline/src/pipelines/market_stats/fetcher_imf.py
 *   ai-enabler/rag-pipeline/src/pipelines/market_stats/runner.py           (OECD_SKILLS)
 *
 * This is deliberately a static, hand-reviewed map — not LLM-generated —
 * so a display label can never be hallucinated. If ai-enabler mints a new
 * code and this map isn't updated, getMarketStatsSourceLabel() falls back
 * gracefully and logs a warning instead of leaking a raw code to the UI.
 */
export const MARKET_STATS_SOURCE_LABELS: Record<string, string> = {
  BLS_JOLTS:
    "U.S. Bureau of Labor Statistics — Job Openings and Labor Turnover Survey (JOLTS)",
  BLS_CES: "U.S. Bureau of Labor Statistics — Current Employment Statistics (CES)",
  BLS_CPS: "U.S. Bureau of Labor Statistics — Current Population Survey (CPS)",
  STATSCAN_LFS: "Statistics Canada — Labour Force Survey (LFS)",
  STATSCAN_JVWS: "Statistics Canada — Job Vacancy and Wage Survey (JVWS)",
  STATSCAN_SEPH: "Statistics Canada — Survey of Employment, Payrolls and Hours (SEPH)",
  STATSCAN_UNKNOWN: "Statistics Canada",
  IMF_WEO: "International Monetary Fund — World Economic Outlook",
  IMF: "International Monetary Fund",
  OECD_SKILLS: "OECD — Skills Outlook",
};

/** Evidence-tab grouping per Pinecone namespace (PRD: "grouped lenses"). */
export const NAMESPACE_LENS_LABELS: Record<string, EvidenceLens> = {
  [RagNamespace.LABOR_MARKET_STATS]: "Labor market statistics",
  [RagNamespace.MARKET_NEWS]: "Market news",
  [RagNamespace.MARKET_REPORTS]: "Industry & research reports",
  [RagNamespace.GEO_LABOR_SIGNALS]: "Regional labor signals",
  [RagNamespace.FORWARD_LOOKING]: "Forward-looking projections",
};

export function getNamespaceLens(namespace: string): EvidenceLens {
  return NAMESPACE_LENS_LABELS[namespace] || "Other sources";
}

/**
 * Resolve a market-stats-family source code to a human label.
 * Never returns the raw code — falls back to a generic, still-readable name
 * and logs so a newly-minted ingestion code gets noticed instead of shipping
 * silently as e.g. "STATSCAN_UNKNOWN" straight to a user.
 */
export function getMarketStatsSourceLabel(code: string): string {
  const trimmed = (code || "").trim();
  if (!trimmed) return "Government labor statistics";

  const known = MARKET_STATS_SOURCE_LABELS[trimmed];
  if (known) return known;

  logger.warn(
    `⚠️  Unmapped market-stats source code: "${trimmed}" — add it to constants/sourceLabels.ts`,
  );
  return "Government labor statistics";
}

function extractYear(value?: string): string {
  if (!value) return "";
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

/**
 * Build a display label for a market-reports/market-news document from its
 * own metadata (publisher/source, title, date). These are per-document, not
 * a fixed enum, so format rather than look up.
 */
export function formatDocumentSourceLabel(
  publisherOrSource: string,
  title?: string,
  publishedAt?: string,
): string {
  const publisher = (publisherOrSource || "").trim();
  const cleanTitle = (title || "").trim();
  const year = extractYear(publishedAt);

  if (publisher && cleanTitle) {
    return year ? `${publisher} — ${cleanTitle} (${year})` : `${publisher} — ${cleanTitle}`;
  }
  if (cleanTitle) return year ? `${cleanTitle} (${year})` : cleanTitle;
  if (publisher) return publisher;
  return "Unnamed source";
}
