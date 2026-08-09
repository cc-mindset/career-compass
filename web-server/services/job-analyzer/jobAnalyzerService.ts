import { randomUUID } from 'crypto';
import { openaiClient } from '../../lib/openai.js';
import { emitToJob } from '../../lib/websocket.js';
import { logger } from '../../utils/logger.js';
import type {
  ConfidenceLevel,
  EvidenceSpan,
  HiddenExpectation,
  JobAnalysisResult,
  JobAnalysisRunMetadata,
  JobIngestSource,
  StatedRequirement,
} from '../../types/jobAnalyzer.js';

export const JOB_ANALYZER_PROMPT_VERSION = 'job-analyzer-v1';

const CONFIDENCE: ConfidenceLevel[] = ['high', 'medium', 'low'];

const asObj = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asArr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const parseEvidence = (raw: unknown): EvidenceSpan[] =>
  asArr(raw)
    .map((item) => {
      if (typeof item === 'string' && item.trim()) {
        return { quote: item.trim() };
      }
      const o = asObj(item);
      if (!o) return null;
      const quote = str(o.quote || o.text || o.span);
      if (!quote) return null;
      const span: EvidenceSpan = { quote };
      if (typeof o.start === 'number') span.start = o.start;
      if (typeof o.end === 'number') span.end = o.end;
      return span;
    })
    .filter(Boolean) as EvidenceSpan[];

const parseConfidence = (raw: unknown): ConfidenceLevel => {
  const value = str(raw, 'medium').toLowerCase();
  return (CONFIDENCE.includes(value as ConfidenceLevel)
    ? value
    : 'medium') as ConfidenceLevel;
};

/**
 * Validate and normalize LLM JSON into the JobAnalysisResult contract.
 * Rejects payloads that invent a job without stated/hidden structure.
 */
export function validateJobAnalysisResult(
  raw: Record<string, unknown>,
): JobAnalysisResult {
  const statedRequirements: StatedRequirement[] = asArr(
    raw.statedRequirements || raw.stated_requirements,
  )
    .map((item) => {
      const o = asObj(item);
      if (!o) return null;
      const title = str(o.title || o.name);
      const summary = str(o.summary || o.description);
      if (!title || !summary) return null;
      const categoryRaw = str(o.category, 'required').toLowerCase();
      const category =
        categoryRaw === 'preferred' || categoryRaw === 'other'
          ? categoryRaw
          : 'required';
      return {
        category,
        title,
        summary,
        evidence: parseEvidence(o.evidence),
      } satisfies StatedRequirement;
    })
    .filter(Boolean) as StatedRequirement[];

  const hiddenExpectations: HiddenExpectation[] = asArr(
    raw.hiddenExpectations || raw.hidden_expectations,
  )
    .map((item) => {
      const o = asObj(item);
      if (!o) return null;
      const title = str(o.title || o.name);
      const summary = str(o.summary || o.description);
      const implication = str(o.implication || o.whatItMeans || o.meaning);
      const evidence = parseEvidence(o.evidence);
      if (!title || !summary || evidence.length === 0) return null;
      return {
        title,
        summary,
        implication:
          implication ||
          'Prepare concrete examples that address this inferred expectation.',
        confidence: parseConfidence(o.confidence),
        evidence,
      } satisfies HiddenExpectation;
    })
    .filter(Boolean) as HiddenExpectation[];

  if (statedRequirements.length === 0 && hiddenExpectations.length === 0) {
    throw new Error(
      'Analysis produced no stated requirements or Hidden Expectations',
    );
  }

  const questionsWorthAsking = asArr(
    raw.questionsWorthAsking || raw.questions_worth_asking,
  )
    .map((q) => str(q))
    .filter(Boolean);

  return {
    roleFocus: str(raw.roleFocus || raw.role_focus, 'Role focus'),
    roleFocusSummary: str(
      raw.roleFocusSummary || raw.role_focus_summary,
      str(raw.summary, 'Analysis of the supplied posting.'),
    ),
    statedRequirements,
    hiddenExpectations,
    questionsWorthAsking,
  };
}

