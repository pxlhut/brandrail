import { defaultControlConfig, generateTheme } from '@pxlhut/brand-core';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../contract/index.js';
import { MemoryBrandThemeStore } from '../../../memory/index.js';
import { RoleError } from '../access/index.js';
import { RateLimitError, type RateLimiter } from '../limits/index.js';
import type { InvalidationEvent } from '../events/index.js';
import { hashTokens } from './hash.js';
import { publishTheme, rollback, type PublishContext } from './index.js';

async function seedConfig(store: MemoryBrandThemeStore, siteId: string, brandColor = '#7C6CFF') {
  return store.saveConfig(
    siteId,
    {
      brandColor,
      controlConfig: defaultControlConfig(),
      fieldValues: {},
      rawOverrides: {},
      passthrough: {},
      schemaVersion: 1,
    },
    0,
  );
}

function makeCtx(overrides: Partial<PublishContext> = {}): PublishContext {
  return {
    userId: 'user-1',
    authorize: async () => 'owner',
    store: new MemoryBrandThemeStore(),
    ...overrides,
  };
}

describe('publishTheme — role check', () => {
  it('rejects an unauthorised caller before touching the store', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-1');
    const ctx = makeCtx({ store, authorize: async () => null });

    await expect(publishTheme('site-1', ctx)).rejects.toBeInstanceOf(RoleError);
    expect(await store.getActiveSnapshot('site-1')).toBeNull();
  });
});

describe('publishTheme — contrast violations (§7 step 6)', () => {
  it('returns field-level violations and writes nothing, for a raw override that breaks contrast', async () => {
    const store = new MemoryBrandThemeStore();
    // Both roles forced to the exact same colour — Lc 0 against itself,
    // guaranteed to fail whatever floor `primary-foreground` has, regardless
    // of brand colour.
    await store.saveConfig(
      'site-2',
      {
        brandColor: '#7C6CFF',
        controlConfig: {
          ...defaultControlConfig(),
          advancedTokens: { tier: 'raw' },
        },
        fieldValues: {},
        rawOverrides: { 'color.primary': '#808080', 'color.primary-foreground': '#808080' },
        passthrough: {},
        schemaVersion: 1,
      },
      0,
    );

    const result = await publishTheme('site-2', makeCtx({ store }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some((v) => v.fg === 'primary-foreground')).toBe(true);
    }
    expect(await store.getActiveSnapshot('site-2'), 'nothing should have been written').toBeNull();
  });
});

describe('publishTheme — checksum dedupe (rule 3, delegated to the store)', () => {
  it('a second publish of the same unchanged config writes no new row', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-3');
    const ctx = makeCtx({ store });

    const first = await publishTheme('site-3', ctx);
    const second = await publishTheme('site-3', ctx);

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.snapshot.id).toBe(first.snapshot.id);
      expect(second.snapshot.version).toBe(first.snapshot.version);
    }
    expect(await store.listSnapshots('site-3')).toHaveLength(1);
  });
});

describe('publishTheme — idempotency (§28), distinct from checksum dedupe', () => {
  it('a repeated idempotencyKey returns the cached snapshot without re-running generation', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-4', '#111111');
    const ctx = makeCtx({ store });

    const first = await publishTheme('site-4', ctx, { idempotencyKey: 'retry-1' });
    expect(first.ok).toBe(true);

    // The config changes in between — if generation reran, the result would
    // differ. A different checksum, computed independently, proves that.
    const changedConfig = await store.saveConfig('site-4', { brandColor: '#EEEEEE' }, 1);
    const recomputed = generateTheme({ brandColor: changedConfig.brandColor });

    const second = await publishTheme('site-4', ctx, { idempotencyKey: 'retry-1' });

    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.snapshot.id).toBe(first.snapshot.id);
      expect(second.snapshot.checksum).toBe(first.snapshot.checksum);
      expect(second.snapshot.checksum).not.toBe(hashTokens(recomputed.tokens));
    }
  });
});

