import { isApiConfigured } from '../../lib/apiBase';
import {
  generateMarketInsights,
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

/**
 * Live generate when VITE_API_URL is set; otherwise signal fixture/demo path.
 */
export async function runMarketReportGeneration(
  market: MarketInputs,
  onProgress?: (update: MarketGenerateProgress) => void,
  options?: { userId?: string },
): Promise<RunMarketGenerateResult> {
  if (!isApiConfigured()) {
    onProgress?.({ percent: 100, message: 'Demo mode (no API URL)' });
    return { ok: true, insights: null, fromFixtures: true };
  }

  try {
    const insights = await generateMarketInsights(
      {
        location: market.location,
        job: market.role,
        seniority: market.level,
        industry: market.industry,
        userId: options?.userId || 'guest',
      },
      onProgress,
    );
    return { ok: true, insights, fromFixtures: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Market report generation failed';
    return { ok: false, error: message };
  }
}
