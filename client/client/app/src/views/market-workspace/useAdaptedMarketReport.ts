import { useMemo } from 'react';
import { adaptMarketInsights } from '../../services/marketInsights';
import type { AdaptedMarketReport } from '../../services/marketInsights';
import { useClarity } from '../../state/contexts/ClarityContext';

/** Prefer live API-adapted report; callers keep fixture fallbacks when null. */
export function useAdaptedMarketReport(): AdaptedMarketReport | null {
  const { state } = useClarity();
  return useMemo(
    () => adaptMarketInsights(state.marketLiveInsights),
    [state.marketLiveInsights],
  );
}
