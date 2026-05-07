import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";
import { ApiState, ApiStatus, createInitialApiState } from "../api/apiTypes";
import {
  SectionName,
  SectionsState,
  WSProgressEvent,
} from "../api/sectionTypes";
import { getSocket } from "../../providers/socket/socket";
import { useAppContext } from "../contexts/AppContext";
import { pollForInsights } from "../../utils/polls/pollForInsights";

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
  fromCache?: boolean;
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
  sections: SectionsState;
  retrySection: (section: SectionName) => Promise<void>;
  retrieved: boolean;
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
  const [currentLocation, setCurrentLocation] = useState<string>("");
  const [sections, setSections] = useState<SectionsState>({
    marketReport: { status: "idle" },
    industryTrends: { status: "idle" },
    newsAndCareerIntel: { status: "idle" },
  });
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [retrieved, setRetrieved] = useState<boolean>(false);

  // Get global server availability state from AppContext
  let setServerAvailable: ((available: boolean) => void) | null = null;
  try {
    const appContext = useAppContext();
    setServerAvailable = appContext.setServerAvailable;
  } catch (e) {
    console.warn(`MarketInsightsProvider: AppContext not available ${e || ""}`);
  }

  const updateServerAvailable = (available: boolean) => {
    if (setServerAvailable) {
      setServerAvailable(available);
    }
  };

  const generateMarketInsights = async ({
    location,
    userId,
    section,
  }: {
    location: string;
    userId?: string;
    section?: string;
  }) => {
    const apiBase = import.meta.env.VITE_API_URL || "";

    if (!apiBase) {
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

    setCurrentLocation(location);

    if (!!section) {
      setSections((prev) => ({ ...prev, [section]: { status: "loading" } }));
    } else {
      setSections({
        marketReport: { status: "loading" },
        industryTrends: { status: "loading" },
        newsAndCareerIntel: { status: "loading" },
      });
    }

    setGenerateState((prev) => ({
      ...prev,
      status: "in-progress",
      error: undefined,
    }));
    setLoadingStage("first");
    setProgressText("Preparing your market insights...");

    // Use AbortController to handle fetch timeout
    const controller = new AbortController();
    // Set a timeout to abort the request if it takes too long (e.g., 15 seconds)
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);
    // Reset active job ID to ensure we only process events for the current request
    let res: Response;

    try {
      res = await fetch(`${apiBase}/api/market-insights/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, userId: userId || "" }),
        signal: controller.signal,
      });

      setRetrieved(true);

      if (!res.ok) {
        throw new Error(
          (await res.text()) || `Request failed with status ${res.status}`,
        );
      }

      const data = (await res.json()) as MarketInsightsGenerateResponse;

      // ── Cache hit: insights returned directly, no WebSocket events will fire ──
      if (data.fromCache && data.insights) {
        const insightsData = data.insights as Record<string, unknown>;
        updateServerAvailable(true);
        // Resolve all sections immediately from the merged insights object
        setSections({
          marketReport: { status: "success", data: insightsData },
          industryTrends: { status: "success", data: insightsData },
          newsAndCareerIntel: { status: "success", data: insightsData },
        });
        setGenerateState({ status: "success", data, error: undefined });
        setLoadingStage("complete");
        setProgressText("Insights ready (cached)");
        setActiveJobId(null);
        return;
      }

      if (data.queued && data.jobId) {
        const jobId = data.jobId;
        setActiveJobId(jobId);
        setProgressText(data.message || "Queued for processing...");

        const socket = getSocket();

        if (socket && socket.connected) {
          socket.emit("subscribe", jobId);
          setGenerateState((prev) => ({
            ...prev,
            status: "in-progress",
            data,
            error: undefined,
          }));
        } else {
          pollForInsights(jobId)
            .then((insights) => {
              if (insights) {
                updateServerAvailable(true);
                setGenerateState({
                  status: "success",
                  data: { success: true, insights },
                  error: undefined,
                });
                setLoadingStage("complete");
                setProgressText("Insights ready");
                setActiveJobId(null);
              } else {
                setGenerateState({
                  status: "error",
                  error: "Insights generation timed out",
                  data: undefined,
                });
                setLoadingStage("complete");
                setProgressText("Request timed out");
                setActiveJobId(null);
              }
            })
            .catch((error) => {
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
        updateServerAvailable(true);
        setGenerateState({ status: "success", data, error: undefined });
        setLoadingStage("complete");
        setProgressText("Insights ready");
      }
    } catch (error) {
      const isError = error instanceof Error;
      const message = isError ? error.message : "Unknown error";

      // Handle fetch abort (timeout) separately to avoid showing an error message for expected timeouts
      if (isError && error.name === "AbortError") {
        console.error(
          "[MarketInsights] Fetch request aborted due to 15s timeout",
        );
        console.error("[MarketInsights] Details:", {
          location,
          apiBase,
          timestamp: new Date().toISOString(),
        });
        updateServerAvailable(false);
        setGenerateState((prev) => ({
          ...prev,
          status: "idle",
          error: undefined,
        }));
        setSections({
          marketReport: { status: "idle" },
          industryTrends: { status: "idle" },
          newsAndCareerIntel: { status: "idle" },
        });
        setLoadingStage("complete");
        setProgressText(undefined);
        return;
      }

      const looksLikeNetworkFailure =
        isError &&
        /Failed to fetch|NetworkError|TypeError: Network request failed/i.test(
          message,
        );

      if (looksLikeNetworkFailure) {
        console.error("[MarketInsights] Network failure detected");
        console.error("[MarketInsights] Error message:", message);
        console.error("[MarketInsights] Details:", {
          location,
          apiBase,
          userOnline: navigator.onLine,
          timestamp: new Date().toISOString(),
        });
        updateServerAvailable(false);
        setGenerateState((prev) => ({
          ...prev,
          status: "idle",
          error: undefined,
        }));
        setSections({
          marketReport: { status: "idle" },
          industryTrends: { status: "idle" },
          newsAndCareerIntel: { status: "idle" },
        });
        setLoadingStage("complete");
        setProgressText(undefined);
        return;
      }

      const looksLikeServerFailure =
        /status 500|Internal Server Error|Request failed with status 5/i.test(
          message,
        );

      if (looksLikeServerFailure) {
        console.error("[MarketInsights] Server error (5xx) detected");
        console.error("[MarketInsights] Error message:", message);
        console.error("[MarketInsights] Details:", {
          location,
          apiBase,
          timestamp: new Date().toISOString(),
        });
        updateServerAvailable(false);
        setGenerateState((prev) => ({
          ...prev,
          status: "idle",
          error: undefined,
        }));
        setSections({
          marketReport: { status: "idle" },
          industryTrends: { status: "idle" },
          newsAndCareerIntel: { status: "idle" },
        });
        setLoadingStage("complete");
        setProgressText(undefined);
        return;
      }

      updateServerAvailable(true);
      setGenerateState({ status: "error", error: message, data: undefined });
      setLoadingStage("complete");
      setProgressText(message);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const retrySection = async (section: SectionName) => {
    console.log(`[MarketInsights] Retrying section: ${section}`);
    setSections((prev) => ({
      ...prev,
      [section]: { status: "loading" },
    }));
    await generateMarketInsights({ location: currentLocation, section });
  };

  useEffect(() => {
    const socket = getSocket();

    const handleProgress = (payload: WSProgressEvent) => {
      console.log("[MarketInsights] WS event:", payload);

      if (activeJobId && payload.jobId && payload.jobId !== activeJobId) {
        return;
      }

      switch (payload.type) {
        case "job_start":
          setProgressText(payload.stage || "Starting...");
          break;
        case "section_in_progress":
          if (payload.section && payload.data) {
            console.log(
              `[MarketInsights] \u2713 Section ready with previous data: ${payload.section}`,
            );
            setSections((prev) => ({
              ...prev,
              [payload.section!]: { status: "success", data: payload.data },
            }));
          } else {
            setProgressText(payload.stage || "Processing...");
            setTimeout(() => {
              retrySection(payload.section!);
            }, 3000);
          }
          break;

        case "section_success":
          if (payload.section && payload.data) {
            console.log(
              `[MarketInsights] \u2713 Section ready: ${payload.section}`,
            );
            setSections((prev) => ({
              ...prev,
              [payload.section!]: { status: "success", data: payload.data },
            }));
          }
          break;

        case "section_error":
          if (payload.section) {
            console.error(
              `[MarketInsights] \u2717 Section failed: ${payload.section}`,
            );
            setSections((prev) => ({
              ...prev,
              [payload.section!]: { status: "error", error: payload.error },
            }));
          }
          break;

        case "job_complete":
          console.log("[MarketInsights] \u2713 Job complete");
          updateServerAvailable(true);
          // Resolve any sections still in loading — succeeded ones get data, failed ones get error
          if (payload.failedSections?.length) {
            setSections((prev) => {
              const next = { ...prev };
              (payload.failedSections as string[]).forEach((name) => {
                const key = name as keyof SectionsState;
                if (next[key]?.status === "loading") {
                  next[key] = {
                    status: "error",
                    error: "Section could not be generated",
                  };
                }
              });
              return next;
            });
          }
          setGenerateState({
            status: "success",
            data: { success: true, insights: payload.insights },
            error: undefined,
          });
          setLoadingStage("complete");
          setProgressText("Insights ready");
          setActiveJobId(null);
          break;

        case "job_error":
          console.error("[MarketInsights] \u2717 Job error:", payload.error);
          setGenerateState({
            status: "error",
            error: payload.error,
            data: undefined,
          });
          setLoadingStage("complete");
          setProgressText(payload.error);
          setActiveJobId(null);
          break;
        case "job_fallback":
          console.warn(
            "[MarketInsights] ⚠ Fallback data received:",
            payload.reason,
          );
          // Show fallback mock data so the user sees something instead of an indefinite spinner
          setSections({
            marketReport: { status: "success", data: payload.insights },
            industryTrends: { status: "success", data: payload.insights },
            newsAndCareerIntel: { status: "success", data: payload.insights },
          });
          setGenerateState({
            status: "success",
            data: { success: true, insights: payload.insights },
            error: undefined,
          });
          setLoadingStage("complete");
          setProgressText(
            payload.reason ||
              "Service temporarily unavailable — showing fallback data",
          );
          setActiveJobId(null);
          break;
      }
    };

    socket.on("progress", handleProgress);

    // On reconnect, re-subscribe to the active job — socket gets new ID and loses room membership
    const handleReconnect = () => {
      if (activeJobId) {
        console.log(
          `[MarketInsights] Socket reconnected — re-subscribing to job:${activeJobId}`,
        );
        socket.emit("subscribe", activeJobId);
      }
    };
    socket.on("connect", handleReconnect);

    return () => {
      socket.off("progress", handleProgress);
      socket.off("connect", handleReconnect);
    };
  }, [activeJobId]);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
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
        sections,
        retrySection,
        retrieved
      }}
    >
      {children}
    </MarketInsightsContext.Provider>
  );
};
