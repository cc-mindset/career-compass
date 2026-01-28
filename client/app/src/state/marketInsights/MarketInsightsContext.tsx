import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ApiState, ApiStatus, createInitialApiState } from '../api/apiTypes';
import { getSocket, waitForSocketConnection } from '../../providers/socket/socket';

// Shape of the backend response for /api/market-insights/generate
export type MarketInsightsLoadingStage = 'idle' | 'first' | 'second' | 'third' | 'complete';

export interface MarketInsightsGenerateResponse {
  success: boolean;
  queued?: boolean;
  jobId?: string;
  position?: number;
  message?: string;
  insights?: unknown;
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

  const generateMarketInsights = async ({ location, userId }: { location: string; userId?: string }) => {
    const apiBase = import.meta.env.VITE_API_URL || '';

    if (!apiBase) {
      // If API base is not configured, surface a simple error state but don't block UX
      setGenerateState({
        status: 'error',
        error: 'VITE_API_URL is not configured',
      });
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
        setGenerateState({
          status: 'success',
          data,
          error: undefined,
        });
        setLoadingStage('complete');
        setProgressText('Insights ready');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to call /api/market-insights/generate:', error);
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
      }}
    >
      {children}
    </MarketInsightsContext.Provider>
  );
};

