import { getApiBaseUrl, isApiConfigured } from '../../lib/apiBase';
import { getSocket, waitForSocketConnection } from '../../lib/socket';
import type {
  GenerateMarketInsightsParams,
  MarketInsightsGenerateResponse,
  MarketInsightsPayload,
  MarketProgressEvent,
} from './types';

const SECTION_PROGRESS: Record<string, number> = {
  marketReport: 34,
  industryTrends: 67,
  newsAndCareerIntel: 90,
};

export type MarketGenerateProgress = {
  percent: number;
  message?: string;
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

const waitForJobComplete = (
  jobId: string,
  onProgress?: (update: MarketGenerateProgress) => void,
): Promise<MarketInsightsPayload> =>
  new Promise((resolve, reject) => {
    const socket = getSocket();
    if (!socket) {
      reject(new MarketInsightsApiError('Socket unavailable'));
      return;
    }

    let settled = false;
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new MarketInsightsApiError('Market insights job timed out'));
    }, 120_000);

    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      socket.off('progress', handleProgress);
      socket.emit('unsubscribe', jobId);
    };

    const handleProgress = (raw: MarketProgressEvent) => {
      if (raw.jobId && raw.jobId !== jobId) return;

      if (raw.type === 'job_start') {
        onProgress?.({ percent: 8, message: raw.stage || 'Preparing market insights' });
        return;
      }

      if (raw.type === 'section_success' || raw.type === 'section_in_progress') {
        const section = raw.section || '';
        const percent = SECTION_PROGRESS[section] ?? 50;
        onProgress?.({
          percent,
          message: section ? `Updating ${section}` : 'Generating sections',
        });
        return;
      }

      if (raw.type === 'job_complete' || raw.type === 'job_fallback') {
        const insights = asRecord(raw.insights);
        cleanup();
        if (!insights) {
          reject(new MarketInsightsApiError('Job completed without insights'));
          return;
        }
        onProgress?.({ percent: 100, message: 'Your report is ready' });
        resolve(insights);
        return;
      }

      if (raw.type === 'job_error') {
        cleanup();
        reject(new MarketInsightsApiError(raw.error || 'Market insights job failed'));
      }
    };

    socket.on('progress', handleProgress);
    socket.emit('subscribe', jobId);
  });

/**
 * Call POST /api/market-insights/generate and resolve insights for
 * cache-hit, queued (Socket.IO progress), or sync-fallback responses.
 */
export async function generateMarketInsights(
  params: GenerateMarketInsightsParams,
  onProgress?: (update: MarketGenerateProgress) => void,
): Promise<MarketInsightsPayload> {
  if (!isApiConfigured()) {
    throw new MarketInsightsApiError('VITE_API_URL is not configured');
  }

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
    throw new MarketInsightsApiError(payload.error || payload.message || 'Failed to generate market insights');
  }

  if (payload.insights && (payload.fromCache || !payload.queued)) {
    onProgress?.({ percent: 100, message: payload.fromCache ? 'Loaded from cache' : 'Report ready' });
    return payload.insights;
  }

  if (payload.queued && payload.jobId) {
    const connected = await waitForSocketConnection();
    if (!connected) {
      throw new MarketInsightsApiError('Could not connect for job progress');
    }
    onProgress?.({
      percent: 12,
      message: payload.message || `Queued (position ${payload.position ?? '?'})`,
    });
    return waitForJobComplete(payload.jobId, onProgress);
  }

  throw new MarketInsightsApiError(payload.message || 'Unexpected market insights response');
}
