import { RagRetrievalResponse, PineconeMatch, RagNamespace } from "../types/rag.js";
import type { EvidenceSource } from "../types/evidence.js";
import {
  getNamespaceLens,
  getMarketStatsSourceLabel,
  formatDocumentSourceLabel,
} from "../constants/sourceLabels.js";

/** Namespaces whose sources are a closed set of codes, not per-document metadata. */
const STATS_NAMESPACES: ReadonlySet<string> = new Set([
  RagNamespace.LABOR_MARKET_STATS,
  RagNamespace.GEO_LABOR_SIGNALS,
  RagNamespace.FORWARD_LOOKING,
]);

type MatchLabel = {
  label: string;
  sourceCode: string;
  title?: string;
  publishedAt?: string;
};

function labelForMatch(namespace: string, match: PineconeMatch): MatchLabel {
  const meta = match.metadata || {};
  const sourceCode = String(meta["source"] || meta["publisher"] || "").trim();
  const title = meta["title"] ? String(meta["title"]).trim() : undefined;
  const rawDate = meta["published_at"] || meta["date"];
  const publishedAt = rawDate ? String(rawDate).trim() : undefined;

  if (STATS_NAMESPACES.has(namespace)) {
    return {
      label: getMarketStatsSourceLabel(sourceCode),
      sourceCode: sourceCode || "UNKNOWN",
      title,
      publishedAt,
    };
  }

  return {
    label: formatDocumentSourceLabel(sourceCode, title, publishedAt),
    sourceCode: sourceCode || "UNKNOWN",
    title,
    publishedAt,
  };
}

/**
 * Derive the deduped, human-labeled list of sources actually retrieved for a
 * generation — independent of whatever the LLM later claims it used in
 * report_sources/sources. This is the ground truth for the Evidence tab.
 *
 * Dedup key is namespace + sourceCode + title: this collapses many chunks of
 * the same stats series or the same report PDF into one row, while keeping
 * distinct news articles/report documents (different titles) as separate
 * rows even when they share a publisher.
 */
export function extractEvidenceSources(response: RagRetrievalResponse): EvidenceSource[] {
  const seen = new Set<string>();
  const sources: EvidenceSource[] = [];

  for (const [namespace, matches] of Object.entries(response.results || {})) {
    for (const match of (matches || []) as PineconeMatch[]) {
      const { label, sourceCode, title, publishedAt } = labelForMatch(namespace, match);
      const id = `${namespace}::${sourceCode}::${title || ""}`;
      if (seen.has(id)) continue;
      seen.add(id);

      sources.push({
        id,
        namespace,
        lens: getNamespaceLens(namespace),
        label,
        sourceCode,
        ...(title ? { title } : {}),
        ...(publishedAt ? { publishedAt } : {}),
      });
    }
  }

  return sources;
}
