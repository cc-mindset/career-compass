import { getApiBaseUrl, isApiConfigured } from '../../lib/apiBase';
import { getSocket, waitForSocketConnection } from '../../lib/socket';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface EvidenceSpan {
  quote: string;
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

export interface JobAnalysisMetadata {
  model: string;
  promptVersion: string;
  analyzedAt: string;
  source: 'paste' | 'url' | 'upload';
}

export interface JobAnalysisRecord {
  analysisId: string;
  userId: string;
  title: string;
  company: string;
  location: string;
  result: JobAnalysisResult;
  metadata: JobAnalysisMetadata;
  createdAt: string;
  postingText?: string;
}

export interface JobAnalysisSummary {
  analysisId: string;
  title: string;
  company: string;
  location: string;
  createdAt: string;
  hiddenExpectationCount: number;
}

export type AnalyzeJobParams = {
  postingText: string;
  title?: string;
  company?: string;
  location?: string;
  workArrangement?: string;
  userId?: string;
  save?: boolean;
  source?: 'paste' | 'url' | 'upload';
  sourceUrl?: string;
};

export type AnalyzeJobResponse = {
  success: boolean;
  queued?: boolean;
  jobId?: string;
  analysisId?: string;
  result?: JobAnalysisResult;
  metadata?: JobAnalysisMetadata;
  saved?: boolean;
  guestPreview?: boolean;
  record?: JobAnalysisRecord;
  error?: string;
  message?: string;
  pasteFallback?: boolean;
};

export class JobAnalyzerApiError extends Error {
  pasteFallback?: boolean;
  constructor(message: string, pasteFallback?: boolean) {
    super(message);
    this.name = 'JobAnalyzerApiError';
    this.pasteFallback = pasteFallback;
  }
}

const waitForQueuedAnalysis = (jobId: string): Promise<AnalyzeJobResponse> =>
  new Promise((resolve, reject) => {
    const socket = getSocket();
    if (!socket) {
      reject(new JobAnalyzerApiError('Socket unavailable'));
      return;
    }

    let settled = false;
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new JobAnalyzerApiError('Job analysis timed out'));
    }, 120_000);

    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      socket.off('progress', onProgress);
      socket.emit('unsubscribe', jobId);
    };

    const onProgress = (raw: Record<string, unknown>) => {
      if (raw.jobId && raw.jobId !== jobId) return;
      if (raw.type === 'job_complete') {
        cleanup();
        resolve({
          success: true,
          analysisId: raw.analysisId as string | undefined,
          result: raw.result as JobAnalysisResult | undefined,
          metadata: raw.metadata as JobAnalysisMetadata | undefined,
          saved: Boolean(raw.saved),
          guestPreview: Boolean(raw.guestPreview),
          record: raw.record as JobAnalysisRecord | undefined,
        });
        return;
      }
      if (raw.type === 'job_error') {
        cleanup();
        reject(new JobAnalyzerApiError(String(raw.error || 'Analysis failed')));
      }
    };

    socket.on('progress', onProgress);
    socket.emit('subscribe', jobId);
  });

export async function analyzeJobPosting(
  params: AnalyzeJobParams,
): Promise<AnalyzeJobResponse> {
  if (!isApiConfigured()) {
    throw new JobAnalyzerApiError('VITE_API_URL is not configured');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/job-analyzer/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postingText: params.postingText,
      title: params.title,
      company: params.company,
      location: params.location,
      workArrangement: params.workArrangement,
      userId: params.userId || 'guest',
      save: Boolean(params.save),
      source: params.source || 'paste',
      sourceUrl: params.sourceUrl,
    }),
  });

  const body = (await response.json()) as AnalyzeJobResponse;
  if (!response.ok || !body.success) {
    throw new JobAnalyzerApiError(body.error || body.message || 'Analyze failed');
  }

  if (body.queued && body.jobId) {
    const connected = await waitForSocketConnection();
    if (!connected) {
      throw new JobAnalyzerApiError('Could not connect for analysis progress');
    }
    return waitForQueuedAnalysis(body.jobId);
  }

  return body;
}

