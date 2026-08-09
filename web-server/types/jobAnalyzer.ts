/** Job Analyzer contracts: stated requirements vs inferred Hidden Expectations. */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type JobIngestSource = 'paste' | 'url' | 'upload';

export interface EvidenceSpan {
  /** Short quote or paraphrase from the posting that supports the claim. */
  quote: string;
  /** Optional character offsets into the posting text when available. */
  start?: number;
  end?: number;
}

export interface StatedRequirement {
  category: 'required' | 'preferred' | 'other';
  title: string;
  summary: string;
  evidence: EvidenceSpan[];
}

export interface HiddenExpectation {
  title: string;
  summary: string;
  /** What this likely means for the candidate. */
  implication: string;
  confidence: ConfidenceLevel;
  evidence: EvidenceSpan[];
}

export interface JobAnalysisResult {
  roleFocus: string;
  roleFocusSummary: string;
  statedRequirements: StatedRequirement[];
  hiddenExpectations: HiddenExpectation[];
  questionsWorthAsking: string[];
}

export interface JobAnalysisRunMetadata {
  model: string;
  promptVersion: string;
  analyzedAt: string;
  source: JobIngestSource;
}

export interface JobAnalysisRecord {
  analysisId: string;
  userId: string;
  title: string;
  company: string;
  location: string;
  workArrangement?: string;
  postingText: string;
  source: JobIngestSource;
  sourceUrl?: string;
  result: JobAnalysisResult;
  metadata: JobAnalysisRunMetadata;
  createdAt: string;
}

export interface JobAnalysisSummary {
  analysisId: string;
  title: string;
  company: string;
  location: string;
  createdAt: string;
  hiddenExpectationCount: number;
}
