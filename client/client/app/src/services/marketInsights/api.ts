import { getApiBaseUrl, isApiConfigured } from '../../lib/apiBase';
import { getSocket, waitForSocketConnection } from '../../lib/socket';
import {
  isMarketOverviewReady,
  mergeMarketSection,
  mergeStatusInsights,
} from './mergeMarketInsights';
import type {
  GenerateMarketInsightsParams,
  MarketInsightsGenerateResponse,
  MarketInsightsPayload,
  MarketProgressEvent,
} from './types';

const SECTION_PROGRESS: Record<string, number> = {
  marketReportVerdict: 22,
  marketReport: 45,
  industryTrends: 72,
  newsAndCareerIntel: 90,
};

const POLL_INTERVAL_MS = 500;
const JOB_TIMEOUT_MS = 120_000;

export type MarketGenerateProgress = {
  percent: number;
  message?: string;
};

export type MarketGenerateCallbacks = {
  onProgress?: (update: MarketGenerateProgress) => void;
  onInsightsUpdate?: (
    insights: MarketInsightsPayload,
    meta: { completedSections: string[] },
  ) => void;
  /** Fires once when market_report_verdict is enough to open the overview page. */
  onOverviewReady?: (insights: MarketInsightsPayload) => void;
};

export class MarketInsightsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketInsightsApiError';
  }
}

const asRecord = (value: unknown): MarketInsightsPayload | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as MarketInsightsPayload;
  }
  return null;
};

type JobStatusResponse = {
  success?: boolean;
  status?: 'processing' | 'completed';
  insights?: MarketInsightsPayload;
  completedSections?: string[];
  message?: string;
};

const applyInsightsUpdate = (
  accumulated: MarketInsightsPayload,
  options: MarketGenerateCallbacks,
  overviewFired: { value: boolean },
  section?: string,
  sectionData?: unknown,
): MarketInsightsPayload => {
  let next = accumulated;
  if (section && sectionData) {
    next = mergeMarketSection(accumulated, section, sectionData);
  } else if (sectionData) {
    const record = asRecord(sectionData);
    if (record) next = mergeStatusInsights(accumulated, record);
  }

  const sections = inferCompletedSections(next);

  options.onInsightsUpdate?.(next, { completedSections: sections });

  if (!overviewFired.value && isMarketOverviewReady(next)) {
    overviewFired.value = true;
    options.onOverviewReady?.(next);
  }

  return next;
};

const inferCompletedSections = (insights: MarketInsightsPayload): string[] => {
  const sections: string[] = [];
  if (insights.market_report_verdict) {
    sections.push('marketReportVerdict');
  }
  if (insights.market_report_summary || insights.labour_market_snapshot) {
    sections.push('marketReport');
  }
  if (insights.growth_sectors || insights.at_risk_sectors || insights.top_skills_demand) {
    sections.push('industryTrends');
  }
  if (insights.market_news) {
    sections.push('newsAndCareerIntel');
  }
  return sections;
};

const fetchJobStatus = async (
  jobId: string,
  base: string,
): Promise<JobStatusResponse | null> => {
  try {
    const response = await fetch(`${base}/api/market-insights/status/${jobId}`);
    if (!response.ok) return null;
    return (await response.json()) as JobStatusResponse;
  } catch {
    return null;
  }
};

