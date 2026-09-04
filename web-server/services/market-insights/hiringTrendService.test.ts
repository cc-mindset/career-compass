import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const docs: Record<string, unknown>[] = [];

const matchesField = (value: unknown, field: unknown): boolean => {
  if (value instanceof RegExp) return value.test(String(field));
  if (value && typeof value === 'object' && '$in' in (value as Record<string, unknown>)) {
    return ((value as { $in: unknown[] }).$in).includes(field);
  }
  return field === value;
};

vi.mock('../../db/models/geoHiringTrend.js', () => ({
  default: {
    findOne: vi.fn((query: Record<string, unknown>) => ({
      lean: async () => {
        const match = docs.find((d) =>
          Object.entries(query).every(([key, value]) => matchesField(value, d[key])),
        );
        return match || null;
      },
    })),
    find: vi.fn((query: Record<string, unknown>) => ({
      lean: async () =>
        docs.filter((d) => Object.entries(query).every(([key, value]) => matchesField(value, d[key]))),
    })),
  },
}));

import { resolveHiringTrendSeries } from './hiringTrendService';
import { logger } from '../../utils/logger.js';

const seedDoc = (overrides: Record<string, unknown>) =>
  docs.push({
    series_id: 'X',
    country: 'CA',
    geo: 'Toronto',
    geo_type: 'metro',
    signal_type: 'unemployment_rate',
    periods_history: [],
    ...overrides,
  });

