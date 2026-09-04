import { RagNamespace } from "./rag";

/**
 * Deterministic, retrieval-derived source provenance for Market Report.
 *
 * This is independent of whatever the LLM claims it used (see
 * MarketReportData.report_sources) — it is built directly from Pinecone
 * chunk metadata, so it can never cite a source that was not actually
 * retrieved for this generation. See lib/evidenceSources.ts.
 */

/** Human-facing grouping shown on the Evidence tab (PRD: "grouped lenses"). */
export type EvidenceLens =
  | "Labor market statistics"
  | "Market news"
  | "Industry & research reports"
  | "Regional labor signals"
  | "Forward-looking projections"
  | "Other sources";

export interface EvidenceSource {
  /** Stable dedup id: `${namespace}::${sourceCode}::${title || ''}`. */
  id: string;
  namespace: RagNamespace | string;
  lens: EvidenceLens;
  /** Human-readable display name — never the raw ingestion code. */
  label: string;
  /** Raw metadata.source/publisher value, kept for debugging/traceability. */
  sourceCode: string;
  title?: string;
  publishedAt?: string;
}
