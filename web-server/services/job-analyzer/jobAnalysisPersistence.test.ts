import { beforeEach, describe, expect, it, vi } from 'vitest';

const created: Record<string, unknown>[] = [];

vi.mock('../../db/models/jobAnalysis.js', () => ({
  JobAnalysis: {
    findOne: vi.fn(async (query: { analysisId?: string }) => {
      if (query.analysisId) {
        return created.find((c) => c.analysisId === query.analysisId) || null;
      }
      return null;
    }),
    create: vi.fn(async (doc: Record<string, unknown>) => {
      const row = { ...doc, createdAt: new Date('2026-08-07T12:00:00.000Z') };
      created.push(row);
      return row;
    }),
    find: vi.fn(() => ({
      sort: () => ({
        select: () => ({
          lean: async () =>
            created.map((c) => ({
              ...c,
              createdAt: c.createdAt,
            })),
        }),
      }),
    })),
  },
}));

import {
  createJobAnalysis,
  listJobAnalyses,
} from './jobAnalysisPersistence.js';

describe('job analysis persistence immutability', () => {
  beforeEach(() => {
    created.length = 0;
    vi.clearAllMocks();
  });

  it('stores a second analysis without overwriting the first', async () => {
    const meta = {
      model: 'test',
      promptVersion: 'job-analyzer-v1',
      analyzedAt: '2026-08-07T12:00:00.000Z',
      source: 'paste' as const,
    };
    const result = {
      roleFocus: 'A',
      roleFocusSummary: 'A',
      statedRequirements: [],
      hiddenExpectations: [
        {
          title: 'H1',
          summary: 's',
          implication: 'i',
          confidence: 'high' as const,
          evidence: [{ quote: 'q' }],
        },
      ],
      questionsWorthAsking: [],
    };

    await createJobAnalysis({
      analysisId: 'a1',
      userId: 'u1',
      title: 'First',
      postingText: 'First posting text that is long enough for storage.',
      source: 'paste',
      result,
      metadata: meta,
    });

    await createJobAnalysis({
      analysisId: 'a2',
      userId: 'u1',
      title: 'Second',
      postingText: 'Second posting text that is long enough for storage.',
      source: 'paste',
      result: { ...result, roleFocus: 'B' },
      metadata: meta,
    });

    expect(created).toHaveLength(2);
    expect(created[0].title).toBe('First');
    expect(created[1].title).toBe('Second');

    const list = await listJobAnalyses('u1');
    expect(list).toHaveLength(2);
  });
});
