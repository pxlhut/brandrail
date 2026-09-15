import { defaultControlConfig } from '@pxlhut/brand-core';
import { describe, expect, it } from 'vitest';

import { ConflictError } from '../../../contract/index.js';
import { MemoryBrandThemeStore } from '../../../memory/index.js';
import { RoleError } from '../access/index.js';
import { RateLimitError } from '../limits/index.js';
import { TierViolationError } from './errors.js';
import { saveDraft, type AuthoringContext } from './index.js';

/**
 * `MemoryBrandThemeStore` has no concept of tiers at all — it would happily
 * write a `locked` field's value if asked. That's the point: these tests
 * prove `saveDraft` rejects it *before* the store ever sees the write, i.e.
 * that the UI is not the enforcement (§9).
 */
function makeCtx(overrides: Partial<AuthoringContext> = {}): AuthoringContext {
  return {
    userId: 'user-1',
    authorize: async () => 'owner',
    store: new MemoryBrandThemeStore(),
    ...overrides,
  };
}

describe('saveDraft — role check runs before the tier check (§21)', () => {
  it('an unauthorised user targeting a locked field gets the role error, not a tier error', async () => {
    const store = new MemoryBrandThemeStore();
    await store.saveConfig(
      'site-1',
      {
        brandColor: '#7C6CFF',
        controlConfig: { ...defaultControlConfig(), radius: { tier: 'locked', value: '0.5rem' } },
        fieldValues: {},
        rawOverrides: {},
        passthrough: {},
        schemaVersion: 1,
      },
      0,
    );

    const ctx = makeCtx({ store, authorize: async () => null });

    await expect(
      saveDraft('site-1', { expectedVersion: 1, radius: '99rem' }, ctx),
    ).rejects.toBeInstanceOf(RoleError);
  });

  it('an authorised user targeting the same locked field gets the tier error', async () => {
    const store = new MemoryBrandThemeStore();
    await store.saveConfig(
      'site-1',
      {
        brandColor: '#7C6CFF',
        controlConfig: { ...defaultControlConfig(), radius: { tier: 'locked', value: '0.5rem' } },
        fieldValues: {},
        rawOverrides: {},
        passthrough: {},
        schemaVersion: 1,
      },
      0,
    );

    const ctx = makeCtx({ store });

    await expect(saveDraft('site-1', { expectedVersion: 1, radius: '99rem' }, ctx)).rejects.toBeInstanceOf(
      TierViolationError,
    );

    // And proof the store really would have accepted it: nothing stopped
    // MemoryBrandThemeStore itself from writing an arbitrary radius.
    const raw = await store.saveConfig('site-1', { fieldValues: { radius: '99rem' } }, 1);
    expect(raw.fieldValues.radius).toBe('99rem');
  });
});

describe('saveDraft — end to end against MemoryBrandThemeStore', () => {
  it('persists a valid guided-tier edit', async () => {
    const store = new MemoryBrandThemeStore();
    await store.saveConfig(
      'site-2',
      {
        brandColor: '#7C6CFF',
        controlConfig: defaultControlConfig(),
        fieldValues: {},
        rawOverrides: {},
        passthrough: {},
        schemaVersion: 1,
      },
      0,
    );

    const saved = await saveDraft('site-2', { expectedVersion: 1, radius: '1rem' }, makeCtx({ store }));
    expect(saved.fieldValues.radius).toBe('1rem');
  });

  it('surfaces the store\'s own ConflictError for a stale expectedVersion, unchanged', async () => {
    const store = new MemoryBrandThemeStore();
    const ctx = makeCtx({ store });
    await saveDraft('site-3', { expectedVersion: 0, brandColor: '#111111' }, ctx);

    await expect(
      saveDraft('site-3', { expectedVersion: 0, brandColor: '#222222' }, ctx),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('enforces the rate limit as a backstop (§24)', async () => {
    const store = new MemoryBrandThemeStore();
    const rateLimiter = { consume: async () => false };
    const ctx = makeCtx({ store, rateLimiter });

    await expect(saveDraft('site-4', { expectedVersion: 0, brandColor: '#111111' }, ctx)).rejects.toBeInstanceOf(
      RateLimitError,
    );
  });
});
