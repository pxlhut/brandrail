import { describe, expect, it } from 'vitest';

import { InMemoryIdempotencyStore } from './index.js';

const FAKE_SNAPSHOT = {
  id: 'snap-1',
  siteId: 'site-1',
  version: 1,
  tokens: {} as never,
  cssText: ':root{}',
  checksum: 'c',
  cssSha256: 's',
  sourceConfigVersion: 1,
  schemaVersion: 1,
  publishedAt: '2026-01-01T00:00:00.000Z',
};

describe('InMemoryIdempotencyStore', () => {
  it('returns undefined for an unseen key', async () => {
    const store = new InMemoryIdempotencyStore();
    expect(await store.get('unseen')).toBeUndefined();
  });

  it('returns what was set, before it expires', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.set('key', FAKE_SNAPSHOT, 1_000);
    expect(await store.get('key')).toEqual(FAKE_SNAPSHOT);
  });

  it('expires — clock is injectable, no sleeping', async () => {
    let now = new Date('2026-01-01T00:00:00.000Z');
    const store = new InMemoryIdempotencyStore(() => now);

    await store.set('key', FAKE_SNAPSHOT, 1_000);
    now = new Date('2026-01-01T00:00:00.999Z');
    expect(await store.get('key')).toEqual(FAKE_SNAPSHOT);

    now = new Date('2026-01-01T00:00:01.001Z');
    expect(await store.get('key')).toBeUndefined();
  });
});
