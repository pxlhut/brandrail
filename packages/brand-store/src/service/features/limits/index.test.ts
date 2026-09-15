import { describe, expect, it } from 'vitest';

import { InMemoryRateLimiter } from './index.js';

describe('InMemoryRateLimiter', () => {
  it('allows up to the limit within the window, then rejects', async () => {
    const limiter = new InMemoryRateLimiter(2, 1_000);
    expect(await limiter.consume('key')).toBe(true);
    expect(await limiter.consume('key')).toBe(true);
    expect(await limiter.consume('key')).toBe(false);
  });

  it('tracks separate keys independently', async () => {
    const limiter = new InMemoryRateLimiter(1, 1_000);
    expect(await limiter.consume('a')).toBe(true);
    expect(await limiter.consume('b')).toBe(true);
    expect(await limiter.consume('a')).toBe(false);
  });

  it('allows again once the window has passed — clock is injectable, no sleeping', async () => {
    let now = new Date('2026-01-01T00:00:00.000Z');
    const limiter = new InMemoryRateLimiter(1, 1_000, () => now);

    expect(await limiter.consume('key')).toBe(true);
    expect(await limiter.consume('key')).toBe(false);

    now = new Date('2026-01-01T00:00:01.001Z');
    expect(await limiter.consume('key')).toBe(true);
  });
});
