import { randomUUID } from 'crypto';
import {
  UserMarketReportLatest,
  UserMarketReportSnapshot,
  type IUserMarketReportLatest,
  type IUserMarketReportSnapshot,
} from '../../db/models/userMarketReport.js';

export type MarketReportInputs = {
  role: string;
  level: string;
  location: string;
  industry?: string;
};

export type CreateMarketReportInput = MarketReportInputs & {
  userId: string;
  insights: Record<string, unknown>;
  generatedAt?: Date | string;
};

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

const toIso = (value: Date | string | undefined): string => {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
};

const summarizeLatest = (doc: IUserMarketReportLatest): MarketReportSummary => ({
  reportId: doc.reportId,
  role: doc.role,
  level: doc.level,
  location: doc.location,
  industry: doc.industry || '',
  generatedAt: toIso(doc.generatedAt),
});

const summarizeSnapshot = (doc: IUserMarketReportSnapshot): MarketReportSummary => ({
  reportId: doc.reportId,
  role: doc.role,
  level: doc.level,
  location: doc.location,
  industry: doc.industry || '',
  generatedAt: toIso(doc.generatedAt),
});

/**
 * Persist a new latest report. If a previous latest exists, copy it to snapshots
 * first (immutable history), then replace latest.
 */
export async function createUserMarketReport(
  input: CreateMarketReportInput,
): Promise<{ latest: MarketReportDetail; snapshottedPrevious: boolean }> {
  const userId = input.userId.trim();
  if (!userId) {
    throw new Error('userId is required');
  }
  if (!input.insights || typeof input.insights !== 'object') {
    throw new Error('insights payload is required');
  }

  const previous = await UserMarketReportLatest.findOne({ userId });
  let snapshottedPrevious = false;

  if (previous) {
    // Append-only: never update an existing snapshot row for this reportId.
    // The findOne-then-create below is a check-then-act race, not atomic — two
    // concurrent calls for the same user (double-click, two tabs, or React
    // StrictMode's double effect-invocation in dev) can both pass the "no
    // existing snapshot" check before either inserts, then both attempt to
    // create the same reportId. Whichever loses that race hits E11000 on the
    // unique reportId index. That's not corruption — it means someone else
    // already wrote the exact same snapshot row we were about to write — so
    // treat it as a benign no-op instead of surfacing an error.
    const existingSnapshot = await UserMarketReportSnapshot.findOne({
      reportId: previous.reportId,
    });
    if (!existingSnapshot) {
      try {
        await UserMarketReportSnapshot.create({
          userId: previous.userId,
          reportId: previous.reportId,
          role: previous.role,
          level: previous.level,
          location: previous.location,
          industry: previous.industry,
          insights: previous.insights,
          generatedAt: previous.generatedAt,
          snapshottedAt: new Date(),
        });
      } catch (error) {
        const isDuplicateKey =
          error && typeof error === 'object' && (error as { code?: number }).code === 11000;
        if (!isDuplicateKey) throw error;
      }
    }
    snapshottedPrevious = true;
  }

  const reportId = randomUUID();
  const generatedAt = input.generatedAt
    ? new Date(input.generatedAt)
    : new Date();

  const latest = await UserMarketReportLatest.findOneAndUpdate(
    { userId },
    {
      $set: {
        reportId,
        role: input.role,
        level: input.level,
        location: input.location,
        industry: input.industry || '',
        insights: input.insights,
        generatedAt,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  if (!latest) {
    throw new Error('Failed to save latest market report');
  }

  return {
    latest: {
      ...summarizeLatest(latest),
      insights: latest.insights as Record<string, unknown>,
      kind: 'latest',
    },
    snapshottedPrevious,
  };
}

export async function listUserMarketReports(userId: string): Promise<{
  latest: MarketReportSummary | null;
  snapshots: MarketReportSummary[];
}> {
  const latestDoc = await UserMarketReportLatest.findOne({ userId });
  const snapshots = await UserMarketReportSnapshot.find({ userId })
    .sort({ generatedAt: -1 })
    .lean();

  return {
    latest: latestDoc ? summarizeLatest(latestDoc) : null,
    snapshots: snapshots.map((doc) =>
      summarizeSnapshot(doc as unknown as IUserMarketReportSnapshot),
    ),
  };
}

export async function getLatestUserMarketReport(
  userId: string,
): Promise<MarketReportDetail | null> {
  const doc = await UserMarketReportLatest.findOne({ userId });
  if (!doc) return null;
  return {
    ...summarizeLatest(doc),
    insights: doc.insights as Record<string, unknown>,
    kind: 'latest',
  };
}

export async function getUserMarketReportSnapshot(
  userId: string,
  reportId: string,
): Promise<MarketReportDetail | null> {
  const doc = await UserMarketReportSnapshot.findOne({ userId, reportId });
  if (!doc) return null;
  return {
    ...summarizeSnapshot(doc),
    insights: doc.insights as Record<string, unknown>,
    kind: 'snapshot',
  };
}
