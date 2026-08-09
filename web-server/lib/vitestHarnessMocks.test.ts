import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Harness proof: unit tests must run with mocked I/O — no live Redis/Mongo.
 */
const safeGet = vi.fn();
const safeSet = vi.fn();
const connectRedis = vi.fn(async () => true);

vi.mock('./redis.js', () => ({
  connectRedis,
  isRedisAvailable: vi.fn(() => true),
  getRedisClient: vi.fn(() => ({ isOpen: true, get: vi.fn(), set: vi.fn() })),
  disconnectRedis: vi.fn(async () => undefined),
  safeGet,
  safeSet,
  default: { isOpen: true },
}));

vi.mock('mongoose', () => ({
  default: {
    connect: vi.fn(async () => ({ connection: { readyState: 1 } })),
    connection: { readyState: 1 },
  },
  connect: vi.fn(async () => ({ connection: { readyState: 1 } })),
}));

describe('vitest harness mocks (no live Redis/Mongo)', () => {
  beforeEach(() => {
    safeGet.mockReset();
    safeSet.mockReset();
    connectRedis.mockClear();
  });

  it('reads cache via mocked Redis without a live server', async () => {
    const redis = await import('./redis.js');
    safeGet.mockResolvedValueOnce('cached-value');
    await expect(redis.safeGet('demo-key')).resolves.toBe('cached-value');
    expect(safeGet).toHaveBeenCalledWith('demo-key');
    expect(connectRedis).not.toHaveBeenCalled();
  });

  it('does not call mongoose.connect during this suite', async () => {
    const mongoose = await import('mongoose');
    expect(mongoose.default.connect).not.toHaveBeenCalled();
  });
});