describe('resolveHiringTrendSeries', () => {
  beforeEach(() => {
    docs.length = 0;
    vi.clearAllMocks();
  });

  it('returns available:false for a location with no metro/CMA coverage', async () => {
    const result = await resolveHiringTrendSeries('Lagos, Nigeria');
    expect(result).toEqual({ available: false, window_label: '', local_label: '', national_label: '', points: [] });
  });

  it('returns available:false for an unrecognized location string', async () => {
    const result = await resolveHiringTrendSeries('Nowhereville, Nowhere');
    expect(result.available).toBe(false);
  });

  it('builds real local-vs-national points for a covered city', async () => {
    seedDoc({
      series_id: 'STATSCAN_V1643279334',
      geo: 'Toronto',
      country: 'CA',
      periods_history: [
        { period: '2026-07', value: 6.8 },
        { period: '2026-06', value: 7.2 },
      ],
    });
    seedDoc({
      series_id: 'STATSCAN_V1643277934',
      geo: 'national',
      geo_type: 'national',
      country: 'CA',
      periods_history: [
        { period: '2026-07', value: 6.9 },
        { period: '2026-06', value: 7.0 },
      ],
    });

    const result = await resolveHiringTrendSeries('Toronto, Ontario, Canada');
    expect(result.available).toBe(true);
    expect(result.window_label).toBe('Last 2 months');
    expect(result.local_label).toBe('Toronto (unemployment rate)');
    expect(result.national_label).toBe('Canada (unemployment rate)');
    expect(result.points).toEqual([
      { period: '2026-06', local_index: 7.2, national_index: 7.0 },
      { period: '2026-07', local_index: 6.8, national_index: 6.9 },
    ]);
  });

  it('folds Mississauga and Brampton into the Toronto CMA', async () => {
    seedDoc({
      series_id: 'STATSCAN_V1643279334',
      geo: 'Toronto',
      country: 'CA',
      periods_history: [
        { period: '2026-07', value: 6.8 },
        { period: '2026-06', value: 7.2 },
      ],
    });
    seedDoc({
      series_id: 'STATSCAN_V1643277934',
      geo: 'national',
      geo_type: 'national',
      country: 'CA',
      periods_history: [
        { period: '2026-07', value: 6.9 },
        { period: '2026-06', value: 7.0 },
      ],
    });

    const mississauga = await resolveHiringTrendSeries('Mississauga, Ontario, Canada');
    const brampton = await resolveHiringTrendSeries('Brampton, Ontario, Canada');
    expect(mississauga.local_label).toBe('Toronto (unemployment rate)');
    expect(brampton.local_label).toBe('Toronto (unemployment rate)');
  });

  it('is case/whitespace tolerant on the incoming location string', async () => {
    seedDoc({
      series_id: 'LNU04000000',
      geo: 'Seattle',
      country: 'US',
      periods_history: [
        { period: '2026-07', value: 5.0 },
        { period: '2026-06', value: 5.1 },
      ],
    });
    seedDoc({
      series_id: 'LNU04000000_NAT',
      geo: 'national',
      geo_type: 'national',
      country: 'US',
      periods_history: [
        { period: '2026-07', value: 4.4 },
        { period: '2026-06', value: 4.6 },
      ],
    });
    // Correct national series_id is fixed at LNU04000000 — reseed with the real id.
    docs[1].series_id = 'LNU04000000';

    const result = await resolveHiringTrendSeries('  SEATTLE, Washington,   USA  ');
    expect(result.available).toBe(true);
  });

  it('returns available:false when fewer than 2 overlapping periods exist', async () => {
    seedDoc({
      series_id: 'STATSCAN_V1643279334',
      geo: 'Toronto',
      country: 'CA',
      periods_history: [{ period: '2026-07', value: 6.8 }],
    });
    seedDoc({
      series_id: 'STATSCAN_V1643277934',
      geo: 'national',
      geo_type: 'national',
      country: 'CA',
      periods_history: [{ period: '2026-07', value: 6.9 }],
    });

    const result = await resolveHiringTrendSeries('Toronto, Ontario, Canada');
    expect(result.available).toBe(false);
  });

  it('returns available:false and logs a warning when the national comparator doc is missing', async () => {
    seedDoc({
      series_id: 'STATSCAN_V1643279334',
      geo: 'Toronto',
      country: 'CA',
      periods_history: [
        { period: '2026-07', value: 6.8 },
        { period: '2026-06', value: 7.2 },
      ],
    });

    const result = await resolveHiringTrendSeries('Toronto, Ontario, Canada');
    expect(result.available).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('matches a non-curated metro city not in the alias table (e.g. Peoria)', async () => {
    seedDoc({
      series_id: 'LAUMT173790000000003',
      geo: 'Peoria',
      country: 'US',
      geo_type: 'metro',
      periods_history: [
        { period: '2026-07', value: 4.9 },
        { period: '2026-06', value: 5.0 },
      ],
    });
    seedDoc({
      series_id: 'LNU04000000',
      geo: 'national',
      geo_type: 'national',
      country: 'US',
      periods_history: [
        { period: '2026-07', value: 4.4 },
        { period: '2026-06', value: 4.6 },
      ],
    });

    const result = await resolveHiringTrendSeries('Peoria, Illinois, USA');
    expect(result.available).toBe(true);
    expect(result.local_label).toBe('Peoria (unemployment rate)');
  });

  it('matches a city as a component of a compound metro name', async () => {
    seedDoc({
      series_id: 'LAUMT171698000000003',
      geo: 'Chicago-Naperville-Elgin',
      country: 'US',
      geo_type: 'metro',
      periods_history: [
        { period: '2026-07', value: 4.9 },
        { period: '2026-06', value: 5.0 },
      ],
    });
    seedDoc({
      series_id: 'LNU04000000',
      geo: 'national',
      geo_type: 'national',
      country: 'US',
      periods_history: [
        { period: '2026-07', value: 4.4 },
        { period: '2026-06', value: 4.6 },
      ],
    });

    const result = await resolveHiringTrendSeries('Naperville, Illinois, USA');
    expect(result.available).toBe(true);
    expect(result.local_label).toBe('Chicago-Naperville-Elgin (unemployment rate)');
  });

  it('falls back to state data when no metro match exists', async () => {
    seedDoc({
      series_id: 'LASST200000000000003',
      geo: 'Kansas',
      country: 'US',
      geo_type: 'state',
      periods_history: [
        { period: '2026-07', value: 3.8 },
        { period: '2026-06', value: 3.9 },
      ],
    });
    seedDoc({
      series_id: 'LNU04000000',
      geo: 'national',
      geo_type: 'national',
      country: 'US',
      periods_history: [
        { period: '2026-07', value: 4.4 },
        { period: '2026-06', value: 4.6 },
      ],
    });

    const result = await resolveHiringTrendSeries('Salina, Kansas, USA');
    expect(result.available).toBe(true);
    expect(result.local_label).toBe('Kansas (unemployment rate)');
  });

  it('returns available:false when neither metro nor state/province match', async () => {
    const result = await resolveHiringTrendSeries('Nowhereville, Nowhere, USA');
    expect(result.available).toBe(false);
  });

  it('disambiguates a same-named metro in different states using the parsed state', async () => {
    const points = [
      { period: '2026-07', value: 4.0 },
      { period: '2026-06', value: 4.1 },
    ];
    seedDoc({ series_id: 'A', geo: 'Springfield (IL)', country: 'US', geo_type: 'metro', periods_history: points });
    seedDoc({ series_id: 'B', geo: 'Springfield (MA)', country: 'US', geo_type: 'metro', periods_history: points });
    seedDoc({
      series_id: 'LNU04000000', geo: 'national', geo_type: 'national', country: 'US', periods_history: points,
    });

    const result = await resolveHiringTrendSeries('Springfield, Massachusetts, USA');
    expect(result.local_label).toBe('Springfield (MA) (unemployment rate)');
  });
});