export function assertUsablePosting(postingText: unknown): string {
  if (typeof postingText !== 'string') {
    throw new Error('Job description text is required');
  }
  const trimmed = postingText.trim();
  if (trimmed.length < 40) {
    throw new Error(
      'Job description is too short. Paste the complete posting — Clarity Coach will not invent a job.',
    );
  }
  if (trimmed.length > 80_000) {
    throw new Error('Job description exceeds the maximum length');
  }
  return trimmed;
}

export type AnalyzeJobInput = {
  postingText: string;
  title?: string;
  company?: string;
  location?: string;
  source: JobIngestSource;
  sourceUrl?: string;
  jobId?: string;
};

export type AnalyzeJobOutput = {
  result: JobAnalysisResult;
  metadata: JobAnalysisRunMetadata;
  analysisId: string;
};

const SYSTEM_PROMPT = `You are Clarity Coach Job Analyzer. Analyze ONLY the user-supplied job posting.
Never invent a different job, role, or employer.
Separate explicitly stated requirements from inferred Hidden Expectations.
Every Hidden Expectation MUST include evidence quotes drawn from the posting and a confidence of high|medium|low.
Return ONLY valid JSON matching the requested schema.`;

function buildUserPrompt(input: AnalyzeJobInput, posting: string): string {
  const contextParts = [
    input.title ? `Title hint: ${input.title}` : null,
    input.company ? `Company hint: ${input.company}` : null,
    input.location ? `Location hint: ${input.location}` : null,
  ].filter(Boolean);

  return `Analyze this job posting. Do not invent a job.

${contextParts.length ? `${contextParts.join('\n')}\n` : ''}
Return JSON with this structure:
{
  "roleFocus": "short headline",
  "roleFocusSummary": "1-3 sentences",
  "statedRequirements": [
    {
      "category": "required" | "preferred" | "other",
      "title": "string",
      "summary": "string",
      "evidence": [{ "quote": "exact or near-exact phrase from posting" }]
    }
  ],
  "hiddenExpectations": [
    {
      "title": "string",
      "summary": "string",
      "implication": "what it means for a candidate",
      "confidence": "high" | "medium" | "low",
      "evidence": [{ "quote": "phrase from posting" }]
    }
  ],
  "questionsWorthAsking": ["string"]
}

Include 2-6 stated requirements and 1-5 hidden expectations when the posting supports them.
Hidden expectations without evidence are invalid.

POSTING:
---
${posting}
---`;
}

/**
 * Run LLM job analysis with structured validation and optional Socket.IO progress.
 */
export async function analyzeJobPosting(
  input: AnalyzeJobInput,
): Promise<AnalyzeJobOutput> {
  const posting = assertUsablePosting(input.postingText);
  const jobId = input.jobId;

  if (jobId) {
    emitToJob(jobId, 'progress', {
      type: 'job_start',
      stage: 'Preparing job analysis',
      jobId,
    });
  }

  if (jobId) {
    emitToJob(jobId, 'progress', {
      type: 'section_in_progress',
      section: 'analysis',
      stage: 'Reading posting and inferring expectations',
      jobId,
    });
  }

  logger.info(
    `⌕ Job Analyzer starting (${input.source}, ${posting.length} chars)`,
  );

  const raw = await openaiClient.generateJSONCompletion(
    SYSTEM_PROMPT,
    buildUserPrompt(input, posting),
    { temperature: 0.3, max_tokens: 4000 },
  );

  const result = validateJobAnalysisResult(raw);
  const analysisId = randomUUID();
  const metadata: JobAnalysisRunMetadata = {
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    promptVersion: JOB_ANALYZER_PROMPT_VERSION,
    analyzedAt: new Date().toISOString(),
    source: input.source,
  };

  if (jobId) {
    emitToJob(jobId, 'progress', {
      type: 'job_complete',
      stage: 'Analysis ready',
      jobId,
      analysisId,
      result,
      metadata,
    });
  }

  logger.info(
    `✓ Job Analyzer complete ${analysisId} (stated=${result.statedRequirements.length}, hidden=${result.hiddenExpectations.length})`,
  );

  return { result, metadata, analysisId };
}
