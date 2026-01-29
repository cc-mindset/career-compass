import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ApiState, ApiStatus, createInitialApiState } from '../api/apiTypes';
import { getSocket, waitForSocketConnection } from '../../providers/socket/socket';
import { useAppContext } from '../contexts/AppContext';
import { NewsArticle, TrendReport, RecentNewsArticle } from '../../utils/types/types'; 


// Shape of the backend response for /api/market-insights/generate
export type MarketInsightsLoadingStage = 'idle' | 'first' | 'second' | 'third' | 'complete';

export interface MarketInsightsGenerateResponse {
  success: boolean;
  queued?: boolean;
  jobId?: string;
  position?: number;
  message?: string;
  insights?: {
    location: string;
    country: string;
    reportSummary: {
      paragraph1: string;
      paragraph2: string;
      paragraph3: string;
      paragraph4: string;
      strongestOpportunity: string;
      highestRiskSector: string;
      topSkillDemand: string;
      pivotNecessity: string;
    };
    newsArticles: NewsArticle[];
    trendReports: TrendReport[];
    highGrowthSectors: any[];
    atRiskRoles: any[];
    topSkills: any[];
    marketRisks: any[];
    recentNews: RecentNewsArticle[];
    labourMarketSnapshot: any;
    locationVsRegion: any[];
  };
  generated_at?: string;
}

interface MarketInsightsContextValue {
  generateState: ApiState<MarketInsightsGenerateResponse>;
  generateStatus: ApiStatus;
  generateError?: string;
  generateMarketInsights: (params: { location: string; userId?: string }) => Promise<void>;
  loadingStage: MarketInsightsLoadingStage;
  setLoadingStage: (stage: MarketInsightsLoadingStage) => void;
  progressText?: string;
  insights: MarketInsightsGenerateResponse['insights'] | null;
}

const MarketInsightsContext = createContext<MarketInsightsContextValue | undefined>(undefined);

export const useMarketInsightsState = (): MarketInsightsContextValue => {
  const ctx = useContext(MarketInsightsContext);
  if (!ctx) {
    throw new Error('useMarketInsightsState must be used within MarketInsightsProvider');
  }
  return ctx;
};

interface MarketInsightsProviderProps {
  children: ReactNode;
}

