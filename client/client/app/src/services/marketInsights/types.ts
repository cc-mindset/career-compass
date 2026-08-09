/** Raw merged insights object returned by web-server market-insights generate. */
export type MarketInsightsPayload = Record<string, unknown>;

export interface MarketInsightsGenerateResponse {
  success: boolean;
  queued?: boolean;
  jobId?: string;
  position?: number;
  message?: string;
  insights?: MarketInsightsPayload;
  generated_at?: string;
  fromCache?: boolean;
  error?: string;
}

export type MarketProgressEventType =
  | 'job_start'
  | 'section_in_progress'
  | 'section_success'
  | 'section_error'
  | 'job_complete'
  | 'job_error'
  | 'job_fallback';

export interface MarketProgressEvent {
  type: MarketProgressEventType;
  jobId?: string;
  section?: string;
  data?: MarketInsightsPayload;
  insights?: MarketInsightsPayload;
  error?: string;
  stage?: string;
  completedSections?: string[];
  failedSections?: string[];
  reason?: string;
}

export interface GenerateMarketInsightsParams {
  location: string;
  userId?: string;
  job?: string;
  seniority?: string;
  industry?: string;
}

export interface AdaptedMarketShift {
  title: string;
  copy: string;
}

export interface AdaptedMarketSignal {
  label: string;
  value: string;
}

export interface AdaptedOpportunity {
  name: string;
  summary: string;
  signal: string;
}

export interface AdaptedSkill {
  name: string;
  demand: string;
  action: string;
  width: string;
}

export interface AdaptedSource {
  name: string;
  role: string;
  date: string;
}

/** View-model consumed by Clarity Coach Market Report tabs. */
export interface AdaptedMarketReport {
  verdictLabel: string;
  outlookLabel: string;
  headline: string;
  summary: string;
  signals: AdaptedMarketSignal[];
  shifts: AdaptedMarketShift[];
  recommendation: { title: string; copy: string };
  path: { title: string; copy: string; tags: string[] };
  opportunities: AdaptedOpportunity[];
  emerging: AdaptedOpportunity[];
  risks: AdaptedOpportunity[];
  skills: AdaptedSkill[];
  sources: AdaptedSource[];
  evidenceTags: string[][];
  newsTitles: string[];
  fromLive: boolean;
}
