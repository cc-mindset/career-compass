import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const progressHandlers: Array<(raw: unknown) => void> = [];

const mockSocket = {
  on: vi.fn((event: string, handler: (raw: unknown) => void) => {
    if (event === 'progress') progressHandlers.push(handler);
  }),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
  connect: vi.fn(),
};

vi.mock('../../lib/apiBase', () => ({
  getApiBaseUrl: () => 'http://api.test',
  isApiConfigured: () => true,
}));

vi.mock('../../lib/socket', () => ({
  getSocket: () => mockSocket,
  waitForSocketConnection: async () => true,
}));

import { generateMarketInsights } from './api';

describe('generateMarketInsights queued job', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    progressHandlers.length = 0;
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.emit.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fires onOverviewReady from poll when verdict partial lands', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          queued: true,
          jobId: 'job-poll-1',
          position: 1,
          message: 'Queued',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'processing',
          insights: {
            market_report_verdict: {
              headline: 'Overview from poll',
              signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'High' },
            },
            market_shifts: [
              { title: 'A', summary: 'One' },
              { title: 'B', summary: 'Two' },
              { title: 'C', summary: 'Three' },
            ],
          },
          completedSections: ['marketReportVerdict'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'completed',
          insights: {
            market_report_verdict: {
              headline: 'Overview from poll',
              signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'High' },
            },
            market_shifts: [
              { title: 'A', summary: 'One' },
              { title: 'B', summary: 'Two' },
              { title: 'C', summary: 'Three' },
            ],
            growth_sectors: [],
            market_news: [],
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const onOverviewReady = vi.fn();
    const onInsightsUpdate = vi.fn();

    const promise = generateMarketInsights(
      { location: 'Vancouver, Canada', userId: 'guest' },
      { onOverviewReady, onInsightsUpdate },
    );

    await vi.runAllTimersAsync();

    const insights = await promise;

    expect(onOverviewReady).toHaveBeenCalledTimes(1);
    expect(onOverviewReady).toHaveBeenCalledWith(
      expect.objectContaining({
        market_report_verdict: expect.objectContaining({ headline: 'Overview from poll' }),
        market_shifts: expect.any(Array),
      }),
    );
    expect(onInsightsUpdate).toHaveBeenCalled();
    expect(insights.market_report_verdict).toEqual(
      expect.objectContaining({ headline: 'Overview from poll' }),
    );
  });

  it('polls status immediately after section_success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          queued: true,
          jobId: 'job-socket-1',
          position: 1,
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          status: 'processing',
          insights: {
            market_report_verdict: {
              headline: 'Immediate poll headline',
              summary: 'Summary body',
              signals: { role_demand: 'Stable', competition: 'High', evidence_quality: 'High' },
            },
            market_shifts: [
              { title: 'A', summary: 'One' },
              { title: 'B', summary: 'Two' },
              { title: 'C', summary: 'Three' },
            ],
          },
          completedSections: ['marketReportVerdict'],
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const promise = generateMarketInsights(
      { location: 'Toronto, Canada', userId: 'guest' },
      {},
    );

    for (let attempt = 0; attempt < 20 && progressHandlers.length === 0; attempt += 1) {
      await Promise.resolve();
    }
    expect(progressHandlers.length).toBeGreaterThan(0);

    progressHandlers[0]?.({
      type: 'section_success',
      jobId: 'job-socket-1',
      section: 'marketReportVerdict',
      data: {
        market_report_verdict: { headline: 'Socket headline' },
        market_shifts: [{ title: 'A', summary: 'One' }],
      },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);

    await vi.runAllTimersAsync();
    await promise;
  });
});