export const MarketInsightsProvider: React.FC<MarketInsightsProviderProps> = ({ children }) => {
  const [generateState, setGenerateState] = useState<ApiState<MarketInsightsGenerateResponse>>(
    createInitialApiState<MarketInsightsGenerateResponse>()
  );
  const [loadingStage, setLoadingStage] = useState<MarketInsightsLoadingStage>('idle');
  const [progressText, setProgressText] = useState<string | undefined>(undefined);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  
  // Get global server availability state from AppContext
  // MarketInsightsProvider wraps AppProvider, so we can use useAppContext
  let setServerAvailable: ((available: boolean) => void) | null = null;
  try {
    const appContext = useAppContext();
    setServerAvailable = appContext.setServerAvailable;
  } catch (e) {
    // AppContext not available yet (shouldn't happen in normal flow)
    console.warn('MarketInsightsProvider: AppContext not available');
  }
  
  const updateServerAvailable = (available: boolean) => {
    if (setServerAvailable) {
      setServerAvailable(available);
    }
  };

  const generateMarketInsights = async ({ location, userId }: { location: string; userId?: string }) => {
    const apiBase = import.meta.env.VITE_API_URL || '';

    if (!apiBase) {
      // If API base is not configured, treat backend as unavailable and
      // fall back to the original constants-based page (no blocking error UI).
      console.error('MarketInsights: VITE_API_URL is not configured – falling back to static content.');
      updateServerAvailable(false);
      setGenerateState(prev => ({
        ...prev,
        status: 'idle',
        error: undefined,
      }));
      setLoadingStage('complete');
      setProgressText(undefined);
      return;
    }

    setGenerateState(prev => ({
      ...prev,
      status: 'in-progress',
      error: undefined,
    }));
    setLoadingStage('first');
    setProgressText('Preparing your market insights...');

    try {
      const res = await fetch(`${apiBase}/api/market-insights/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location,
          userId: userId || '',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as MarketInsightsGenerateResponse;

      // If the job was queued, keep status as in-progress and subscribe for WebSocket updates
      if (data.queued && data.jobId) {
        setActiveJobId(data.jobId);
        setProgressText(data.message || 'Queued for processing...');
        setLoadingStage('first');

        // Ensure socket is connected before subscribing
        const socket = getSocket();
        const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        console.log(`[MarketInsights] API Response received - queued: ${data.queued}, jobId: ${data.jobId}`);
        console.log(`[MarketInsights] Socket URL: ${socketUrl}`);
        console.log(`[MarketInsights] Socket connected: ${socket.connected}, id: ${socket.id || 'none'}`);
        
        const subscribeToJob = () => {
          socket.emit('subscribe', data.jobId);
          console.log(`[MarketInsights] ✓ Emitted 'subscribe' event for jobId: ${data.jobId}`);
        };
        
        if (socket.connected) {
          subscribeToJob();
        } else {
          console.warn(`[MarketInsights] Socket not connected, waiting for connection (max 10s)...`);
          // Wait longer for connection
          waitForSocketConnection(10000).then((connected) => {
            if (connected) {
              console.log(`[MarketInsights] Socket connected, subscribing to jobId: ${data.jobId}`);
              subscribeToJob();
            } else {
              console.error(`[MarketInsights] ✗ Failed to connect socket after timeout, attempting subscription anyway`);
              subscribeToJob(); // Try anyway - might work if connection happens later
            }
          });
        }

        // Do not mark as success yet – wait for WebSocket 'completed'
        setGenerateState(prev => ({
          ...prev,
          status: 'in-progress',
          data,
          error: undefined,
        }));
      } else {
        // Non-queued path: treat as completed immediately
        // Server is available since we got a successful response
        updateServerAvailable(true);
        setGenerateState({
          status: 'success',
          data,
          error: undefined,
        });
        setLoadingStage('complete');
        setProgressText('Insights ready');
      }
    } catch (error) {
      const isError = error instanceof Error;
      const message = isError ? error.message : 'Unknown error';

      console.error('Failed to call /api/market-insights/generate:', error);

      // If we cannot reach the server at all (network-level failure),
      // fall back to the original constants-based page instead of
      // blocking the user with an error screen.
      const looksLikeNetworkFailure =
        isError &&
        /Failed to fetch|NetworkError|TypeError: Network request failed/i.test(message);

      if (looksLikeNetworkFailure) {
        console.warn('MarketInsights: backend appears unreachable – falling back to static content.');
        updateServerAvailable(false);
        setGenerateState(prev => ({
          ...prev,
          status: 'idle',
          error: undefined,
        }));
        setLoadingStage('complete');
        setProgressText(undefined);
        return;
      }

      // For non-network errors (backend reachable but failed), keep the explicit error state.
      updateServerAvailable(true);
      setGenerateState({
        status: 'error',
        error: message,
        data: undefined,
      });
      setLoadingStage('complete');
      setProgressText(message);
    }
  };

  // Listen for WebSocket progress events for the active job
  useEffect(() => {
    const socket = getSocket();

    const handleProgress = (payload: { stage: string; progress?: number; insights?: any; error?: string }) => {
      console.log('[MarketInsights] Received progress event:', payload);
      
      // If the server reports an error, surface it
      if (payload.error) {
        console.error('[MarketInsights] Progress error:', payload.error);
        setGenerateState({
          status: 'error',
          error: payload.error,
          data: undefined,
        });
        setLoadingStage('complete');
        setProgressText(payload.error);
        return;
      }

      // Completed with insights
      if (payload.stage === 'completed') {
        console.log('[MarketInsights] Job completed, insights received');
        // Server is available since we received WebSocket data
        updateServerAvailable(true);
        setGenerateState(prev => ({
          status: 'success',
          data: {
            ...(prev.data || { success: true }),
            insights: payload.insights,
          },
          error: undefined,
        }));
        setLoadingStage('complete');
        setProgressText('Insights ready');
        return;
      }

      // Intermediate progress updates
      console.log(`[MarketInsights] Progress update: ${payload.stage} (${payload.progress}%)`);
      setProgressText(payload.stage);
      setLoadingStage(prev => {
        if (prev === 'idle') return 'first';
        if (prev === 'first') return 'second';
        if (prev === 'second') return 'third';
        return prev;
      });
    };

    socket.on('progress', handleProgress);
    console.log('[MarketInsights] Progress listener registered');

    return () => {
      socket.off('progress', handleProgress);
      console.log('[MarketInsights] Progress listener removed');
    };
  }, []);

  return (
    <MarketInsightsContext.Provider
      value={{
        generateState,
        generateStatus: generateState.status,
        generateError: generateState.error,
        generateMarketInsights,
        loadingStage,
        setLoadingStage,
        progressText,
      insights: generateState.data?.insights || null,  // ADD THIS LINE
    }}
    >
      {children}
    </MarketInsightsContext.Provider>
  );
};