const waitForQueuedMarketJob = (
  jobId: string,
  options: MarketGenerateCallbacks = {},
): Promise<MarketInsightsPayload> =>
  new Promise((resolve, reject) => {
    const base = getApiBaseUrl();
    let accumulated: MarketInsightsPayload = {};
    const overviewFired = { value: false };
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(pollId);
      socket?.off('progress', handleProgress);
      socket?.off('connect', handleReconnect);
      socket?.emit('unsubscribe', jobId);
    };

    const finishSuccess = (insights: MarketInsightsPayload) => {
      cleanup();
      options.onProgress?.({ percent: 100, message: 'Your report is ready' });
      applyInsightsUpdate(insights, options, overviewFired);
      resolve(insights);
    };

    const finishError = (message: string) => {
      cleanup();
      reject(new MarketInsightsApiError(message));
    };

    const timeoutId = window.setTimeout(() => {
      if (isMarketOverviewReady(accumulated)) {
        finishSuccess(accumulated);
        return;
      }
      finishError('Market insights job timed out');
    }, JOB_TIMEOUT_MS);

    const handlePoll = async () => {
      if (settled) return;
      const status = await fetchJobStatus(jobId, base);
      if (!status?.success) return;

      if (status.status === 'completed' && status.insights) {
        finishSuccess(status.insights);
        return;
      }

      if (status.insights) {
        accumulated = applyInsightsUpdate(
          accumulated,
          options,
          overviewFired,
          undefined,
          status.insights,
        );
        const section = status.completedSections?.[status.completedSections.length - 1];
        if (section) {
          const percent = SECTION_PROGRESS[section] ?? 50;
          options.onProgress?.({
            percent,
            message: `Updating ${section}`,
          });
        }
      }
    };

    const pollId = window.setInterval(() => {
      void handlePoll();
    }, POLL_INTERVAL_MS);
    void handlePoll();

    const socket = getSocket();
    const handleReconnect = () => {
      socket?.emit('subscribe', jobId);
    };

    const handleProgress = (raw: MarketProgressEvent) => {
      if (raw.jobId && raw.jobId !== jobId) return;

      if (raw.type === 'job_start') {
        options.onProgress?.({ percent: 8, message: raw.stage || 'Preparing market insights' });
        return;
      }

      if (raw.type === 'section_in_progress') {
        const section = raw.section || '';
        options.onProgress?.({
          percent: SECTION_PROGRESS[section] ?? 40,
          message: section ? `Updating ${section}` : 'Generating sections',
        });
        return;
      }

      if (raw.type === 'section_success') {
        const section = raw.section || '';
        const snapshot = asRecord(raw.data);
        if (snapshot) {
          accumulated = mergeStatusInsights(accumulated, snapshot);
        } else {
          accumulated = mergeMarketSection(accumulated, section, raw.data);
        }
        accumulated = applyInsightsUpdate(
          accumulated,
          options,
          overviewFired,
        );
        options.onProgress?.({
          percent: SECTION_PROGRESS[section] ?? 50,
          message: section ? `Updating ${section}` : 'Generating sections',
        });
        void handlePoll();
        return;
      }

      if (raw.type === 'job_complete' || raw.type === 'job_fallback') {
        const insights = asRecord(raw.insights) ?? accumulated;
        if (!insights || Object.keys(insights).length === 0) {
          finishError('Job completed without insights');
          return;
        }
        finishSuccess(insights);
        return;
      }

      if (raw.type === 'job_error') {
        finishError(raw.error || 'Market insights job failed');
      }
    };

    if (socket) {
      socket.on('progress', handleProgress);
      socket.on('connect', handleReconnect);
      socket.emit('subscribe', jobId);
      if (!socket.connected) socket.connect();
    }
  });

/**
 * Call POST /api/market-insights/generate and resolve insights for
 * cache-hit, queued (Socket.IO + poll progress), or sync-fallback responses.
 */
export async function generateMarketInsights(
  params: GenerateMarketInsightsParams,
  callbacks: MarketGenerateCallbacks = {},
): Promise<MarketInsightsPayload> {
  if (!isApiConfigured()) {
    throw new MarketInsightsApiError('VITE_API_URL is not configured');
  }

  const { onProgress, onOverviewReady, onInsightsUpdate } = callbacks;
  const base = getApiBaseUrl();
  onProgress?.({ percent: 5, message: 'Starting market insights' });

  const response = await fetch(`${base}/api/market-insights/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: params.location,
      userId: params.userId || 'guest',
      job: params.job || undefined,
      seniority: params.seniority || undefined,
      industry: params.industry || undefined,
    }),
  });

  const payload = (await response.json()) as MarketInsightsGenerateResponse;

  if (!response.ok || !payload.success) {
    throw new MarketInsightsApiError(
      payload.error || payload.message || 'Failed to generate market insights',
    );
  }

  if (payload.insights && (payload.fromCache || !payload.queued)) {
    onProgress?.({ percent: 100, message: payload.fromCache ? 'Loaded from cache' : 'Report ready' });
    if (isMarketOverviewReady(payload.insights)) {
      onOverviewReady?.(payload.insights);
    }
    onInsightsUpdate?.(payload.insights, {
      completedSections: [
        'marketReportVerdict',
        'marketReport',
        'industryTrends',
        'newsAndCareerIntel',
      ],
    });
    return payload.insights;
  }

  if (payload.queued && payload.jobId) {
    void waitForSocketConnection();
    onProgress?.({
      percent: 12,
      message: payload.message || `Queued (position ${payload.position ?? '?'})`,
    });
    return waitForQueuedMarketJob(payload.jobId, callbacks);
  }

  throw new MarketInsightsApiError(payload.message || 'Unexpected market insights response');
}
