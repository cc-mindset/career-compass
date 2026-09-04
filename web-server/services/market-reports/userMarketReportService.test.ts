import { beforeEach, describe, expect, it, vi } from 'vitest';

const latestStore: Record<string, any> = {};
const snapshotStore: Record<string, any> = {};

vi.mock('../../db/models/userMarketReport.js', () => {
  const UserMarketReportLatest = {
    findOne: vi.fn(async (query: { userId: string }) => {
      const doc = latestStore[query.userId];
      return doc ? { ...doc } : null;
    }),
    findOneAndUpdate: vi.fn(
      async (
        query: { userId: string },
        update: { $set: Record<string, unknown> },
        _opts: unknown,
      ) => {
        const next = {
          userId: query.userId,
          ...(latestStore[query.userId] || {}),
          ...update.$set,
        };
        latestStore[query.userId] = next;
        return { ...next };
      },
    ),
  };

  const UserMarketReportSnapshot = {
    findOne: vi.fn(async (query: { reportId?: string; userId?: string }) => {
      if (query.reportId) {
        const doc = snapshotStore[query.reportId];
        return doc ? { ...doc } : null;
      }
      return null;
    }),
    create: vi.fn(async (doc: Record<string, unknown>) => {
      const reportId = String(doc.reportId);
      if (snapshotStore[reportId]) {
        throw new Error('duplicate snapshot');
      }
      snapshotStore[reportId] = { ...doc };
      return { ...doc };
    }),
    find: vi.fn((query: { userId: string }) => ({
      sort: () => ({
        lean: async () =>
          Object.values(snapshotStore)
            .filter((s) => s.userId === query.userId)
            .sort(
              (a, b) =>
                new Date(b.generatedAt).getTime() -
                new Date(a.generatedAt).getTime(),
            ),
      }),
    })),
  };

  return { UserMarketReportLatest, UserMarketReportSnapshot };
});

import {
  createUserMarketReport,
  getUserMarketReportSnapshot,
  listUserMarketReports,
} from './userMarketReportService.js';
import { UserMarketReportSnapshot } from '../../db/models/userMarketReport.js';

describe('createUserMarketReport history immutability', () => {
  beforeEach(() => {
    for (const key of Object.keys(latestStore)) delete latestStore[key];
    for (const key of Object.keys(snapshotStore)) delete snapshotStore[key];
    vi.clearAllMocks();
  });

  it('snapshots previous latest and leaves prior snapshot insights unchanged on create-new', async () => {
    const first = await createUserMarketReport({
      userId: 'user-1',
      role: 'Product Manager',
      level: 'Senior',
      location: 'Toronto, Canada',
      industry: 'Technology',
      insights: { market_report_summary_brief: 'First report' },
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(first.snapshottedPrevious).toBe(false);
    const firstReportId = first.latest.reportId;

    const second = await createUserMarketReport({
      userId: 'user-1',
      role: 'Product Lead',
      level: 'Director',
      location: 'Vancouver, Canada',
      industry: 'Finance',
      insights: { market_report_summary_brief: 'Second report' },
      generatedAt: '2026-03-01T00:00:00.000Z',
    });

    expect(second.snapshottedPrevious).toBe(true);
    expect(second.latest.reportId).not.toBe(firstReportId);
    expect(second.latest.insights.market_report_summary_brief).toBe(
      'Second report',
    );

    const list = await listUserMarketReports('user-1');
    expect(list.latest?.reportId).toBe(second.latest.reportId);
    expect(list.snapshots).toHaveLength(1);
    expect(list.snapshots[0].reportId).toBe(firstReportId);
    expect(list.snapshots[0].role).toBe('Product Manager');

    const snapshot = await getUserMarketReportSnapshot('user-1', firstReportId);
    expect(snapshot?.insights.market_report_summary_brief).toBe('First report');

    // Create a third report — first snapshot must remain unchanged
    await createUserMarketReport({
      userId: 'user-1',
      role: 'PM',
      level: 'Mid',
      location: 'Ottawa, Canada',
      industry: 'Gov',
      insights: { market_report_summary_brief: 'Third report' },
    });

    const stillFirst = await getUserMarketReportSnapshot(
      'user-1',
      firstReportId,
    );
    expect(stillFirst?.insights.market_report_summary_brief).toBe(
      'First report',
    );
    expect(stillFirst?.role).toBe('Product Manager');

    // create was called once per archived latest (first and second)
    expect(UserMarketReportSnapshot.create).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite an existing snapshot document for the same reportId', async () => {
    const first = await createUserMarketReport({
      userId: 'user-2',
      role: 'Analyst',
      level: 'Junior',
      location: 'Montreal, Canada',
      insights: { market_report_summary_brief: 'A' },
    });

    // Seed a snapshot manually as if a prior create already archived it
    snapshotStore[first.latest.reportId] = {
      userId: 'user-2',
      reportId: first.latest.reportId,
      role: 'Analyst',
      level: 'Junior',
      location: 'Montreal, Canada',
      industry: '',
      insights: { market_report_summary_brief: 'A-original' },
      generatedAt: new Date('2026-01-01'),
      snapshottedAt: new Date('2026-01-02'),
    };

    await createUserMarketReport({
      userId: 'user-2',
      role: 'Analyst',
      level: 'Mid',
      location: 'Montreal, Canada',
      insights: { market_report_summary_brief: 'B' },
    });

    expect(snapshotStore[first.latest.reportId].insights).toEqual({
      market_report_summary_brief: 'A-original',
    });
    // Should skip create because snapshot already exists
    expect(UserMarketReportSnapshot.create).not.toHaveBeenCalled();
  });

  it('treats a concurrent duplicate-key error on snapshot create as a benign no-op (TOCTOU race)', async () => {
    const first = await createUserMarketReport({
      userId: 'user-3',
      role: 'Analyst',
      level: 'Junior',
      location: 'Ottawa, Canada',
      insights: { market_report_summary_brief: 'A' },
    });

    // findOne finds nothing yet (this call lost the read race), but by the time
    // create() runs, a concurrent call has already inserted the same reportId —
    // simulate the real MongoServerError shape (E11000, code 11000).
    vi.mocked(UserMarketReportSnapshot.create).mockImplementationOnce(async () => {
      const err = new Error('E11000 duplicate key error') as Error & { code: number };
      err.code = 11000;
      throw err;
    });

    await expect(
      createUserMarketReport({
        userId: 'user-3',
        role: 'Analyst',
        level: 'Mid',
        location: 'Ottawa, Canada',
        insights: { market_report_summary_brief: 'B' },
      }),
    ).resolves.toMatchObject({ snapshottedPrevious: true });

    void first;
  });
});
