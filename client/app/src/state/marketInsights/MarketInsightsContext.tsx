import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";
import { ApiState, ApiStatus, createInitialApiState } from "../api/apiTypes";
import { getSocket } from "../../providers/socket/socket";
import { useAppContext } from "../contexts/AppContext";
import { pollForInsights } from "../../utils/polls/pollForInsights";

// Shape of the backend response for /api/market-insights/generate
export type MarketInsightsLoadingStage =
  | "idle"
  | "first"
  | "second"
  | "third"
  | "complete";

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
  generateMarketInsights: (params: {
    location: string;
    userId?: string;
  }) => Promise<void>;
  loadingStage: MarketInsightsLoadingStage;
  setLoadingStage: (stage: MarketInsightsLoadingStage) => void;
  progressText?: string;
}

const MarketInsightsContext = createContext<
  MarketInsightsContextValue | undefined
>(undefined);

export const useMarketInsightsState = (): MarketInsightsContextValue => {
  const ctx = useContext(MarketInsightsContext);
  if (!ctx) {
    throw new Error(
      "useMarketInsightsState must be used within MarketInsightsProvider",
    );
  }
  return ctx;
};

interface MarketInsightsProviderProps {
  children: ReactNode;
}

export const MarketInsightsProvider: React.FC<MarketInsightsProviderProps> = ({
  children,
}) => {
  const [generateState, setGenerateState] = useState<
    ApiState<MarketInsightsGenerateResponse>
  >(createInitialApiState<MarketInsightsGenerateResponse>());
  const [loadingStage, setLoadingStage] =
    useState<MarketInsightsLoadingStage>("idle");
  const [progressText, setProgressText] = useState<string | undefined>(
    undefined,
  );
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get global server availability state from AppContext
  let setServerAvailable: ((available: boolean) => void) | null = null;
  try {
    const appContext = useAppContext();
    setServerAvailable = appContext.setServerAvailable;
  } catch (e) {
    console.warn("MarketInsightsProvider: AppContext not available");
  }

  const updateServerAvailable = (available: boolean) => {
    if (setServerAvailable) {
      setServerAvailable(available);
    }
  };

  const generateMarketInsights = async ({
    location,
    userId,
  }: {
    location: string;
    userId?: string;
  }) => {
    const apiBase = import.meta.env.VITE_API_URL || "";

    if (!apiBase) {
      console.error(
        "MarketInsights: VITE_API_URL is not configured – falling back to static content.",
      );
      updateServerAvailable(false);
      setGenerateState((prev) => ({
        ...prev,
        status: "idle",
        error: undefined,
      }));
      setLoadingStage("complete");
      setProgressText(undefined);
      return;
    }

    // Reset state
    setGenerateState((prev) => ({
      ...prev,
      status: "in-progress",
      error: undefined,
    }));
    setLoadingStage("first");
    setProgressText("Preparing your market insights...");

    try {
      const controller = new AbortController();
      const timeoutDuration = 15000; // 15 seconds timeout for the initial POST request
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.warn(
          `[MarketInsights] Initial fetch request timed out after ${timeoutDuration / 1000} seconds.`,
        );
      }, timeoutDuration);

      // Step 1: POST /api/market-insights/generate
      let res: Response;
      try {
        res = await fetch(`${apiBase}/api/market-insights/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            location,
            userId: userId || "",
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId); // Clear the timeout as soon as the response is received
      }

      if (!res.ok) {
        const text = await res.text();
        const err = new Error(
          `HTTP_${res.status}: ${text || "Request failed"}`,
        ) as Error & { status: number };
        err.status = res.status;
        throw err;
        // throw new Error(text || `Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as MarketInsightsGenerateResponse;

      // Step 2: Backend returns { queued: true, jobId: "abc123" }
      if (data.queued && data.jobId) {
        const jobId = data.jobId;
        setActiveJobId(jobId);
        setProgressText(data.message || "Queued for processing...");
        console.log(`[MarketInsights] Job queued with ID: ${jobId}`);

        // Step 3: Check if WebSocket available
        const socket = getSocket();

        if (socket && socket.connected) {
          // WebSocket path: Subscribe to job updates
          console.log(
            `[MarketInsights] ✓ WebSocket available, subscribing to jobId: ${jobId}`,
          );
          socket.emit("subscribe", jobId);

          // Keep status as in-progress, wait for WebSocket 'progress' event with 'completed' stage
          setGenerateState((prev) => ({
            ...prev,
            status: "in-progress",
            data,
            error: undefined,
          }));
        } else {
          // Fallback: Polling path
          console.warn(
            `[MarketInsights] ✗ WebSocket not available, falling back to polling for jobId: ${jobId}`,
          );

          // Start polling
          pollForInsights(jobId)
            .then((insights) => {
              if (insights) {
                console.log(
                  `[MarketInsights] ✓ Polling completed, insights received`,
                );
                updateServerAvailable(true);
                setGenerateState({
                  status: "success",
                  data: {
                    success: true,
                    insights,
                  },
                  error: undefined,
                });
                setLoadingStage("complete");
                setProgressText("Insights ready");
                setActiveJobId(null);
              } else {
                console.error(
                  `[MarketInsights] ✗ Polling timeout - no insights received`,
                );
                setGenerateState({
                  status: "error",
                  error: "Insights generation timed out. Please try again.",
                  data: undefined,
                });
                setLoadingStage("complete");
                setProgressText("Request timed out");
                setActiveJobId(null);
              }
            })
            .catch((error) => {
              console.error(`[MarketInsights] Polling error:`, error);
              setGenerateState({
                status: "error",
                error:
                  error instanceof Error ? error.message : "Polling failed",
                data: undefined,
              });
              setLoadingStage("complete");
              setProgressText("Failed to retrieve insights");
              setActiveJobId(null);
            });
        }
      } else {
        // Non-queued path: insights returned immediately
        updateServerAvailable(true);
        setGenerateState({
          status: "success",
          data,
          error: undefined,
        });
        setLoadingStage("complete");
        setProgressText("Insights ready");
      }
    } catch (error) {
      const isError = error instanceof Error;
      const message = isError ? error.message : "Unknown error";
      const status = (error as any)?.status as number | undefined;

      // Handle AbortError specifically for the fetch timeout
      if (isError && error.name === "AbortError") {
        console.warn(
          "MarketInsights: Initial request timed out – falling back to static content.",
        );
        updateServerAvailable(false);
        setGenerateState((prev) => ({
          ...prev,
          status: "idle",
          error: "Initial request timed out. Please try again later.",
        }));
        setLoadingStage("complete");
        setProgressText("Request timed out");
        return;
      }

      console.error("Failed to call /api/market-insights/generate:", error);

      const looksLikeNetworkFailure =
        isError &&
        /Failed to fetch|NetworkError|TypeError: Network request failed/i.test(
          message,
        );

      const looksLikeServerFailure =
        typeof status === "number"
          ? status >= 500
          : /status 5\d\d|Internal Server Error/i.test(message);

      // test route mismatch cas
      const looksLikeNotFound =
        status === 404 || /HTTP_404|status 404|Not Found/i.test(message);

      if (
        looksLikeNetworkFailure ||
        looksLikeServerFailure ||
        looksLikeNotFound
      ) {
        console.warn(
          "MarketInsights: backend appears unreachable – falling back to static content.",
        );
        updateServerAvailable(false);
        setGenerateState((prev) => ({
          ...prev,
          status: "idle",
          error: undefined,
        }));
        setLoadingStage("complete");
        setProgressText(undefined);
        return;
      }

      updateServerAvailable(true);
      setGenerateState({
        status: "error",
        error: message,
        data: undefined,
      });
      setLoadingStage("complete");
      setProgressText(message);
    }
  };

  // Step 4: Listen for WebSocket progress events
  useEffect(() => {
    const socket = getSocket();

    const handleProgress = (payload: {
      stage: string;
      progress?: number;
      insights?: any;
      error?: string;
      jobId?: string;
    }) => {
      console.log("[MarketInsights] Received progress event:", payload);

      // Only process if this is for our active job
      if (activeJobId && payload.jobId && payload.jobId !== activeJobId) {
        console.log(
          `[MarketInsights] Ignoring progress for different job: ${payload.jobId}`,
        );
        return;
      }

      // Handle errors
      if (payload.error) {
        console.error("[MarketInsights] Progress error:", payload.error);
        setGenerateState({
          status: "error",
          error: payload.error,
          data: undefined,
        });
        setLoadingStage("complete");
        setProgressText(payload.error);
        setActiveJobId(null);
        return;
      }

      // Handle completion
      if (payload.stage === "completed" && payload.insights) {
        console.log(
          "[MarketInsights] ✓ Job completed via WebSocket, insights received",
        );
        updateServerAvailable(true);
        setGenerateState({
          status: "success",
          data: {
            success: true,
            insights: payload.insights,
          },
          error: undefined,
        });
        setLoadingStage("complete");
        setProgressText("Insights ready");
        setActiveJobId(null);
        return;
      }

      // Handle intermediate progress
      if (payload.stage && payload.stage !== "completed") {
        console.log(`[MarketInsights] Progress update: ${payload.stage}`);
        setProgressText(payload.stage);

        // Update loading stage based on progress
        if (payload.progress) {
          if (payload.progress < 30) setLoadingStage("first");
          else if (payload.progress < 70) setLoadingStage("second");
          else setLoadingStage("third");
        }
      }
    };

    socket.on("progress", handleProgress);
    console.log("[MarketInsights] WebSocket progress listener registered");

    return () => {
      // Step 5: Cleanup - remove progress listener
      socket.off("progress", handleProgress);
      console.log("[MarketInsights] WebSocket progress listener removed");
    };
  }, [activeJobId]);

  // Cleanup polling on unmount or when job completes
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        console.log("[MarketInsights] Polling interval cleared");
      }
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
