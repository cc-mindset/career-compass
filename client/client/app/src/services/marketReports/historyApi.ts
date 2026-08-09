import { getApiBaseUrl, isApiConfigured } from '../../lib/apiBase';

export type MarketReportSummary = {
  reportId: string;
  role: string;
  level: string;
  location: string;
  industry: string;
  generatedAt: string;
};

export type MarketReportDetail = MarketReportSummary & {
  insights: Record<string, unknown>;
  kind: 'latest' | 'snapshot';
};

export type MarketReportListResponse = {
  success: boolean;
  latest: MarketReportSummary | null;
  snapshots: MarketReportSummary[];
};

const historyUnavailable = (): boolean => !isApiConfigured();

export async function saveUserMarketReport(params: {
  userId: string;
  role: string;
  level: string;
  location: string;
  industry: string;
  insights: Record<string, unknown>;
}): Promise<MarketReportDetail | null> {
  if (historyUnavailable()) return null;

  const res = await fetch(`${getApiBaseUrl()}/api/market-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = (await res.json()) as {
    success?: boolean;
    latest?: MarketReportDetail;
    error?: string;
  };
  if (!res.ok || !body.success || !body.latest) {
    throw new Error(body.error || 'Failed to save market report');
  }
  return body.latest;
}

export async function listUserMarketReports(
  userId: string,
): Promise<MarketReportListResponse> {
  if (historyUnavailable()) {
    return { success: true, latest: null, snapshots: [] };
  }

  const res = await fetch(`${getApiBaseUrl()}/api/market-reports/${encodeURIComponent(userId)}`);
  const body = (await res.json()) as MarketReportListResponse & { error?: string };
  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Failed to list market reports');
  }
  return {
    success: true,
    latest: body.latest ?? null,
    snapshots: body.snapshots ?? [],
  };
}

export async function fetchLatestUserMarketReport(
  userId: string,
): Promise<MarketReportDetail | null> {
  if (historyUnavailable()) return null;

  const res = await fetch(
    `${getApiBaseUrl()}/api/market-reports/${encodeURIComponent(userId)}/latest`,
  );
  if (res.status === 404) return null;
  const body = (await res.json()) as {
    success?: boolean;
    report?: MarketReportDetail;
    error?: string;
  };
  if (!res.ok || !body.success || !body.report) {
    throw new Error(body.error || 'Failed to fetch latest report');
  }
  return body.report;
}

export async function fetchUserMarketReportSnapshot(
  userId: string,
  reportId: string,
): Promise<MarketReportDetail | null> {
  if (historyUnavailable()) return null;

  const res = await fetch(
    `${getApiBaseUrl()}/api/market-reports/${encodeURIComponent(userId)}/snapshots/${encodeURIComponent(reportId)}`,
  );
  if (res.status === 404) return null;
  const body = (await res.json()) as {
    success?: boolean;
    report?: MarketReportDetail;
    error?: string;
  };
  if (!res.ok || !body.success || !body.report) {
    throw new Error(body.error || 'Failed to fetch snapshot');
  }
  return body.report;
}

export function formatReportDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