describe('publishTheme — sourceConfigVersion and expectedConfigVersion (D8)', () => {
  it('records the config version the snapshot was built from', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-5');
    const result = await publishTheme('site-5', makeCtx({ store }));
    expect(result.ok && result.snapshot.sourceConfigVersion).toBe(1);
  });

  it('rejects a stale expectedConfigVersion', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-6');
    await store.saveConfig('site-6', { brandColor: '#222222' }, 1); // now at version 2

    await expect(
      publishTheme('site-6', makeCtx({ store }), { expectedConfigVersion: 1 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws NotFoundError for a site with no config at all', async () => {
    const store = new MemoryBrandThemeStore();
    await expect(publishTheme('never-provisioned', makeCtx({ store }))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('publishTheme — invalidation fires only after commit (§7 step 5)', () => {
  it('does not fire when the store publish call fails', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-7');
    vi.spyOn(store, 'publish').mockRejectedValueOnce(new Error('simulated transaction failure'));

    const emit = vi.fn<(event: InvalidationEvent) => void>();
    await expect(publishTheme('site-7', makeCtx({ store, emit }))).rejects.toThrow(
      'simulated transaction failure',
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('fires exactly once, with the committed snapshot\'s own data, when publish succeeds', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-8');
    const emit = vi.fn<(event: InvalidationEvent) => void>();

    const result = await publishTheme('site-8', makeCtx({ store, emit }));

    expect(emit).toHaveBeenCalledTimes(1);
    expect(result.ok && emit).toHaveBeenCalledWith(
      result.ok
        ? { siteId: 'site-8', snapshotId: result.snapshot.id, checksum: result.snapshot.checksum }
        : undefined,
    );
  });
});

describe('publishTheme — rate limits (§24, §38)', () => {
  it('enforces the per-site limit', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-9');
    const siteRateLimiter: RateLimiter = { consume: async () => false };

    await expect(publishTheme('site-9', makeCtx({ store, siteRateLimiter }))).rejects.toBeInstanceOf(
      RateLimitError,
    );
  });

  it('enforces a per-account ceiling in addition to the per-site limit', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-10');
    const accountRateLimiter: RateLimiter = { consume: async () => false };

    await expect(
      publishTheme('site-10', makeCtx({ store, accountId: 'account-1', accountRateLimiter })),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it('does not check the account limiter at all when no accountId is given', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-11');
    const accountRateLimiter: RateLimiter = { consume: vi.fn(async () => true) };

    await publishTheme('site-11', makeCtx({ store, accountRateLimiter }));
    expect(accountRateLimiter.consume).not.toHaveBeenCalled();
  });
});

describe('rollback', () => {
  it('rejects an unauthorised caller', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-12');
    const first = await publishTheme('site-12', makeCtx({ store }));

    await expect(
      rollback('site-12', first.ok ? first.snapshot.id : '', {
        userId: 'user-1',
        authorize: async () => null,
        store,
      }),
    ).rejects.toBeInstanceOf(RoleError);
  });

  it('moves the active pointer and emits an invalidation event for the snapshot rolled back to', async () => {
    const store = new MemoryBrandThemeStore();
    await seedConfig(store, 'site-13', '#111111');
    const v1 = await publishTheme('site-13', makeCtx({ store }));
    await store.saveConfig('site-13', { brandColor: '#222222' }, 1);
    await publishTheme('site-13', makeCtx({ store }));

    const emit = vi.fn<(event: InvalidationEvent) => void>();
    await rollback('site-13', v1.ok ? v1.snapshot.id : '', {
      userId: 'user-1',
      authorize: async () => 'owner',
      store,
      emit,
    });

    const active = await store.getActiveSnapshot('site-13');
    expect(active?.id).toBe(v1.ok ? v1.snapshot.id : undefined);
    expect(emit).toHaveBeenCalledWith({
      siteId: 'site-13',
      snapshotId: v1.ok ? v1.snapshot.id : '',
      checksum: v1.ok ? v1.snapshot.checksum : '',
    });
  });
});
