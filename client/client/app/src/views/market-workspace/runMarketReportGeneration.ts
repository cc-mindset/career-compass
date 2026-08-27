import { isApiConfigured } from '../../lib/apiBase';
import {
  generateMarketInsights,
  type MarketGenerateCallbacks,
  type MarketGenerateProgress,
  type MarketInsightsPayload,
} from '../../services/marketInsights';

export type MarketInputs = {
  location: string;
  role: string;
  level: string;
  industry: string;
};

export type RunMarketGenerateResult =
  | { ok: true; insights: MarketInsightsPayload; fromFixtures: false }
  | { ok: true; insights: null; fromFixtures: true }
  | { ok: false; error: string };

export type RunMarketReportOptions = {
  userId?: string;
} & MarketGenerateCallbacks;

/**
 * Live generate when VITE_API_URL is set; otherwise signal fixture/demo path.
 */
export async function runMarketReportGeneration(
  market: MarketInputs,
  callbacks: MarketGenerateCallbacks = {},
  options?: { userId?: string },
): Promise<RunMarketGenerateResult> {
  const mergedCallbacks: RunMarketReportOptions = {
    ...callbacks,
    userId: options?.userId,
  };

  if (!isApiConfigured()) {
    mergedCallbacks.onProgress?.({ percent: 100, message: 'Demo mode (no API URL)' });
    return { ok: true, insights: null, fromFixtures: true };
  }

  try {
    const insights = await generateMarketInsights(
      {
        location: market.location,
        job: market.role,
        seniority: market.level,
        industry: market.industry,
        userId: mergedCallbacks.userId || 'guest',
      },
      mergedCallbacks,
    );
    return { ok: true, insights, fromFixtures: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Market report generation failed';
    return { ok: false, error: message };
  }
}

export type { MarketGenerateProgress, MarketGenerateCallbacks };
