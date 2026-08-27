import { useMemo } from 'react';
import {
  hasMarketVerdictSignals,
  isMarketOverviewDisplayReady,
} from '../../services/marketInsights';
import { useClarity } from '../../state/contexts/ClarityContext';
import { useAdaptedMarketReport } from './useAdaptedMarketReport';

/** Skeleton vs live vs fixture decisions for the market overview page. */
export function useMarketOverviewUiState() {
  const { state } = useClarity();
  const live = useAdaptedMarketReport();

  return useMemo(() => {
    const isLiveRun = state.marketGenerationStatus !== 'idle';
    const heroReady = isMarketOverviewDisplayReady(state.marketLiveInsights);
    const hasVerdictSignals = hasMarketVerdictSignals(state.marketLiveInsights);
    const showVerdictSkeleton = isLiveRun && !hasVerdictSignals;
    const showHeadlineSkeleton = isLiveRun && hasVerdictSignals && !heroReady;
    const showShiftSkeleton = isLiveRun && (live?.shifts.length ?? 0) < 3;
    const useFixtures = !isLiveRun && !live?.fromLive;

    return {
      live,
      isLiveRun,
      heroReady,
      hasVerdictSignals,
      showVerdictSkeleton,
      showHeadlineSkeleton,
      showShiftSkeleton,
      useFixtures,
    };
  }, [live, state.marketGenerationStatus, state.marketLiveInsights]);
}