export async function analyzeJobFromUrl(
  params: AnalyzeJobParams & { url: string },
): Promise<AnalyzeJobResponse> {
  if (!isApiConfigured()) {
    throw new JobAnalyzerApiError('VITE_API_URL is not configured');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/job-analyzer/analyze/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: params.url,
      title: params.title,
      company: params.company,
      location: params.location,
      userId: params.userId || 'guest',
      save: Boolean(params.save),
    }),
  });

  const body = (await response.json()) as AnalyzeJobResponse;
  if (!response.ok || !body.success) {
    throw new JobAnalyzerApiError(
      body.error || body.message || 'URL analyze failed',
      body.pasteFallback,
    );
  }
  return body;
}

export async function analyzeJobUpload(params: {
  file: File;
  title?: string;
  company?: string;
  location?: string;
  userId?: string;
  save?: boolean;
}): Promise<AnalyzeJobResponse> {
  if (!isApiConfigured()) {
    throw new JobAnalyzerApiError('VITE_API_URL is not configured');
  }

  const form = new FormData();
  form.append('posting', params.file);
  if (params.title) form.append('title', params.title);
  if (params.company) form.append('company', params.company);
  if (params.location) form.append('location', params.location);
  form.append('userId', params.userId || 'guest');
  form.append('save', params.save ? 'true' : 'false');

  const response = await fetch(`${getApiBaseUrl()}/api/job-analyzer/analyze/upload`, {
    method: 'POST',
    body: form,
  });

  const body = (await response.json()) as AnalyzeJobResponse;
  if (!response.ok || !body.success) {
    throw new JobAnalyzerApiError(body.error || body.message || 'Upload analyze failed');
  }
  return body;
}

export async function listJobAnalyses(userId: string): Promise<JobAnalysisSummary[]> {
  if (!isApiConfigured()) return [];
  const response = await fetch(
    `${getApiBaseUrl()}/api/job-analyzer/${encodeURIComponent(userId)}`,
  );
  const body = (await response.json()) as {
    success?: boolean;
    analyses?: JobAnalysisSummary[];
    error?: string;
  };
  if (!response.ok || !body.success) {
    throw new JobAnalyzerApiError(body.error || 'Failed to list analyses');
  }
  return body.analyses || [];
}

export async function fetchJobAnalysis(
  userId: string,
  analysisId: string,
): Promise<JobAnalysisRecord> {
  if (!isApiConfigured()) {
    throw new JobAnalyzerApiError('VITE_API_URL is not configured');
  }
  const response = await fetch(
    `${getApiBaseUrl()}/api/job-analyzer/${encodeURIComponent(userId)}/${encodeURIComponent(analysisId)}`,
  );
  const body = (await response.json()) as {
    success?: boolean;
    record?: JobAnalysisRecord;
    error?: string;
  };
  if (!response.ok || !body.success || !body.record) {
    throw new JobAnalyzerApiError(body.error || 'Failed to fetch analysis');
  }
  return body.record;
}

export async function saveJobAnalysis(params: {
  userId: string;
  analysisId: string;
  title: string;
  company: string;
  location: string;
  postingText: string;
  result: JobAnalysisResult;
  metadata: JobAnalysisMetadata;
  source?: 'paste' | 'url' | 'upload';
}): Promise<JobAnalysisRecord> {
  if (!isApiConfigured()) {
    throw new JobAnalyzerApiError('VITE_API_URL is not configured');
  }
  const response = await fetch(`${getApiBaseUrl()}/api/job-analyzer/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = (await response.json()) as {
    success?: boolean;
    record?: JobAnalysisRecord;
    error?: string;
  };
  if (!response.ok || !body.success || !body.record) {
    throw new JobAnalyzerApiError(body.error || 'Failed to save analysis');
  }
  return body.record;
}
