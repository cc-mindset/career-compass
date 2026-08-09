import { describe, expect, it } from 'vitest';
import { isApiConfigured } from '../lib/apiBase';

/** Harness smoke: proves Vitest loads src modules under jsdom. */
describe('client vitest harness', () => {
  it('loads apiBase without a live server', () => {
    expect(typeof isApiConfigured()).toBe('boolean');
  });
});
