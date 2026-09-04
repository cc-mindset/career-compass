import { describe, expect, it, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { extractEvidenceSources } from './evidenceSources';
import { RagNamespace } from '../types/rag';
import { logger } from '../utils/logger.js';
import type { RagRetrievalResponse } from '../types/rag';

const baseResponse = (results: RagRetrievalResponse['results']): RagRetrievalResponse => ({
  results,
  cacheHits: [],
  cacheMisses: [],
});

describe('extractEvidenceSources', () => {
  it('returns an empty list when nothing was retrieved', () => {
    expect(extractEvidenceSources(baseResponse({}))).toEqual([]);
  });

  it('labels a known market-stats code with its human name and lens', () => {
    const response = baseResponse({
      [RagNamespace.LABOR_MARKET_STATS]: [
        { id: '1', score: 0.9, text: 'unemployment ticked down', metadata: { source: 'STATSCAN_LFS' } },
      ],
    });

    const result = extractEvidenceSources(response);
    expect(result).toEqual([
      {
        id: `${RagNamespace.LABOR_MARKET_STATS}::STATSCAN_LFS::`,
        namespace: RagNamespace.LABOR_MARKET_STATS,
        lens: 'Labor market statistics',
        label: 'Statistics Canada — Labour Force Survey (LFS)',
        sourceCode: 'STATSCAN_LFS',
      },
    ]);
  });

  it('falls back gracefully and logs when a market-stats code is unmapped', () => {
    const response = baseResponse({
      [RagNamespace.LABOR_MARKET_STATS]: [
        { id: '1', score: 0.8, text: 'x', metadata: { source: 'FUTURE_SERIES_CODE' } },
      ],
    });

    const result = extractEvidenceSources(response);
    expect(result[0].label).toBe('Government labor statistics');
    expect(result[0].sourceCode).toBe('FUTURE_SERIES_CODE');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('FUTURE_SERIES_CODE'),
    );
  });

  it('formats a market-reports document from publisher/title/date', () => {
    const response = baseResponse({
      [RagNamespace.MARKET_REPORTS]: [
        {
          id: 'r1',
          score: 0.95,
          text: 'excerpt one',
          metadata: { publisher: 'Deloitte', title: 'Future of Work', published_at: '2026-01-15' },
        },
      ],
    });

    const result = extractEvidenceSources(response);
    expect(result[0]).toMatchObject({
      lens: 'Industry & research reports',
      label: 'Deloitte — Future of Work (2026)',
      sourceCode: 'Deloitte',
      title: 'Future of Work',
      publishedAt: '2026-01-15',
    });
  });

  it('dedupes multiple chunks of the same document/series into one row', () => {
    const response = baseResponse({
      [RagNamespace.MARKET_REPORTS]: [
        { id: 'r1', score: 0.9, text: 'chunk 1', metadata: { publisher: 'Deloitte', title: 'Future of Work' } },
        { id: 'r2', score: 0.8, text: 'chunk 2', metadata: { publisher: 'Deloitte', title: 'Future of Work' } },
      ],
    });

    expect(extractEvidenceSources(response)).toHaveLength(1);
  });

  it('keeps distinct news articles from the same publisher as separate rows', () => {
    const response = baseResponse({
      [RagNamespace.MARKET_NEWS]: [
        { id: 'n1', score: 0.9, text: 'a', metadata: { source: 'Reuters', title: 'Layoffs hit tech' } },
        { id: 'n2', score: 0.85, text: 'b', metadata: { source: 'Reuters', title: 'Hiring rebounds' } },
      ],
    });

    const result = extractEvidenceSources(response);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.label)).toEqual([
      'Reuters — Layoffs hit tech',
      'Reuters — Hiring rebounds',
    ]);
  });

  it('groups results across namespaces with the correct lens per namespace', () => {
    const response = baseResponse({
      [RagNamespace.LABOR_MARKET_STATS]: [
        { id: '1', score: 0.9, text: 'x', metadata: { source: 'BLS_JOLTS' } },
      ],
      [RagNamespace.MARKET_NEWS]: [
        { id: '2', score: 0.9, text: 'y', metadata: { source: 'CBC', title: 'Jobs report' } },
      ],
    });

    const result = extractEvidenceSources(response);
    expect(result.find((s) => s.namespace === RagNamespace.LABOR_MARKET_STATS)?.lens).toBe(
      'Labor market statistics',
    );
    expect(result.find((s) => s.namespace === RagNamespace.MARKET_NEWS)?.lens).toBe('Market news');
  });
});
